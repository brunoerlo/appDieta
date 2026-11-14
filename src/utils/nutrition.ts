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
 * Safely parses a user-entered numeric string (supporting pt-BR comma decimals),
 * rejecting malformed strings, Infinity, or NaN.
 */
export function parseDecimalInput(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value !== 'string') {
    return NaN;
  }
  const normalized = value.trim().replace(',', '.');
  if (!normalized || !/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(normalized)) {
    return NaN;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

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
  if (
    !Number.isFinite(baseGrams) ||
    !Number.isFinite(targetGrams) ||
    baseGrams <= 0 ||
    targetGrams <= 0
  ) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: baseMacros.fiber !== undefined ? 0 : undefined,
    };
  }
  const factor = targetGrams / baseGrams;
  const safeCal = Number.isFinite(baseMacros.calories) ? baseMacros.calories : 0;
  const safeProt = Number.isFinite(baseMacros.protein) ? baseMacros.protein : 0;
  const safeCarbs = Number.isFinite(baseMacros.carbs) ? baseMacros.carbs : 0;
  const safeFat = Number.isFinite(baseMacros.fat) ? baseMacros.fat : 0;
  const safeFiber =
    baseMacros.fiber !== undefined && Number.isFinite(baseMacros.fiber)
      ? Number((baseMacros.fiber * factor).toFixed(1))
      : baseMacros.fiber !== undefined
      ? 0
      : undefined;

  return {
    calories: Number((safeCal * factor).toFixed(1)),
    protein: Number((safeProt * factor).toFixed(1)),
    carbs: Number((safeCarbs * factor).toFixed(1)),
    fat: Number((safeFat * factor).toFixed(1)),
    fiber: safeFiber,
  };
}

/**
 * Computes theoretical Atwater energy in kcal: (P * 4) + (C * 4) + (F * 9).
 */
export function calculateAtwaterCalories(protein: number, carbs: number, fat: number): number {
  const p = Number.isFinite(protein) ? protein : 0;
  const c = Number.isFinite(carbs) ? carbs : 0;
  const f = Number.isFinite(fat) ? fat : 0;
  return Number(((p * 4) + (c * 4) + (f * 9)).toFixed(1));
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
  if (
    !Number.isFinite(calories) ||
    !Number.isFinite(protein) ||
    !Number.isFinite(carbs) ||
    !Number.isFinite(fat) ||
    !Number.isFinite(tolerancePercent) ||
    calories < 0 ||
    protein < 0 ||
    carbs < 0 ||
    fat < 0
  ) {
    return false;
  }
  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) return true;
  const atwater = calculateAtwaterCalories(protein, carbs, fat);
  if (calories <= 0) return atwater === 0;
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
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts.map(Number);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(days)
  ) {
    return dateStr;
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return dateStr;
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface SuggestedTargetsInput {
  weightKg: number;
  heightCm: number;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  trainingGoal: 'hypertrophy' | 'cutting' | 'maintenance' | string;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'intense' | 'very_active' | string;
}

export interface SuggestedTargetsResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  bmr: number;
  tdee: number;
}

/**
 * Calculates scientifically suggested nutritional and hydration targets based on:
 * - BMR: Mifflin-St Jeor formula
 * - TDEE: Activity multipliers
 * - Goal modulation: Hypertrophy (+12%), Cutting (-18%), Maintenance (0%)
 * - Macro distribution: High protein (1.8-2.2g/kg), healthy fat (~0.9g/kg), remainder to carbs
 * - Water: 35-50 ml/kg based on activity level
 */
export function calculateSuggestedTargets(input: SuggestedTargetsInput): SuggestedTargetsResult {
  const rawWeight =
    Number.isFinite(input.weightKg) && input.weightKg > 0 ? input.weightKg : 70;
  const rawHeight =
    Number.isFinite(input.heightCm) && input.heightCm > 0 ? input.heightCm : 175;
  const rawAge =
    input.age !== undefined && Number.isFinite(input.age) && input.age > 0 ? input.age : 25;

  const weight = Math.max(30, Math.min(250, rawWeight));
  const height = Math.max(100, Math.min(230, rawHeight));
  const age = Math.max(10, Math.min(120, rawAge));
  const genderConst = input.gender === 'female' ? -161 : 5;

  // 1. BMR (Mifflin-St Jeor)
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + genderConst);

  // 2. Activity Multiplier
  const activityMap: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    intense: 1.725,
    very_active: 1.9,
  };
  const multiplier = activityMap[input.activityLevel] || 1.55;
  const tdee = Math.round(bmr * multiplier);

  // 3. Goal Adjustment
  let goalFactor = 1.0;
  let proteinPerKg = 1.8;
  const goal = (input.trainingGoal || '').toLowerCase();
  if (goal === 'hypertrophy' || goal === 'hipertrofia') {
    goalFactor = 1.12; // +12% surplus
    proteinPerKg = 2.0;
  } else if (goal === 'cutting' || goal === 'definição' || goal === 'definicao') {
    goalFactor = 0.82; // -18% deficit
    proteinPerKg = 2.2;
  }
  const rawCalories = Math.max(1200, Math.round(tdee * goalFactor));
  let calories = Math.round(rawCalories / 50) * 50;

  // 4. Protein & Fat
  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.max(40, Math.min(110, Math.round(weight * 0.9)));

  // Ensure calories accommodate baseline macros and minimum 50g carbs
  const minRequiredCalories = (protein * 4) + (fat * 9) + (50 * 4);
  if (calories < minRequiredCalories) {
    calories = Math.ceil(minRequiredCalories / 50) * 50;
  }

  // 5. Carbs (remainder)
  const remainingKcal = calories - (protein * 4 + fat * 9);
  const carbs = Math.max(50, Math.round(remainingKcal / 4));

  // 6. Water (ml)
  const waterRateMap: Record<string, number> = {
    sedentary: 35,
    light: 38,
    moderate: 40,
    intense: 45,
    very_active: 50,
  };
  const waterRate = waterRateMap[input.activityLevel] || 40;
  const rawWater = weight * waterRate;
  const waterMl = Math.max(2000, Math.min(5000, Math.round(rawWater / 250) * 250));

  return {
    calories,
    protein,
    carbs,
    fat,
    waterMl,
    bmr,
    tdee,
  };
}

/**
 * Detects whether a food item or log entry represents a liquid / beverage.
 * Matches beverage category, drink ID prefix, unit name containing 'ml',
 * or common beverage keywords in Portuguese (suco, café, leite, etc.).
 */
export function isBeverageEntry(entry: {
  foodId?: string;
  foodName?: string;
  id?: string;
  name?: string;
  category?: string;
  servingUnitName?: string;
}): boolean {
  if (entry.foodId?.startsWith('drink-') || entry.id?.startsWith('drink-')) {
    return true;
  }
  if (entry.category === 'Bebidas') {
    return true;
  }
  if (entry.servingUnitName && entry.servingUnitName.toLowerCase().includes('ml')) {
    return true;
  }

  const rawName = entry.foodName || entry.name || '';
  if (!rawName) return false;

  const lower = rawName.toLowerCase();
  const normalized = normalizeFoodText(rawName);

  // Handle solid/canned exceptions (e.g. "Atum em água", "Doce de leite", "Leite em pó")
  if (/\bem\s+agua\b/.test(normalized)) {
    return false;
  }
  if (/\b(doce de leite|leite em po)\b/.test(normalized)) {
    return false;
  }

  // Standalone keywords with word boundaries on normalized text
  const keywordRegex =
    /\b(suco|sucos|cafe|cafes|leite|leites|refrigerante|refrigerantes|agua|aguas|cerveja|cervejas|bebida|bebidas|shake|shakes|cha|chas|vitamina|vitaminas|whey|isotonic|isotonico|isotonicos|energetico|energeticos|drink|drinks|kombucha|kombuchas|guarana|coca|cola|pepsi|vinho|vinhos|gatorade|limonada|mate|red bull|cappuccino|espresso|caldo de cana)\b/;

  if (keywordRegex.test(normalized)) {
    return true;
  }

  // Match explicit volume notation (e.g., "(300ml)" or "200 ml")
  if (/\b\d+\s*ml\b/i.test(lower)) {
    return true;
  }

  return false;
}

/**
 * Returns the source badge label for a food item according to category and source priority.
 * Bebidas must take precedence over recipe / meal checks.
 */
export function getFoodBadgeLabel(item: {
  category?: string;
  source: string;
}): 'Bebida' | 'Refeição' | 'TACO' | 'OFF' | 'Custom' | null {
  if (item.category === 'Bebidas') {
    return 'Bebida';
  }
  if (item.category === 'Refeições' || item.source === 'recipe') {
    return 'Refeição';
  }
  switch (item.source) {
    case 'taco':
      return 'TACO';
    case 'openfoodfacts':
      return 'OFF';
    case 'custom':
      return 'Custom';
    default:
      return null;
  }
}

