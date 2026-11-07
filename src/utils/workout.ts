import { SetLog, ExerciseHistoryPoint } from '../types/domain';

/**
 * Calculates Brzycki 1RM: weightKg * (36 / (37 - reps))
 * Standard and clinically recommended for reps between 1 and 10.
 */
export function calculateBrzycki1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  // Guard against division by zero or negative denominator (reps >= 37)
  const safeReps = Math.min(reps, 30);
  const result = weightKg * (36 / (37 - safeReps));
  return Math.round(result * 10) / 10;
}

/**
 * Calculates Epley 1RM: weightKg * (1 + 0.0333 * reps)
 * Recommended for higher rep ranges (> 10 reps).
 */
export function calculateEpley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  const result = weightKg * (1 + 0.0333 * reps);
  return Math.round(result * 10) / 10;
}

/**
 * Smart 1RM calculation supporting formula selection.
 */
export function calculate1RM(
  weightKg: number,
  reps: number,
  formula: 'brzycki' | 'epley' = 'brzycki'
): number {
  if (formula === 'epley') {
    return calculateEpley1RM(weightKg, reps);
  }
  return calculateBrzycki1RM(weightKg, reps);
}

/**
 * Computes total workout volume: sum(weightKg * reps) for completed sets only.
 */
export function calculateWorkoutVolume(
  sets: { weightKg: number; reps: number; completed?: boolean }[]
): number {
  if (!sets || sets.length === 0) return 0;
  const total = sets
    .filter((s) => s.completed !== false)
    .reduce((sum, s) => {
      const weight = Math.max(0, s.weightKg || 0);
      const reps = Math.max(0, s.reps || 0);
      return sum + weight * reps;
    }, 0);
  return Math.round(total * 10) / 10;
}

/**
 * Formats elapsed seconds into MM:SS or HH:MM:SS.
 */
export function formatElapsedSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Formats duration in minutes to user-friendly string (e.g. "45 min" or "1h 15m").
 */
export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return '0 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = Math.round(minutes % 60);
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

/**
 * Formats rest timer countdown in MM:SS format.
 */
export function formatRestTimerDisplay(remainingSeconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(remainingSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Formats previous session set reference (e.g., "80kg × 8").
 */
export function formatPreviousLoad(
  previousSets: SetLog[] | undefined,
  currentSetNumber: number
): string {
  if (!previousSets || previousSets.length === 0) return '—';
  const matchingSet = previousSets.find((s) => s.setNumber === currentSetNumber);
  if (!matchingSet) {
    // If set number exceeds previous count, fall back to last recorded set
    const lastSet = previousSets[previousSets.length - 1];
    return `${lastSet.weightKg}kg × ${lastSet.reps}`;
  }
  return `${matchingSet.weightKg}kg × ${matchingSet.reps}`;
}

export interface ChartProgressionData {
  labels: string[];
  maxWeights: number[];
  estimated1RMs: number[];
  volumes: number[];
  personalRecord: {
    maxWeight: number;
    max1RM: number;
    prDate: string | null;
  };
}

/**
 * Maps raw ExerciseHistoryPoint[] into chart series coordinates.
 */
export function mapExerciseHistoryToChart(points: ExerciseHistoryPoint[]): ChartProgressionData {
  if (!points || points.length === 0) {
    return {
      labels: [],
      maxWeights: [],
      estimated1RMs: [],
      volumes: [],
      personalRecord: { maxWeight: 0, max1RM: 0, prDate: null },
    };
  }

  // Ensure chronological order
  const sorted = [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let maxWeight = 0;
  let max1RM = 0;
  let prDate: string | null = null;

  const labels: string[] = [];
  const maxWeights: number[] = [];
  const estimated1RMs: number[] = [];
  const volumes: number[] = [];

  for (const pt of sorted) {
    // Format YYYY-MM-DD -> DD/MM
    const parts = pt.date.split('-');
    const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : pt.date;
    labels.push(label);

    maxWeights.push(pt.maxWeightKg);
    estimated1RMs.push(pt.estimated1RM);
    volumes.push(pt.totalVolumeKg);

    if (pt.estimated1RM > max1RM) {
      max1RM = pt.estimated1RM;
      maxWeight = pt.maxWeightKg;
      prDate = pt.date;
    }
  }

  return {
    labels,
    maxWeights,
    estimated1RMs,
    volumes,
    personalRecord: { maxWeight, max1RM, prDate },
  };
}
