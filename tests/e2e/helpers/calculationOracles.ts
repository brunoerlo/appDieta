/**
 * Authoritative Mathematical Oracles for IronTrack E2E Test Verification.
 * Derived from nutritional science (Atwater factors) and exercise physiology (Brzycki & Epley 1RM formulas).
 */

/**
 * Atwater general factor energy calculation:
 * 4 kcal/g protein, 4 kcal/g carbohydrate, 9 kcal/g total fat.
 */
export function calculateAtwaterCalories(proteinGrams: number, carbsGrams: number, fatGrams: number): number {
  return Math.round((proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9) * 10) / 10;
}

/**
 * Scales a nutritional macro from base per 100g to a target serving size in grams.
 */
export function scaleMacro(baseMacroPer100g: number, servingGrams: number): number {
  return Math.round(((baseMacroPer100g * servingGrams) / 100) * 10) / 10;
}

/**
 * Brzycki One-Rep Max (1RM) formula:
 * 1RM = weightKg * (36 / (37 - reps))
 * Note: Clinically standard for reps between 1 and 10.
 */
export function calculateBrzycki1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  if (reps >= 37) return weightKg; // Avoid division by zero or negative
  return Math.round((weightKg * (36 / (37 - reps))) * 10) / 10;
}

/**
 * Epley One-Rep Max (1RM) formula:
 * 1RM = weightKg * (1 + 0.0333 * reps)
 */
export function calculateEpley1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round((weightKg * (1 + 0.0333 * reps)) * 10) / 10;
}

/**
 * Total Workout Volume calculation:
 * sum of (weightKg * reps) for all completed sets.
 */
export function calculateWorkoutVolume(
  sets: { weightKg: number; reps: number; completed?: boolean }[]
): number {
  return sets
    .filter((s) => s.completed !== false)
    .reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

/**
 * 7-day rolling moving average of body weights.
 */
export function calculateExpectedMovingAverage(weights: number[]): number | null {
  if (weights.length === 0) return null;
  const sum = weights.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / weights.length) * 100) / 100;
}

/**
 * Body Composition calculations:
 * Fat Mass = weightKg * (bodyFatPct / 100)
 * Lean Mass = weightKg - Fat Mass
 */
export function calculateBodyComposition(weightKg: number, bodyFatPct: number): {
  fatMassKg: number;
  leanMassKg: number;
} {
  const fatMassKg = Math.round((weightKg * (bodyFatPct / 100)) * 10) / 10;
  const leanMassKg = Math.round((weightKg - fatMassKg) * 10) / 10;
  return { fatMassKg, leanMassKg };
}

/**
 * Net daily water volume calculation with non-negative clamping:
 * Net = max(0, sum(amounts))
 */
export function calculateNetWater(loggedAmounts: number[]): number {
  const sum = loggedAmounts.reduce((acc, val) => acc + val, 0);
  return Math.max(0, sum);
}
