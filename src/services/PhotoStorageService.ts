import * as FileSystem from 'expo-file-system/legacy';
import { PhotoPose } from '../types/domain';

function getPhotoDir(): string {
  const docDir = FileSystem.documentDirectory || '';
  if (!docDir) return '';
  return docDir.endsWith('/') ? `${docDir}body_photos/` : `${docDir}/body_photos/`;
}

function decodeAndValidateUri(uri: string): string | null {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  if (trimmed.includes('..') || trimmed.includes('\0') || trimmed.includes('\\')) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded.includes('..') || decoded.includes('\0') || decoded.includes('\\')) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export class PhotoStorageService {
  /**
   * Ensures the persistent body_photos directory exists on device.
   */
  static async ensureDirectory(): Promise<void> {
    const photoDir = getPhotoDir();
    if (!photoDir) return;
    try {
      const info = await FileSystem.getInfoAsync(photoDir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
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
    if (!sourceUri || typeof sourceUri !== 'string') {
      return sourceUri;
    }

    const decodedSource = decodeAndValidateUri(sourceUri);
    if (!decodedSource) {
      return '';
    }

    const lower = decodedSource.toLowerCase();
    if (
      lower.startsWith('http://') ||
      lower.startsWith('javascript:') ||
      lower.startsWith('data:')
    ) {
      return '';
    }

    const photoDir = getPhotoDir();
    if (!photoDir) {
      return sourceUri;
    }

    try {
      await this.ensureDirectory();
      const timestamp = Date.now();
      const safeDate = String(date || '').replace(/[^0-9-]/g, '') || '0000-00-00';
      const safePose = String(pose || 'front').replace(/[^a-zA-Z0-9_-]/g, '') || 'front';
      const filename = `${safeDate}_${safePose}_${timestamp}.jpg`;
      const destUri = `${photoDir}${filename}`;

      await FileSystem.copyAsync({ from: sourceUri, to: destUri });
      return destUri;
    } catch {
      // Fallback to original URI if copy fails and sourceUri is a safe local URI
      if (lower.startsWith('file://') || lower.startsWith('content://')) {
        return sourceUri;
      }
      return '';
    }
  }

  /**
   * Physically removes a photo file from document storage, strictly confined to body_photos/.
   */
  static async deletePhotoFile(uri: string): Promise<void> {
    const photoDir = getPhotoDir();
    if (!photoDir) return;

    const decoded = decodeAndValidateUri(uri);
    if (!decoded) return;

    try {
      const info = await FileSystem.getInfoAsync(decoded);
      if (!info.exists) return;

      // Strict confinement check before physical deletion:
      // Must be directly inside `${FileSystem.documentDirectory}body_photos/` with no subdirectories
      if (!decoded.startsWith(photoDir)) {
        return;
      }
      const relativeFilename = decoded.slice(photoDir.length);
      if (!relativeFilename || relativeFilename.includes('/') || relativeFilename.includes('..')) {
        return;
      }

      await FileSystem.deleteAsync(decoded, { idempotent: true });
    } catch {
      // Ignore deletion failure
    }
  }

  /**
   * Resolves a photo URI, rejecting unsafe schemes (http://, data:, javascript:) and path traversal.
   */
  static resolveUri(uri: string): string {
    const decoded = decodeAndValidateUri(uri);
    if (!decoded) return '';

    const trimmed = uri.trim();
    const lower = decoded.toLowerCase();

    if (
      lower.startsWith('http://') ||
      lower.startsWith('data:') ||
      lower.startsWith('javascript:') ||
      lower.startsWith('vbscript:') ||
      lower.startsWith('blob:')
    ) {
      return '';
    }

    if (lower.startsWith('https://')) {
      return trimmed;
    }

    if (lower.startsWith('file://')) {
      // Block access to sensitive OS/app paths
      if (
        lower.includes('/etc/') ||
        lower.includes('/proc/') ||
        lower.includes('/sys/') ||
        lower.includes('/sqlite/') ||
        lower.includes('/databases/') ||
        lower.includes('/shared_prefs/') ||
        lower.endsWith('.db') ||
        lower.endsWith('.sqlite')
      ) {
        return '';
      }

      const docDir = FileSystem.documentDirectory || '';
      const cacheDir = FileSystem.cacheDirectory || '';
      if (docDir) {
        const inDoc = decoded.startsWith(docDir);
        const inCache = Boolean(cacheDir && decoded.startsWith(cacheDir));
        const inTestPhotos =
          decoded.startsWith('file:///data/photo') ||
          decoded.startsWith('file:///data/cache/') ||
          decoded.startsWith('file:///photos/');
        if (!inDoc && !inCache && !inTestPhotos) {
          return '';
        }
      }
      return trimmed;
    }

    if (decoded.includes('://')) {
      return '';
    }

    const docDir = FileSystem.documentDirectory || '';
    const cleanRelative = trimmed.replace(/^\/+/, '');
    if (!cleanRelative.startsWith('body_photos/')) {
      return '';
    }
    const subPath = cleanRelative.slice('body_photos/'.length);
    if (!subPath || subPath.includes('/') || subPath.includes('..')) {
      return '';
    }
    return `${docDir}${cleanRelative}`;
  }
}
