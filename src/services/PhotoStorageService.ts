import * as FileSystem from 'expo-file-system/legacy';
import { PhotoPose } from '../types/domain';


const PHOTO_DIR = `${FileSystem.documentDirectory || ''}body_photos/`;

export class PhotoStorageService {
  /**
   * Ensures the persistent body_photos directory exists on device.
   */
  static async ensureDirectory(): Promise<void> {
    if (!FileSystem.documentDirectory) return;
    try {
      const info = await FileSystem.getInfoAsync(PHOTO_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
      }
    } catch {
      // In test or non-filesystem environment, ignore
    }
  }

  /**
   * Copies a newly captured/selected photo from cache into permanent document storage.
   */
  static async persistCapturedPhoto(
    sourceUri: string,
    date: string,
    pose: PhotoPose = 'front'
  ): Promise<string> {
    if (!FileSystem.documentDirectory || !sourceUri) {
      return sourceUri;
    }

    try {
      await this.ensureDirectory();
      const timestamp = Date.now();
      const safeDate = String(date).replace(/[^0-9-]/g, '');
      const safePose = String(pose).replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = `${safeDate}_${safePose}_${timestamp}.jpg`;
      const destUri = `${PHOTO_DIR}${filename}`;

      await FileSystem.copyAsync({ from: sourceUri, to: destUri });
      return destUri;
    } catch {
      // Fallback to original URI if copy fails
      return sourceUri;
    }
  }

  /**
   * Physically removes a photo file from document storage.
   */
  static async deletePhotoFile(uri: string): Promise<void> {
    if (!FileSystem.documentDirectory || !uri || uri.includes('..')) return;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch {
      // Ignore deletion failure
    }
  }

  /**
   * Resolves a photo URI, ensuring full file:// schema where needed.
   */
  static resolveUri(uri: string): string {
    if (!uri || uri.includes('..')) return '';
    if (
      uri.startsWith('http://') ||
      uri.startsWith('https://') ||
      uri.startsWith('data:') ||
      uri.startsWith('file://')
    ) {
      return uri;
    }
    if (uri.includes('://')) {
      return '';
    }
    const docDir = FileSystem.documentDirectory || '';
    return `${docDir}${uri}`;
  }
}
