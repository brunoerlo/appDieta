import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  DietLogEntry,
  FoodItem,
  MealType,
  WaterLogEntry,
  DailyNutritionSummary,
  UserProfile,
} from '../types/domain';
import { IDietRepository, IAuthRepository } from '../database/repositories/interfaces';
import {
  getTodayDateString,
  shiftDateString,
  summarizeDietLogs,
  MealGroupSummary,
} from '../utils/nutrition';

export interface DietContextValue {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  goToToday: () => void;
  goToNextDay: () => void;
  goToPreviousDay: () => void;
  dailySummary: DailyNutritionSummary;
  mealsSummary: Record<MealType, MealGroupSummary>;
  userProfile: UserProfile | null;
  waterTotalMl: number;
  waterLogs: WaterLogEntry[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  addFoodLog: (params: {
    mealType: MealType;
    food: FoodItem;
    servingGrams: number;
  }) => Promise<DietLogEntry>;
  updateFoodLog: (id: string, updates: Partial<DietLogEntry>) => Promise<void>;
  deleteFoodLog: (id: string) => Promise<void>;
  addWater: (amountMl: number) => Promise<void>;
  decrementWater: (amountMl: number) => Promise<void>;
  resetWater: () => Promise<void>;
  refresh: () => Promise<void>;
  createFood: (food: Omit<FoodItem, 'id' | 'createdAt'>) => Promise<FoodItem>;
  searchFoods: (query: string, limit?: number) => Promise<FoodItem[]>;
  getFoodByBarcode: (barcode: string) => Promise<FoodItem | null>;
}

export const DietContext = createContext<DietContextValue | null>(null);

/**
 * Headless Diet State Manager for zero-dependency testing and decoupled state coordination.
 */
export class DietStateManager {
  public selectedDate: string;
  public dailySummary: DailyNutritionSummary;
  public waterTotalMl: number;
  public waterLogs: WaterLogEntry[];
  public userProfile: UserProfile | null = null;
  public isLoading = false;
  public isRefreshing = false;
  public error: string | null = null;
  private listeners: (() => void)[] = [];

  constructor(
    private dietRepo: IDietRepository,
    private authRepo: IAuthRepository,
    initialDate?: string
  ) {
    this.selectedDate = initialDate || getTodayDateString();
    this.dailySummary = {
      date: this.selectedDate,
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalWaterMl: 0,
      meals: { breakfast: [], lunch: [], snack: [], dinner: [], supper: [] },
    };
    this.waterTotalMl = 0;
    this.waterLogs = [];
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public async loadData(options?: { silent?: boolean }): Promise<void> {
    if (!options?.silent) {
      this.isLoading = true;
      this.error = null;
      this.notify();
    }

    try {
      const [summary, waterTotal, wLogs, profile] = await Promise.all([
        this.dietRepo.getDailyNutritionSummary(this.selectedDate),
        this.dietRepo.getDailyWaterTotal(this.selectedDate),
        this.dietRepo.getWaterLogs(this.selectedDate),
        this.authRepo.getProfile(),
      ]);

      this.dailySummary = summary;
      this.waterTotalMl = waterTotal;
      this.waterLogs = wLogs;
      this.userProfile = profile;
    } catch (err: any) {
      this.error = err?.message || 'Falha ao carregar dados de nutrição';
    } finally {
      if (!options?.silent) {
        this.isLoading = false;
        this.notify();
      } else {
        this.notify();
      }
    }
  }

  public async setDate(date: string): Promise<void> {
    this.selectedDate = date;
    await this.loadData();
  }

  public async goToToday(): Promise<void> {
    await this.setDate(getTodayDateString());
  }

  public async goToNextDay(): Promise<void> {
    await this.setDate(shiftDateString(this.selectedDate, 1));
  }

  public async goToPreviousDay(): Promise<void> {
    await this.setDate(shiftDateString(this.selectedDate, -1));
  }

  public async addFoodLog({
    mealType,
    food,
    servingGrams,
  }: {
    mealType: MealType;
    food: FoodItem;
    servingGrams: number;
  }): Promise<DietLogEntry> {
    const factor = food.servingGrams > 0 ? servingGrams / food.servingGrams : 1;
    const log = await this.dietRepo.addDietLog({
      date: this.selectedDate,
      mealType,
      foodId: food.id,
      foodName: food.name,
      servingGrams,
      calories: Number((food.calories * factor).toFixed(1)),
      protein: Number((food.protein * factor).toFixed(1)),
      carbs: Number((food.carbs * factor).toFixed(1)),
      fat: Number((food.fat * factor).toFixed(1)),
    });
    await this.loadData({ silent: true });
    return log;
  }

  public async updateFoodLog(id: string, updates: Partial<DietLogEntry>): Promise<void> {
    await this.dietRepo.updateDietLog(id, updates);
    await this.loadData({ silent: true });
  }

  public async deleteFoodLog(id: string): Promise<void> {
    await this.dietRepo.deleteDietLog(id);
    await this.loadData({ silent: true });
  }

  public async addWater(amountMl: number): Promise<void> {
    // 1. Optimistic synchronous update to eliminate any UI jitter
    this.waterTotalMl += amountMl;
    this.dailySummary = {
      ...this.dailySummary,
      totalWaterMl: this.waterTotalMl,
    };
    this.notify();

    // 2. Persist to SQLite & reconcile silently in background
    try {
      await this.dietRepo.addWaterLog(this.selectedDate, amountMl);
      await this.loadData({ silent: true });
    } catch (err: any) {
      await this.loadData({ silent: true });
      this.error = err?.message || 'Falha ao registrar consumo de água';
      this.notify();
    }
  }

  public async decrementWater(amountMl: number): Promise<void> {
    // 1. Optimistic synchronous update with lower clamp at 0
    this.waterTotalMl = Math.max(0, this.waterTotalMl - amountMl);
    this.dailySummary = {
      ...this.dailySummary,
      totalWaterMl: this.waterTotalMl,
    };
    this.notify();

    // 2. Persist & reconcile silently
    try {
      await this.dietRepo.decrementWaterLog(this.selectedDate, amountMl);
      await this.loadData({ silent: true });
    } catch (err: any) {
      await this.loadData({ silent: true });
      this.error = err?.message || 'Falha ao reduzir consumo de água';
      this.notify();
    }
  }

  public async resetWater(): Promise<void> {
    // 1. Optimistic synchronous reset
    this.waterTotalMl = 0;
    this.dailySummary = {
      ...this.dailySummary,
      totalWaterMl: 0,
    };
    this.waterLogs = [];
    this.notify();

    // 2. Persist & reconcile silently
    try {
      await this.dietRepo.resetWaterLogs(this.selectedDate);
      await this.loadData({ silent: true });
    } catch (err: any) {
      await this.loadData({ silent: true });
      this.error = err?.message || 'Falha ao zerar consumo de água';
      this.notify();
    }
  }

  public async refresh(): Promise<void> {
    this.isRefreshing = true;
    this.notify();
    try {
      await this.loadData({ silent: true });
    } finally {
      this.isRefreshing = false;
      this.notify();
    }
  }

  public async createFood(food: Omit<FoodItem, 'id' | 'createdAt'>): Promise<FoodItem> {
    return this.dietRepo.createFood(food);
  }

  public async searchFoods(query: string, limit = 50): Promise<FoodItem[]> {
    return this.dietRepo.searchFoods(query, limit);
  }

  public async getFoodByBarcode(barcode: string): Promise<FoodItem | null> {
    return this.dietRepo.getFoodByBarcode(barcode);
  }

  public getMealsSummary(): Record<MealType, MealGroupSummary> {
    const allLogs = Object.values(this.dailySummary.meals).flat();
    return summarizeDietLogs(allLogs).meals;
  }
}

export interface DietProviderProps {
  children: React.ReactNode;
  dietRepo: IDietRepository;
  authRepo: IAuthRepository;
  initialDate?: string;
}

export const DietProvider: React.FC<DietProviderProps> = ({
  children,
  dietRepo,
  authRepo,
  initialDate,
}) => {
  const [selectedDate, setSelectedDateState] = useState<string>(initialDate || getTodayDateString());
  const [dailySummary, setDailySummary] = useState<DailyNutritionSummary>({
    date: selectedDate,
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalWaterMl: 0,
    meals: { breakfast: [], lunch: [], snack: [], dinner: [], supper: [] },
  });
  const [waterTotalMl, setWaterTotalMl] = useState<number>(0);
  const [waterLogs, setWaterLogs] = useState<WaterLogEntry[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (targetDate: string, options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const [summary, waterTotal, wLogs, profile] = await Promise.all([
          dietRepo.getDailyNutritionSummary(targetDate),
          dietRepo.getDailyWaterTotal(targetDate),
          dietRepo.getWaterLogs(targetDate),
          authRepo.getProfile(),
        ]);
        setDailySummary(summary);
        setWaterTotalMl(waterTotal);
        setWaterLogs(wLogs);
        setUserProfile(profile);
      } catch (err: any) {
        setError(err?.message || 'Falha ao carregar dados de nutrição');
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [dietRepo, authRepo]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [summary, waterTotal, wLogs, profile] = await Promise.all([
          dietRepo.getDailyNutritionSummary(selectedDate),
          dietRepo.getDailyWaterTotal(selectedDate),
          dietRepo.getWaterLogs(selectedDate),
          authRepo.getProfile(),
        ]);
        if (active) {
          setDailySummary(summary);
          setWaterTotalMl(waterTotal);
          setWaterLogs(wLogs);
          setUserProfile(profile);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Falha ao carregar dados de nutrição');
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [dietRepo, authRepo, selectedDate]);

  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
  }, []);

  const goToToday = useCallback(() => {
    setSelectedDateState(getTodayDateString());
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDateState((d) => shiftDateString(d, 1));
  }, []);

  const goToPreviousDay = useCallback(() => {
    setSelectedDateState((d) => shiftDateString(d, -1));
  }, []);

  const addFoodLog = useCallback(
    async ({
      mealType,
      food,
      servingGrams,
    }: {
      mealType: MealType;
      food: FoodItem;
      servingGrams: number;
    }) => {
      const factor = food.servingGrams > 0 ? servingGrams / food.servingGrams : 1;
      const log = await dietRepo.addDietLog({
        date: selectedDate,
        mealType,
        foodId: food.id,
        foodName: food.name,
        servingGrams,
        calories: Number((food.calories * factor).toFixed(1)),
        protein: Number((food.protein * factor).toFixed(1)),
        carbs: Number((food.carbs * factor).toFixed(1)),
        fat: Number((food.fat * factor).toFixed(1)),
      });
      await loadData(selectedDate, { silent: true });
      return log;
    },
    [dietRepo, selectedDate, loadData]
  );

  const updateFoodLog = useCallback(
    async (id: string, updates: Partial<DietLogEntry>) => {
      await dietRepo.updateDietLog(id, updates);
      await loadData(selectedDate, { silent: true });
    },
    [dietRepo, selectedDate, loadData]
  );

  const deleteFoodLog = useCallback(
    async (id: string) => {
      await dietRepo.deleteDietLog(id);
      await loadData(selectedDate, { silent: true });
    },
    [dietRepo, selectedDate, loadData]
  );

  const addWater = useCallback(
    async (amountMl: number) => {
      // 1. Optimistic synchronous update
      setWaterTotalMl((prev) => prev + amountMl);
      setDailySummary((prev) => ({
        ...prev,
        totalWaterMl: Math.max(0, prev.totalWaterMl + amountMl),
      }));

      // 2. Persist to DB and reconcile silently
      try {
        await dietRepo.addWaterLog(selectedDate, amountMl);
        await loadData(selectedDate, { silent: true });
      } catch (err: any) {
        await loadData(selectedDate, { silent: true });
        setError(err?.message || 'Falha ao registrar consumo de água');
      }
    },
    [dietRepo, selectedDate, loadData]
  );

  const decrementWater = useCallback(
    async (amountMl: number) => {
      // 1. Optimistic synchronous update
      setWaterTotalMl((prev) => Math.max(0, prev - amountMl));
      setDailySummary((prev) => ({
        ...prev,
        totalWaterMl: Math.max(0, prev.totalWaterMl - amountMl),
      }));

      // 2. Persist to DB and reconcile silently
      try {
        await dietRepo.decrementWaterLog(selectedDate, amountMl);
        await loadData(selectedDate, { silent: true });
      } catch (err: any) {
        await loadData(selectedDate, { silent: true });
        setError(err?.message || 'Falha ao reduzir consumo de água');
      }
    },
    [dietRepo, selectedDate, loadData]
  );

  const resetWater = useCallback(async () => {
    // 1. Optimistic synchronous update
    setWaterTotalMl(0);
    setDailySummary((prev) => ({ ...prev, totalWaterMl: 0 }));
    setWaterLogs([]);

    // 2. Persist to DB and reconcile silently
    try {
      await dietRepo.resetWaterLogs(selectedDate);
      await loadData(selectedDate, { silent: true });
    } catch (err: any) {
      await loadData(selectedDate, { silent: true });
      setError(err?.message || 'Falha ao zerar consumo de água');
    }
  }, [dietRepo, selectedDate, loadData]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadData(selectedDate, { silent: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedDate, loadData]);

  const createFood = useCallback(
    async (food: Omit<FoodItem, 'id' | 'createdAt'>) => {
      return dietRepo.createFood(food);
    },
    [dietRepo]
  );

  const searchFoods = useCallback(
    async (query: string, limit = 50) => {
      return dietRepo.searchFoods(query, limit);
    },
    [dietRepo]
  );

  const getFoodByBarcode = useCallback(
    async (barcode: string) => {
      return dietRepo.getFoodByBarcode(barcode);
    },
    [dietRepo]
  );

  const mealsSummary = useMemo(() => {
    const allLogs = Object.values(dailySummary.meals).flat();
    return summarizeDietLogs(allLogs).meals;
  }, [dailySummary.meals]);

  const value = useMemo<DietContextValue>(
    () => ({
      selectedDate,
      setSelectedDate,
      goToToday,
      goToNextDay,
      goToPreviousDay,
      dailySummary,
      mealsSummary,
      userProfile,
      waterTotalMl,
      waterLogs,
      isLoading,
      isRefreshing,
      error,
      addFoodLog,
      updateFoodLog,
      deleteFoodLog,
      addWater,
      decrementWater,
      resetWater,
      refresh,
      createFood,
      searchFoods,
      getFoodByBarcode,
    }),
    [
      selectedDate,
      setSelectedDate,
      goToToday,
      goToNextDay,
      goToPreviousDay,
      dailySummary,
      mealsSummary,
      userProfile,
      waterTotalMl,
      waterLogs,
      isLoading,
      isRefreshing,
      error,
      addFoodLog,
      updateFoodLog,
      deleteFoodLog,
      addWater,
      decrementWater,
      resetWater,
      refresh,
      createFood,
      searchFoods,
      getFoodByBarcode,
    ]
  );

  return <DietContext.Provider value={value}>{children}</DietContext.Provider>;
};
