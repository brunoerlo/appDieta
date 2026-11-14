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
  const daysBetween =
    !Number.isNaN(d1) && !Number.isNaN(d2)
      ? Math.max(0, Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)))
      : 0;

  let weightDeltaKg: number | null = null;
  if (
    beforeLog &&
    afterLog &&
    Number.isFinite(beforeLog.weightKg) &&
    Number.isFinite(afterLog.weightKg) &&
    beforeLog.weightKg > 0 &&
    afterLog.weightKg > 0
  ) {
    weightDeltaKg = Number((afterLog.weightKg - beforeLog.weightKg).toFixed(1));
  }

  let bodyFatDeltaPct: number | null = null;
  if (
    beforeLog?.bodyFatPct != null &&
    afterLog?.bodyFatPct != null &&
    Number.isFinite(beforeLog.bodyFatPct) &&
    Number.isFinite(afterLog.bodyFatPct)
  ) {
    bodyFatDeltaPct = Number((afterLog.bodyFatPct - beforeLog.bodyFatPct).toFixed(1));
  }

  let waistDeltaCm: number | null = null;
  if (
    beforeLog?.waistCm != null &&
    afterLog?.waistCm != null &&
    Number.isFinite(beforeLog.waistCm) &&
    Number.isFinite(afterLog.waistCm)
  ) {
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
  if (!uri || typeof uri !== 'string') return '';
  const trimmed = uri.trim();
  if (!trimmed) return '';

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return '';
  }

  if (
    trimmed.includes('..') ||
    decoded.includes('..') ||
    trimmed.includes('\0') ||
    decoded.includes('\0')
  ) {
    return '';
  }

  const lower = decoded.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('javascript:')) {
    return '';
  }

  if (
    lower.startsWith('https://') ||
    lower.startsWith('file://') ||
    lower.startsWith('data:image/')
  ) {
    return trimmed;
  }

  return '';
}
