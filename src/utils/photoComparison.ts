import { BodyLog, PhotoDeltaMetrics, PhotoPose } from '../types/domain';

/**
 * Extracts the pose orientation from a photo filename or URI string.
 */
export function extractPoseFromUri(uri: string): PhotoPose {
  if (!uri) return 'other';
  const lower = uri.toLowerCase();
  if (lower.includes('front') || lower.includes('frente')) return 'front';
  if (
    lower.includes('side') ||
    lower.includes('lado') ||
    lower.includes('lateral') ||
    lower.includes('perfil')
  ) {
    return 'side';
  }
  if (lower.includes('back') || lower.includes('costas')) return 'back';
  return 'other';
}

/**
 * Calculates comparative metrics between two photo dates / body logs.
 */
export function calculatePhotoDeltaMetrics(
  beforeLog: BodyLog | null,
  afterLog: BodyLog | null,
  beforeDate: string,
  afterDate: string
): PhotoDeltaMetrics {
  const d1 = new Date(beforeDate).getTime();
  const d2 = new Date(afterDate).getTime();
  const daysBetween = Math.max(0, Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)));

  let weightDeltaKg: number | null = null;
  if (beforeLog && afterLog && beforeLog.weightKg > 0 && afterLog.weightKg > 0) {
    weightDeltaKg = Number((afterLog.weightKg - beforeLog.weightKg).toFixed(1));
  }

  let bodyFatDeltaPct: number | null = null;
  if (beforeLog?.bodyFatPct !== undefined && afterLog?.bodyFatPct !== undefined) {
    bodyFatDeltaPct = Number((afterLog.bodyFatPct - beforeLog.bodyFatPct).toFixed(1));
  }

  let waistDeltaCm: number | null = null;
  if (beforeLog?.waistCm !== undefined && afterLog?.waistCm !== undefined) {
    waistDeltaCm = Number((afterLog.waistCm - beforeLog.waistCm).toFixed(1));
  }

  return {
    daysBetween,
    weightDeltaKg,
    bodyFatDeltaPct,
    waistDeltaCm,
  };
}

/**
 * Selects initial comparison indices for before & after pairing.
 * Photos are ordered newest first (index 0 is newest, last index is oldest baseline).
 */
export function getInitialComparisonIndices(
  photosCount: number
): { beforeIndex: number; afterIndex: number } | null {
  if (photosCount < 2) return null;
  return {
    afterIndex: 0,
    beforeIndex: photosCount - 1,
  };
}

/**
 * Resolves a stored photo URI into a usable Image source URI.
 */
export function resolvePhotoUri(uri: string): string {
  if (!uri) return '';
  if (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('data:') ||
    uri.startsWith('file://')
  ) {
    return uri;
  }
  return uri;
}
