import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
    date?: string;
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

function createEmptyDailySummary(date: string): DailyNutritionSummary {
  return {
    date,
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalWaterMl: 0,
    meals: { breakfast: [], lunch: [], snack: [], dinner: [], supper: [] },
  };
}

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
  private loadRequestId = 0;

  constructor(
    private dietRepo: IDietRepository,
    private authRepo: IAuthRepository,
    initialDate?: string
  ) {
    this.selectedDate = initialDate || getTodayDateString();
    this.dailySummary = createEmptyDailySummary(this.selectedDate);
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
    const reqId = ++this.loadRequestId;
    const targetDate = this.selectedDate;

    if (!options?.silent) {
      this.isLoading = true;
      this.error = null;
      this.notify();
    }

    try {
      const [summary, waterTotal, wLogs, profile] = await Promise.all([
        this.dietRepo.getDailyNutritionSummary(targetDate),
        this.dietRepo.getDailyWaterTotal(targetDate),
        this.dietRepo.getWaterLogs(targetDate),
        this.authRepo.getProfile(),
      ]);

      if (reqId !== this.loadRequestId || targetDate !== this.selectedDate) {
        return;
      }

      this.dailySummary = summary;
      this.waterTotalMl = waterTotal;
      this.waterLogs = wLogs;
      this.userProfile = profile;
    } catch (err: any) {
      if (reqId !== this.loadRequestId) {
        return;
      }
      this.error = err?.message || 'Falha ao carregar dados de nutrição';
    } finally {
      if (reqId === this.loadRequestId) {
        if (!options?.silent) {
          this.isLoading = false;
        }
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
    date,
  }: {
    mealType: MealType;
    food: FoodItem;
    servingGrams: number;
    date?: string;
  }): Promise<DietLogEntry> {
    if (!Number.isFinite(servingGrams) || servingGrams <= 0) {
      throw new Error('A porção em gramas/ml deve ser maior que zero.');
    }
    const baseServing =
      Number.isFinite(food.servingGrams) && food.servingGrams > 0 ? food.servingGrams : 100;
    const factor = servingGrams / baseServing;
    const targetDate = date || this.selectedDate;
    const safeCal = Number.isFinite(food.calories) ? food.calories : 0;
    const safeProt = Number.isFinite(food.protein) ? food.protein : 0;
    const safeCarbs = Number.isFinite(food.carbs) ? food.carbs : 0;
    const safeFat = Number.isFinite(food.fat) ? food.fat : 0;

    const log = await this.dietRepo.addDietLog({
      date: targetDate,
      mealType,
      foodId: food.id,
      foodName: food.name,
      servingGrams,
      calories: Number((safeCal * factor).toFixed(1)),
      protein: Number((safeProt * factor).toFixed(1)),
      carbs: Number((safeCarbs * factor).toFixed(1)),
      fat: Number((safeFat * factor).toFixed(1)),
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
    if (!Number.isFinite(amountMl) || amountMl <= 0) return;
    const prevWater = this.waterTotalMl;

    // 1. Optimistic synchronous update to eliminate any UI jitter
    this.waterTotalMl = prevWater + amountMl;
    this.dailySummary = {
      ...this.dailySummary,
      totalWaterMl: this.waterTotalMl,
    };
    this.notify();

    // 2. Persist to DB & reconcile silently in background
    try {
      await this.dietRepo.addWaterLog(this.selectedDate, amountMl);
      await this.loadData({ silent: true });
    } catch (err: any) {
      this.waterTotalMl = prevWater;
      this.dailySummary = {
        ...this.dailySummary,
        totalWaterMl: prevWater,
      };
      await this.loadData({ silent: true });
      this.error = err?.message || 'Falha ao registrar consumo de água';
      this.notify();
    }
  }

  public async decrementWater(amountMl: number): Promise<void> {
    if (!Number.isFinite(amountMl) || amountMl <= 0) return;
    const prevWater = this.waterTotalMl;

    // 1. Optimistic synchronous update with lower clamp at 0
    this.waterTotalMl = Math.max(0, prevWater - amountMl);
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
      this.waterTotalMl = prevWater;
      this.dailySummary = {
        ...this.dailySummary,
        totalWaterMl: prevWater,
      };
      await this.loadData({ silent: true });
      this.error = err?.message || 'Falha ao reduzir consumo de água';
      this.notify();
    }
  }

  public async resetWater(): Promise<void> {
    const prevWater = this.waterTotalMl;
    const prevLogs = this.waterLogs;

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
      this.waterTotalMl = prevWater;
      this.dailySummary = {
        ...this.dailySummary,
        totalWaterMl: prevWater,
      };
      this.waterLogs = prevLogs;
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
  userKey?: string;
  enabled?: boolean;
}

export const DietProvider: React.FC<DietProviderProps> = ({
  children,
  dietRepo,
  authRepo,
  initialDate,
  userKey,
  enabled = true,
}) => {
  const [selectedDate, setSelectedDateState] = useState<string>(initialDate || getTodayDateString());
  const [dailySummary, setDailySummary] = useState<DailyNutritionSummary>(() =>
    createEmptyDailySummary(selectedDate)
  );
  const [waterTotalMl, setWaterTotalMl] = useState<number>(0);
  const [waterLogs, setWaterLogs] = useState<WaterLogEntry[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequestIdRef = useRef(0);
  const selectedDateRef = useRef(selectedDate);

  const loadData = useCallback(
    async (targetDate: string, options?: { silent?: boolean }) => {
      if (!enabled) {
        setDailySummary(createEmptyDailySummary(targetDate));
        setWaterTotalMl(0);
        setWaterLogs([]);
        setUserProfile(null);
        setIsLoading(false);
        return;
      }

      const reqId = ++loadRequestIdRef.current;
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

        if (reqId !== loadRequestIdRef.current || targetDate !== selectedDateRef.current) {
          return;
        }

        setDailySummary(summary);
        setWaterTotalMl(waterTotal);
        setWaterLogs(wLogs);
        setUserProfile(profile);
      } catch (err: any) {
        if (reqId !== loadRequestIdRef.current) {
          return;
        }
        setError(err?.message || 'Falha ao carregar dados de nutrição');
      } finally {
        if (reqId === loadRequestIdRef.current && !options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [dietRepo, authRepo, enabled]
  );

  useEffect(() => {
    selectedDateRef.current = selectedDate;
    void userKey;
    let active = true;
    (async () => {
      await Promise.resolve();
      if (active) {
        await loadData(selectedDate);
      }
    })();
    return () => {
      active = false;
      loadRequestIdRef.current += 1;
    };
  }, [loadData, selectedDate, userKey]);

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
      date,
    }: {
      mealType: MealType;
      food: FoodItem;
      servingGrams: number;
      date?: string;
    }) => {
      if (!Number.isFinite(servingGrams) || servingGrams <= 0) {
        throw new Error('A porção em gramas/ml deve ser maior que zero.');
      }
      const baseServing =
        Number.isFinite(food.servingGrams) && food.servingGrams > 0 ? food.servingGrams : 100;
      const factor = servingGrams / baseServing;
      const targetDate = date || selectedDate;
      const safeCal = Number.isFinite(food.calories) ? food.calories : 0;
      const safeProt = Number.isFinite(food.protein) ? food.protein : 0;
      const safeCarbs = Number.isFinite(food.carbs) ? food.carbs : 0;
      const safeFat = Number.isFinite(food.fat) ? food.fat : 0;

      const log = await dietRepo.addDietLog({
        date: targetDate,
        mealType,
        foodId: food.id,
        foodName: food.name,
        servingGrams,
        calories: Number((safeCal * factor).toFixed(1)),
        protein: Number((safeProt * factor).toFixed(1)),
        carbs: Number((safeCarbs * factor).toFixed(1)),
        fat: Number((safeFat * factor).toFixed(1)),
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
      if (!Number.isFinite(amountMl) || amountMl <= 0) return;
      const prevWater = waterTotalMl;

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
        setWaterTotalMl(prevWater);
        setDailySummary((prev) => ({
          ...prev,
          totalWaterMl: prevWater,
        }));
        await loadData(selectedDate, { silent: true });
        setError(err?.message || 'Falha ao registrar consumo de água');
      }
    },
    [dietRepo, selectedDate, loadData, waterTotalMl]
  );

  const decrementWater = useCallback(
    async (amountMl: number) => {
      if (!Number.isFinite(amountMl) || amountMl <= 0) return;
      const prevWater = waterTotalMl;

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
        setWaterTotalMl(prevWater);
        setDailySummary((prev) => ({
          ...prev,
          totalWaterMl: prevWater,
        }));
        await loadData(selectedDate, { silent: true });
        setError(err?.message || 'Falha ao reduzir consumo de água');
      }
    },
    [dietRepo, selectedDate, loadData, waterTotalMl]
  );

  const resetWater = useCallback(async () => {
    const prevWater = waterTotalMl;
    const prevLogs = waterLogs;

    // 1. Optimistic synchronous update
    setWaterTotalMl(0);
    setDailySummary((prev) => ({ ...prev, totalWaterMl: 0 }));
    setWaterLogs([]);

    // 2. Persist to DB and reconcile silently
    try {
      await dietRepo.resetWaterLogs(selectedDate);
      await loadData(selectedDate, { silent: true });
    } catch (err: any) {
      setWaterTotalMl(prevWater);
      setDailySummary((prev) => ({ ...prev, totalWaterMl: prevWater }));
      setWaterLogs(prevLogs);
      await loadData(selectedDate, { silent: true });
      setError(err?.message || 'Falha ao zerar consumo de água');
    }
  }, [dietRepo, selectedDate, loadData, waterTotalMl, waterLogs]);

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
