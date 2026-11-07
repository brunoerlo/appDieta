import { WeightHistoryPoint } from '../types/domain';

export interface BodyCompositionResult {
  fatMassKg: number;
  leanMassKg: number;
}

export interface WeightChartPoint {
  date: string;
  label: string; // "DD/MM"
  weightKg: number;
  movingAverage: number | null;
  xPct: number; // 0 to 100%
  yWeightPct: number; // 0 to 100%
  yMAPct: number | null; // 0 to 100% or null
}

export interface WeightChartData {
  points: WeightChartPoint[];
  minWeight: number;
  maxWeight: number;
  currentWeight: number | null;
  currentMA: number | null;
  weightDeltaVsMA: number | null; // currentWeight - currentMA
  trendDirection: 'down' | 'up' | 'stable';
  yTicks: number[];
}

/**
 * Shifts date string (YYYY-MM-DD) by given number of days safely without UTC hour distortion.
 */
export function shiftDateString(dateStr: string, days: number): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts.map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates rolling moving average for a target date from an array of weigh-in logs.
 * Strict calendar window: [targetDate - (windowDays - 1), targetDate].
 */
export function calculateMovingAverageForDate(
  targetDate: string,
  logs: { date: string; weightKg: number }[],
  windowDays = 7
): number | null {
  const startDate = shiftDateString(targetDate, -(windowDays - 1));
  const validWeights = logs
    .filter((l) => l.date >= startDate && l.date <= targetDate && l.weightKg > 0)
    .map((l) => l.weightKg);

  if (validWeights.length === 0) return null;
  const sum = validWeights.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / validWeights.length) * 100) / 100;
}

/**
 * Computes estimated Fat Mass and Lean Mass from weight and body fat percentage.
 * Formula: Fat Mass = weight * (bf / 100); Lean Mass = weight - Fat Mass.
 * Precision: 0.1 kg (rounded to 1 decimal place).
 */
export function calculateBodyComposition(
  weightKg: number,
  bodyFatPct?: number | null
): BodyCompositionResult | null {
  if (
    !weightKg ||
    weightKg <= 0 ||
    bodyFatPct === undefined ||
    bodyFatPct === null ||
    bodyFatPct < 0
  ) {
    return null;
  }
  const fatMassKg = Math.round(weightKg * (bodyFatPct / 100) * 10) / 10;
  const leanMassKg = Math.round((weightKg - fatMassKg) * 10) / 10;
  return { fatMassKg, leanMassKg };
}

/**
 * Maps WeightHistoryPoint array into coordinates for trend charting.
 */
export function mapWeightHistoryToChart(
  history: WeightHistoryPoint[],
  maxPoints = 30
): WeightChartData {
  if (!history || history.length === 0) {
    return {
      points: [],
      minWeight: 0,
      maxWeight: 0,
      currentWeight: null,
      currentMA: null,
      weightDeltaVsMA: null,
      trendDirection: 'stable',
      yTicks: [],
    };
  }

  // Filter out any 0-kg placeholder entries
  const validEntries = history.filter((p) => p.weightKg > 0);
  if (validEntries.length === 0) {
    return {
      points: [],
      minWeight: 0,
      maxWeight: 0,
      currentWeight: null,
      currentMA: null,
      weightDeltaVsMA: null,
      trendDirection: 'stable',
      yTicks: [],
    };
  }

  // Take the most recent points up to maxPoints
  const recent = validEntries.slice(-maxPoints);
  const weights = recent.map((p) => p.weightKg);
  const mas = recent
    .map((p) => p.movingAverage)
    .filter((m): m is number => m !== null && m !== undefined);
  const allValues = [...weights, ...mas];

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const minWeight = Math.floor(rawMin - 1);
  const maxWeight = Math.ceil(rawMax + 1);
  const range = maxWeight - minWeight || 1;

  const yTicks = [
    maxWeight,
    Math.round(((maxWeight * 2 + minWeight) / 3) * 10) / 10,
    Math.round(((maxWeight + minWeight * 2) / 3) * 10) / 10,
    minWeight,
  ];

  const totalPoints = recent.length;
  const points: WeightChartPoint[] = recent.map((pt, idx) => {
    const xPct = totalPoints === 1 ? 50 : Math.round((idx / (totalPoints - 1)) * 100);
    const yWeightPct = Math.round(((pt.weightKg - minWeight) / range) * 100);
    const yMAPct =
      pt.movingAverage !== null && pt.movingAverage !== undefined
        ? Math.round(((pt.movingAverage - minWeight) / range) * 100)
        : null;

    const parts = pt.date.split('-');
    const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : pt.date;

    return {
      date: pt.date,
      label,
      weightKg: pt.weightKg,
      movingAverage: pt.movingAverage ?? null,
      xPct,
      yWeightPct,
      yMAPct,
    };
  });

  const lastPoint = points[points.length - 1];
  const currentWeight = lastPoint ? lastPoint.weightKg : null;
  const currentMA = lastPoint ? lastPoint.movingAverage : null;
  const weightDeltaVsMA =
    currentWeight !== null && currentMA !== null
      ? Math.round((currentWeight - currentMA) * 10) / 10
      : null;

  let trendDirection: 'down' | 'up' | 'stable' = 'stable';
  if (points.length >= 2) {
    const validMAPoints = points.filter((p) => p.movingAverage !== null);
    if (validMAPoints.length >= 2) {
      const firstMA = validMAPoints[0].movingAverage!;
      const lastMA = validMAPoints[validMAPoints.length - 1].movingAverage!;
      if (lastMA < firstMA - 0.2) trendDirection = 'down';
      else if (lastMA > firstMA + 0.2) trendDirection = 'up';
    }
  }

  return {
    points,
    minWeight,
    maxWeight,
    currentWeight,
    currentMA,
    weightDeltaVsMA,
    trendDirection,
    yTicks,
  };
}
