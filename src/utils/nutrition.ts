import { DietLogEntry, MealType } from '../types/domain';
import { normalizeFoodText } from './text';

export interface MacroProfile {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface MealGroupSummary {
  mealType: MealType;
  displayName: string;
  items: DietLogEntry[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const MEAL_TYPE_NAMES: Record<MealType, string> = {
  breakfast: 'Café da Manhã',
  lunch: 'Almoço',
  snack: 'Lanche',
  dinner: 'Jantar',
  supper: 'Ceia',
};

/**
 * Normalizes text by removing diacritics/accents and converting to lowercase.
 */
export function normalizeFoodName(name: string): string {
  return normalizeFoodText(name);
}

/**
 * Scales calories and macronutrients proportionally to target serving grams.
 */
export function scaleMacros(
  baseGrams: number,
  targetGrams: number,
  baseMacros: MacroProfile
): MacroProfile {
  if (baseGrams <= 0 || targetGrams <= 0) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: baseMacros.fiber !== undefined ? 0 : undefined,
    };
  }
  const factor = targetGrams / baseGrams;
  return {
    calories: Number((baseMacros.calories * factor).toFixed(1)),
    protein: Number((baseMacros.protein * factor).toFixed(1)),
    carbs: Number((baseMacros.carbs * factor).toFixed(1)),
    fat: Number((baseMacros.fat * factor).toFixed(1)),
    fiber: baseMacros.fiber !== undefined ? Number((baseMacros.fiber * factor).toFixed(1)) : undefined,
  };
}

/**
 * Computes theoretical Atwater energy in kcal: (P * 4) + (C * 4) + (F * 9).
 */
export function calculateAtwaterCalories(protein: number, carbs: number, fat: number): number {
  return Number(((protein * 4) + (carbs * 4) + (fat * 9)).toFixed(1));
}

/**
 * Checks whether reported calories match Atwater factors within a tolerance percentage (default ±15%).
 */
export function isAtwaterConsistent(
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  tolerancePercent = 15
): boolean {
  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) return true;
  const atwater = calculateAtwaterCalories(protein, carbs, fat);
  if (calories === 0) return atwater === 0;
  const diff = Math.abs(calories - atwater);
  const percentDiff = (diff / calories) * 100;
  return percentDiff <= tolerancePercent;
}

/**
 * Aggregates a list of diet logs into totals and meal-grouped summaries.
 */
export function summarizeDietLogs(logs: DietLogEntry[]): {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: Record<MealType, MealGroupSummary>;
} {
  const mealTypes: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner', 'supper'];
  const meals = mealTypes.reduce((acc, mt) => {
    acc[mt] = {
      mealType: mt,
      displayName: MEAL_TYPE_NAMES[mt],
      items: [],
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    return acc;
  }, {} as Record<MealType, MealGroupSummary>);

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const log of logs) {
    totalCalories += log.calories;
    totalProtein += log.protein;
    totalCarbs += log.carbs;
    totalFat += log.fat;

    if (meals[log.mealType]) {
      meals[log.mealType].items.push(log);
      meals[log.mealType].calories += log.calories;
      meals[log.mealType].protein += log.protein;
      meals[log.mealType].carbs += log.carbs;
      meals[log.mealType].fat += log.fat;
    }
  }

  // Round values
  for (const mt of mealTypes) {
    meals[mt].calories = Number(meals[mt].calories.toFixed(1));
    meals[mt].protein = Number(meals[mt].protein.toFixed(1));
    meals[mt].carbs = Number(meals[mt].carbs.toFixed(1));
    meals[mt].fat = Number(meals[mt].fat.toFixed(1));
  }

  return {
    totalCalories: Number(totalCalories.toFixed(1)),
    totalProtein: Number(totalProtein.toFixed(1)),
    totalCarbs: Number(totalCarbs.toFixed(1)),
    totalFat: Number(totalFat.toFixed(1)),
    meals,
  };
}

/**
 * Date manipulation utilities (YYYY-MM-DD).
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
