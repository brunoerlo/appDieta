import { SupabaseClient } from '@supabase/supabase-js';
import { IDietRepository, ISqliteDatabase } from './interfaces';
import { SqliteDietRepository } from './SqliteDietRepository';
import { supabase as defaultSupabase } from '../../services/supabaseClient';
import { normalizeFoodText } from '../../utils/text';
import {
  DietLogEntry,
  FoodItem,
  WaterLogEntry,
  DailyNutritionSummary,
  MealType,
} from '../../types/domain';

interface DietLogRow {
  id: string;
  date: string;
  meal_type: MealType;
  food_id: string | null;
  food_name: string;
  serving_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
}

interface FoodRow {
  id: string;
  name: string;
  name_normalized: string | null;
  category: string | null;
  serving_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  barcode: string | null;
  source: 'taco' | 'openfoodfacts' | 'custom' | 'recipe';
  serving_unit_name: string | null;
  serving_unit_grams: number | null;
  created_at: string;
}

interface WaterLogRow {
  id: string;
  date: string;
  amount_ml: number;
  created_at: string;
}

function sanitizePostgrestFilterTerm(input: string): string {
  return input
    .replace(/[,().*"'\\%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function toFiniteNonNegative(val: number, fallback = 0): number {
  return Number.isFinite(val) && val >= 0 ? val : fallback;
}

export class SupabaseDietRepository implements IDietRepository {
  private localFoodRepo: SqliteDietRepository | null;

  constructor(
    private client: SupabaseClient = defaultSupabase,
    localDb?: ISqliteDatabase
  ) {
    this.localFoodRepo = localDb ? new SqliteDietRepository(localDb) : null;
  }

  private mapDietRow(row: DietLogRow): DietLogEntry {
    return {
      id: row.id,
      date: row.date,
      mealType: row.meal_type,
      foodId: row.food_id ?? undefined,
      foodName: row.food_name,
      servingGrams: row.serving_grams,
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      createdAt: row.created_at,
    };
  }

  private mapFoodRow(row: FoodRow): FoodItem {
    return {
      id: row.id,
      name: row.name,
      nameNormalized: row.name_normalized ?? undefined,
      category: row.category ?? undefined,
      servingGrams: row.serving_grams,
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      fiber: row.fiber ?? undefined,
      barcode: row.barcode ?? undefined,
      source: row.source,
      servingUnitName: row.serving_unit_name ?? undefined,
      servingUnitGrams: row.serving_unit_grams ?? undefined,
      createdAt: row.created_at,
    };
  }

  async getDailyLogs(date: string): Promise<DietLogEntry[]> {
    const { data, error } = await this.client
      .from('diet_logs')
      .select('id, date, meal_type, food_id, food_name, serving_grams, calories, protein, carbs, fat, created_at')
      .eq('date', date)
      .order('created_at', { ascending: true })
      .returns<DietLogRow[]>();

    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => this.mapDietRow(r));
  }

  async addDietLog(entry: Omit<DietLogEntry, 'id' | 'createdAt'>): Promise<DietLogEntry> {
    const { data, error } = await this.client
      .from('diet_logs')
      .insert({
        date: entry.date,
        meal_type: entry.mealType,
        food_id: entry.foodId ?? null,
        food_name: entry.foodName.trim().slice(0, 200),
        serving_grams: toFiniteNonNegative(entry.servingGrams, 100),
        calories: toFiniteNonNegative(entry.calories, 0),
        protein: toFiniteNonNegative(entry.protein, 0),
        carbs: toFiniteNonNegative(entry.carbs, 0),
        fat: toFiniteNonNegative(entry.fat, 0),
      })
      .select('id, date, meal_type, food_id, food_name, serving_grams, calories, protein, carbs, fat, created_at')
      .single<DietLogRow>();

    if (error || !data) throw new Error(error?.message ?? 'Erro ao salvar refeição.');
    return this.mapDietRow(data);
  }

  async updateDietLog(id: string, entry: Partial<DietLogEntry>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (entry.servingGrams !== undefined && Number.isFinite(entry.servingGrams)) {
      payload.serving_grams = entry.servingGrams;
    }
    if (entry.calories !== undefined && Number.isFinite(entry.calories)) {
      payload.calories = entry.calories;
    }
    if (entry.protein !== undefined && Number.isFinite(entry.protein)) {
      payload.protein = entry.protein;
    }
    if (entry.carbs !== undefined && Number.isFinite(entry.carbs)) {
      payload.carbs = entry.carbs;
    }
    if (entry.fat !== undefined && Number.isFinite(entry.fat)) {
      payload.fat = entry.fat;
    }
    if (entry.mealType !== undefined) {
      payload.meal_type = entry.mealType;
    }

    if (Object.keys(payload).length === 0) return;

    const { error } = await this.client
      .from('diet_logs')
      .update(payload)
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async deleteDietLog(id: string): Promise<void> {
    const { error } = await this.client
      .from('diet_logs')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async searchFoods(query: string, limit = 50): Promise<FoodItem[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 50)));
    const rawTrimmed = typeof query === 'string' ? query.trim() : '';
    const sanitized = sanitizePostgrestFilterTerm(rawTrimmed);

    let remoteQuery = this.client
      .from('foods')
      .select('id, name, name_normalized, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, serving_unit_name, serving_unit_grams, created_at')
      .order('name', { ascending: true })
      .limit(safeLimit);

    if (sanitized) {
      const normalized = sanitizePostgrestFilterTerm(normalizeFoodText(sanitized));
      remoteQuery = remoteQuery.or(
        `name.ilike.%${sanitized}%,name_normalized.ilike.%${normalized || sanitized}%`
      );
    }

    const remotePromise = (async () => {
      if (rawTrimmed && !sanitized) {
        return [] as FoodItem[];
      }
      try {
        const remoteRes = await remoteQuery.returns<FoodRow[]>();
        if (!remoteRes.error && remoteRes.data) {
          return remoteRes.data.map((r) => this.mapFoodRow(r));
        }
        return [];
      } catch {
        return [];
      }
    })();

    const localPromise = this.localFoodRepo
      ? this.localFoodRepo.searchFoods(rawTrimmed, safeLimit).catch(() => [] as FoodItem[])
      : Promise.resolve([] as FoodItem[]);

    const [remoteItems, localItems] = await Promise.all([remotePromise, localPromise]);

    const seen = new Set<string>();
    const merged: FoodItem[] = [];

    for (const item of [...remoteItems, ...localItems]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
      if (merged.length >= safeLimit) break;
    }

    return merged;
  }

  async getFoodByBarcode(barcode: string): Promise<FoodItem | null> {
    const cleanBarcode = typeof barcode === 'string' ? barcode.trim() : '';
    if (!cleanBarcode) return null;

    const { data, error } = await this.client
      .from('foods')
      .select('id, name, name_normalized, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, serving_unit_name, serving_unit_grams, created_at')
      .eq('barcode', cleanBarcode)
      .limit(1)
      .maybeSingle<FoodRow>();

    if (!error && data) {
      return this.mapFoodRow(data);
    }

    if (this.localFoodRepo) {
      return this.localFoodRepo.getFoodByBarcode(cleanBarcode);
    }

    if (error) throw new Error(error.message);
    return null;
  }

  async createFood(food: Omit<FoodItem, 'id' | 'createdAt'>): Promise<FoodItem> {
    const cleanName = food.name.trim().slice(0, 200);
    const nameNormalized = food.nameNormalized ?? normalizeFoodText(cleanName);

    const { data, error } = await this.client
      .from('foods')
      .insert({
        name: cleanName,
        name_normalized: nameNormalized,
        category: food.category ?? '',
        serving_grams: toFiniteNonNegative(food.servingGrams, 100),
        calories: toFiniteNonNegative(food.calories, 0),
        protein: toFiniteNonNegative(food.protein, 0),
        carbs: toFiniteNonNegative(food.carbs, 0),
        fat: toFiniteNonNegative(food.fat, 0),
        fiber: toFiniteNonNegative(food.fiber ?? 0, 0),
        barcode: food.barcode ?? null,
        source: food.source,
        serving_unit_name: food.servingUnitName ?? 'g',
        serving_unit_grams: toFiniteNonNegative(food.servingUnitGrams ?? 1, 1),
      })
      .select('id, name, name_normalized, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, serving_unit_name, serving_unit_grams, created_at')
      .single<FoodRow>();

    if (error || !data) throw new Error(error?.message ?? 'Erro ao criar alimento.');
    return this.mapFoodRow(data);
  }

  async getWaterLogs(date: string): Promise<WaterLogEntry[]> {
    const { data, error } = await this.client
      .from('water_logs')
      .select('id, date, amount_ml, created_at')
      .eq('date', date)
      .order('created_at', { ascending: true })
      .returns<WaterLogRow[]>();

    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      amountMl: r.amount_ml,
      createdAt: r.created_at,
    }));
  }

  async addWaterLog(date: string, amountMl: number): Promise<WaterLogEntry> {
    if (!Number.isFinite(amountMl) || Math.round(amountMl) === 0) {
      throw new Error('Quantidade de água inválida.');
    }
    const roundedMl = Math.max(-10000, Math.min(10000, Math.round(amountMl)));

    const { data, error } = await this.client
      .from('water_logs')
      .insert({ date, amount_ml: roundedMl })
      .select('id, date, amount_ml, created_at')
      .single<WaterLogRow>();

    if (error || !data) throw new Error(error?.message ?? 'Erro ao registrar água.');
    return {
      id: data.id,
      date: data.date,
      amountMl: data.amount_ml,
      createdAt: data.created_at,
    };
  }

  async deleteWaterLog(id: string): Promise<void> {
    const { error } = await this.client.from('water_logs').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async resetWaterLogs(date: string): Promise<void> {
    const { error } = await this.client.from('water_logs').delete().eq('date', date);
    if (error) throw new Error(error.message);
  }

  async getDailyWaterTotal(date: string): Promise<number> {
    const logs = await this.getWaterLogs(date);
    const total = logs.reduce((acc, item) => acc + item.amountMl, 0);
    return Math.max(0, total);
  }

  async decrementWaterLog(date: string, amountMl: number): Promise<WaterLogEntry | null> {
    if (!Number.isFinite(amountMl) || Math.abs(amountMl) <= 0) return null;
    const currentTotal = await this.getDailyWaterTotal(date);
    if (currentTotal <= 0) return null;
    const delta = Math.min(Math.round(Math.abs(amountMl)), currentTotal);
    if (delta <= 0) return null;
    return this.addWaterLog(date, -delta);
  }

  async getDailyNutritionSummary(date: string): Promise<DailyNutritionSummary> {
    const [logs, totalWaterMl] = await Promise.all([
      this.getDailyLogs(date),
      this.getDailyWaterTotal(date),
    ]);

    const meals: Record<MealType, DietLogEntry[]> = {
      breakfast: [],
      lunch: [],
      snack: [],
      dinner: [],
      supper: [],
    };

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    for (const log of logs) {
      if (meals[log.mealType]) {
        meals[log.mealType].push(log);
      }
      totalCalories += log.calories;
      totalProtein += log.protein;
      totalCarbs += log.carbs;
      totalFat += log.fat;
    }

    return {
      date,
      totalCalories: Number(totalCalories.toFixed(1)),
      totalProtein: Number(totalProtein.toFixed(1)),
      totalCarbs: Number(totalCarbs.toFixed(1)),
      totalFat: Number(totalFat.toFixed(1)),
      totalWaterMl,
      meals,
    };
  }
}
