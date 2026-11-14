import { IDietRepository, ISqliteDatabase } from './interfaces';
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
  user_id?: string;
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
  name_normalized?: string | null;
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
  user_id?: string;
  date: string;
  amount_ml: number;
  created_at: string;
}

export class SqliteDietRepository implements IDietRepository {
  constructor(private db: ISqliteDatabase) {}

  private async getActiveUserId(): Promise<string> {
    try {
      const row = await this.db.getFirstAsync<{ id: string }>(
        'SELECT id FROM users WHERE is_logged_in = 1 LIMIT 1;'
      );
      return row?.id || 'default_user';
    } catch {
      return 'default_user';
    }
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
    const userId = await this.getActiveUserId();
    const rows = await this.db.getAllAsync<DietLogRow>(
      `SELECT id, date, meal_type, food_id, food_name, serving_grams, calories, protein, carbs, fat, created_at
       FROM diet_logs
       WHERE user_id = ? AND date = ?
       ORDER BY created_at ASC;`,
      userId,
      date
    );
    return rows.map((r) => this.mapDietRow(r));
  }

  async addDietLog(entry: Omit<DietLogEntry, 'id' | 'createdAt'>): Promise<DietLogEntry> {
    const userId = await this.getActiveUserId();
    const id = `diet-log-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO diet_logs (id, user_id, date, meal_type, food_id, food_name, serving_grams, calories, protein, carbs, fat, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      id,
      userId,
      entry.date,
      entry.mealType,
      entry.foodId ?? null,
      entry.foodName,
      entry.servingGrams,
      entry.calories,
      entry.protein,
      entry.carbs,
      entry.fat,
      createdAt
    );

    return {
      ...entry,
      id,
      createdAt,
    };
  }

  async updateDietLog(id: string, entry: Partial<DietLogEntry>): Promise<void> {
    const userId = await this.getActiveUserId();
    const current = await this.db.getFirstAsync<DietLogRow>(
      `SELECT id, date, meal_type, food_id, food_name, serving_grams, calories, protein, carbs, fat, created_at
       FROM diet_logs
       WHERE id = ? AND user_id = ?;`,
      id,
      userId
    );
    if (!current) return;

    await this.db.runAsync(
      `UPDATE diet_logs SET
         serving_grams = ?,
         calories = ?,
         protein = ?,
         carbs = ?,
         fat = ?,
         meal_type = ?
       WHERE id = ? AND user_id = ?;`,
      entry.servingGrams !== undefined ? entry.servingGrams : current.serving_grams,
      entry.calories !== undefined ? entry.calories : current.calories,
      entry.protein !== undefined ? entry.protein : current.protein,
      entry.carbs !== undefined ? entry.carbs : current.carbs,
      entry.fat !== undefined ? entry.fat : current.fat,
      entry.mealType !== undefined ? entry.mealType : current.meal_type,
      id,
      userId
    );
  }

  async deleteDietLog(id: string): Promise<void> {
    const userId = await this.getActiveUserId();
    await this.db.runAsync(`DELETE FROM diet_logs WHERE id = ? AND user_id = ?;`, id, userId);
  }

  async searchFoods(query: string, limit = 50): Promise<FoodItem[]> {
    const sanitized = query.trim();
    const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 50)));
    if (!sanitized) {
      const topLimit = safeLimit === 50 ? 30 : Math.min(safeLimit, 100);
      const rows = await this.db.getAllAsync<FoodRow>(
        `SELECT id, name, name_normalized, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, serving_unit_name, serving_unit_grams, created_at
         FROM foods
         ORDER BY
           CASE
             WHEN category = 'Refeições' THEN 0
             WHEN category = 'Bebidas' THEN 1
             ELSE 2
           END,
           name ASC
         LIMIT ?;`,
        topLimit
      );
      return rows.map((r) => this.mapFoodRow(r));
    }

    const normalized = normalizeFoodText(sanitized);
    const wildcardRaw = `%${sanitized}%`;
    const prefixRaw = `${sanitized}%`;
    const wildcardNorm = `%${normalized}%`;
    const prefixNorm = `${normalized}%`;

    const rows = await this.db.getAllAsync<FoodRow>(
      `SELECT id, name, name_normalized, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, serving_unit_name, serving_unit_grams, created_at
       FROM foods
       WHERE name LIKE ? OR (name_normalized IS NOT NULL AND name_normalized LIKE ?)
       ORDER BY
         CASE
           WHEN name LIKE ? OR (name_normalized IS NOT NULL AND name_normalized LIKE ?) THEN 1
           ELSE 2
         END,
         name ASC
       LIMIT ?;`,
      wildcardRaw,
      wildcardNorm,
      prefixRaw,
      prefixNorm,
      safeLimit
    );

    return rows.map((r) => this.mapFoodRow(r));
  }

  async getFoodByBarcode(barcode: string): Promise<FoodItem | null> {
    const row = await this.db.getFirstAsync<FoodRow>(
      `SELECT id, name, name_normalized, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, serving_unit_name, serving_unit_grams, created_at
       FROM foods
       WHERE barcode = ?
       LIMIT 1;`,
      barcode.trim()
    );

    return row ? this.mapFoodRow(row) : null;
  }

  async createFood(food: Omit<FoodItem, 'id' | 'createdAt'>): Promise<FoodItem> {
    const prefix = food.category === 'Bebidas' ? 'drink' : 'food';
    const id = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();
    const nameNormalized = food.nameNormalized ?? normalizeFoodText(food.name);

    await this.db.runAsync(
      `INSERT INTO foods (id, name, name_normalized, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, serving_unit_name, serving_unit_grams, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      id,
      food.name,
      nameNormalized,
      food.category ?? '',
      food.servingGrams,
      food.calories,
      food.protein,
      food.carbs,
      food.fat,
      food.fiber ?? 0,
      food.barcode ?? null,
      food.source,
      food.servingUnitName ?? 'g',
      food.servingUnitGrams ?? 1,
      createdAt
    );

    return {
      ...food,
      id,
      nameNormalized,
      createdAt,
    };
  }

  async getWaterLogs(date: string): Promise<WaterLogEntry[]> {
    const userId = await this.getActiveUserId();
    const rows = await this.db.getAllAsync<WaterLogRow>(
      `SELECT id, date, amount_ml, created_at
       FROM water_logs
       WHERE user_id = ? AND date = ?
       ORDER BY created_at ASC;`,
      userId,
      date
    );

    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      amountMl: r.amount_ml,
      createdAt: r.created_at,
    }));
  }

  async addWaterLog(date: string, amountMl: number): Promise<WaterLogEntry> {
    const userId = await this.getActiveUserId();
    const id = `water-log-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO water_logs (id, user_id, date, amount_ml, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      id,
      userId,
      date,
      amountMl,
      createdAt
    );

    return { id, date, amountMl, createdAt };
  }

  async deleteWaterLog(id: string): Promise<void> {
    const userId = await this.getActiveUserId();
    await this.db.runAsync(`DELETE FROM water_logs WHERE id = ? AND user_id = ?;`, id, userId);
  }

  async resetWaterLogs(date: string): Promise<void> {
    const userId = await this.getActiveUserId();
    await this.db.runAsync(`DELETE FROM water_logs WHERE user_id = ? AND date = ?;`, userId, date);
  }

  async getDailyWaterTotal(date: string): Promise<number> {
    const userId = await this.getActiveUserId();
    const row = await this.db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(amount_ml) as total FROM water_logs WHERE user_id = ? AND date = ?;`,
      userId,
      date
    );
    return Math.max(0, row?.total ?? 0);
  }

  async decrementWaterLog(date: string, amountMl: number): Promise<WaterLogEntry | null> {
    const currentTotal = await this.getDailyWaterTotal(date);
    if (currentTotal <= 0) return null;
    const delta = Math.min(Math.abs(amountMl), currentTotal);
    return this.addWaterLog(date, -delta);
  }

  async getDailyNutritionSummary(date: string): Promise<DailyNutritionSummary> {
    const logs = await this.getDailyLogs(date);
    const totalWaterMl = await this.getDailyWaterTotal(date);

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
      totalCalories += log.calories;
      totalProtein += log.protein;
      totalCarbs += log.carbs;
      totalFat += log.fat;

      if (meals[log.mealType]) {
        meals[log.mealType].push(log);
      }
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
