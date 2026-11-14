import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() || '';

const isDev =
  typeof __DEV__ !== 'undefined'
    ? Boolean(__DEV__)
    : process.env.NODE_ENV !== 'production';

if ((!supabaseUrl || !supabaseKey) && isDev && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY environment variables.'
  );
}

/**
 * Encrypted session storage adapter (AES-256-CTR) combining SecureStore (for the 256-bit key)
 * and AsyncStorage (for arbitrarily large session payloads exceeding SecureStore's 2048-byte limit).
 * Falls back safely to in-memory key storage on Web/Jest environments where native Keychain/Keystore is unavailable.
 */
export class LargeSecureStore {
  private fallbackKeyStore = new Map<string, string>();

  private generateRandomKeyBytes(): Uint8Array {
    const key = new Uint8Array(32);
    if (typeof Crypto?.getRandomValues === 'function') {
      return Crypto.getRandomValues(key);
    }
    if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.getRandomValues === 'function') {
      return globalThis.crypto.getRandomValues(key);
    }
    for (let i = 0; i < key.length; i++) {
      key[i] = Math.floor(Math.random() * 256);
    }
    return key;
  }

  private sanitizeSecureStoreKey(key: string): string {
    return `sb_key_${key.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  }

  private async setKeyHex(key: string, hexKey: string): Promise<void> {
    const safeKey = this.sanitizeSecureStoreKey(key);
    if (Platform.OS !== 'web' && process.env.NODE_ENV !== 'test' && typeof SecureStore?.setItemAsync === 'function') {
      try {
        await SecureStore.setItemAsync(safeKey, hexKey, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
        return;
      } catch {
        // Fallback to in-memory key store if native SecureStore is unavailable
      }
    }
    this.fallbackKeyStore.set(safeKey, hexKey);
  }

  private async getKeyHex(key: string): Promise<string | null> {
    const safeKey = this.sanitizeSecureStoreKey(key);
    if (Platform.OS !== 'web' && process.env.NODE_ENV !== 'test' && typeof SecureStore?.getItemAsync === 'function') {
      try {
        const stored = await SecureStore.getItemAsync(safeKey);
        if (stored) return stored;
      } catch {
        // Fallback to in-memory key store
      }
    }
    return this.fallbackKeyStore.get(safeKey) ?? null;
  }

  private async deleteKeyHex(key: string): Promise<void> {
    const safeKey = this.sanitizeSecureStoreKey(key);
    this.fallbackKeyStore.delete(safeKey);
    if (Platform.OS !== 'web' && process.env.NODE_ENV !== 'test' && typeof SecureStore?.deleteItemAsync === 'function') {
      try {
        await SecureStore.deleteItemAsync(safeKey);
      } catch {
        // Ignore deletion failure in non-native environments
      }
    }
  }

  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = this.generateRandomKeyBytes();
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const valueBytes = aesjs.utils.utf8.toBytes(value);
    const encryptedBytes = cipher.encrypt(valueBytes);

    await this.setKeyHex(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await this.getKeyHex(key);
    if (!encryptionKeyHex) {
      return null;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const encryptedBytes = aesjs.utils.hex.toBytes(value);
    const decryptedBytes = cipher.decrypt(encryptedBytes);
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return null;
    }
    try {
      return await this.decrypt(key, encrypted);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await this.deleteKeyHex(key);
  }
}

export const secureSessionStorage = new LargeSecureStore();

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-anon-key',
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
