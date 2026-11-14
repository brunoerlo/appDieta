import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BodyLog, WeightHistoryPoint } from '../types/domain';
import { IBodyRepository } from '../database/repositories/interfaces';
import {
  shiftDateString,
  calculateBodyComposition,
  BodyCompositionResult,
} from '../utils/body';
import { getTodayDateString } from '../utils/nutrition';
import { PhotoStorageService } from '../services/PhotoStorageService';

export type ChartRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface BodyContextValue {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  goToToday: () => void;
  goToNextDay: () => void;
  goToPreviousDay: () => void;

  currentBodyLog: BodyLog | null;
  currentMovingAverage: number | null;
  currentComposition: BodyCompositionResult | null;

  weightHistory: WeightHistoryPoint[];
  chartRange: ChartRange;
  setChartRange: (range: ChartRange) => Promise<void>;

  photos: { date: string; uri: string }[];

  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  saveWeighIn: (weightKg: number, date?: string) => Promise<BodyLog>;
  saveMeasurements: (
    measurements: {
      bodyFatPct?: number;
      waistCm?: number;
      chestCm?: number;
      armsCm?: number;
      legsCm?: number;
    },
    date?: string
  ) => Promise<BodyLog>;
  savePhoto: (photoUri: string, date?: string) => Promise<string[]>;
  deletePhoto: (photoUri: string, date?: string) => Promise<string[]>;
  refresh: () => Promise<void>;
  getBodyLog: (date: string) => Promise<BodyLog | null>;
}

export const BodyContext = createContext<BodyContextValue | null>(null);

/**
 * Headless Body State Manager for decoupled testing and fast state coordination.
 */
export class BodyStateManager {
  public selectedDate: string;
  public currentBodyLog: BodyLog | null = null;
  public currentMovingAverage: number | null = null;
  public currentComposition: BodyCompositionResult | null = null;
  public weightHistory: WeightHistoryPoint[] = [];
  public chartRange: ChartRange = '1M';
  public photos: { date: string; uri: string }[] = [];
  public isLoading = false;
  public isRefreshing = false;
  public error: string | null = null;
  private listeners: (() => void)[] = [];
  private loadRequestId = 0;
  private mutationQueue: Promise<any> = Promise.resolve();

  constructor(
    private bodyRepo: IBodyRepository,
    initialDate?: string
  ) {
    this.selectedDate = initialDate || getTodayDateString();
  }

  private enqueueMutation<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.mutationQueue.then(fn, fn);
    this.mutationQueue = next.catch(() => {});
    return next;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        // Ignore listener error
      }
    }
  }

  public setSelectedDate(date: string) {
    this.selectedDate = date;
    this.loadData();
  }

  public goToToday() {
    this.setSelectedDate(getTodayDateString());
  }

  public goToNextDay() {
    this.setSelectedDate(shiftDateString(this.selectedDate, 1));
  }

  public goToPreviousDay() {
    this.setSelectedDate(shiftDateString(this.selectedDate, -1));
  }

  public async setChartRange(range: ChartRange): Promise<void> {
    this.chartRange = range;
    await this.loadWeightHistory();
    this.notify();
  }

  private getStartDateForRange(range: ChartRange, baseDate = this.selectedDate): string | undefined {
    switch (range) {
      case '1M':
        return shiftDateString(baseDate, -30);
      case '3M':
        return shiftDateString(baseDate, -90);
      case '6M':
        return shiftDateString(baseDate, -180);
      case '1Y':
        return shiftDateString(baseDate, -365);
      case 'ALL':
      default:
        return undefined;
    }
  }

  public async loadWeightHistory(): Promise<void> {
    const startDate = this.getStartDateForRange(this.chartRange);
    this.weightHistory = await this.bodyRepo.getWeightHistory(startDate, undefined);
  }

  public async loadData(options?: { silent?: boolean }): Promise<void> {
    const reqId = ++this.loadRequestId;
    const targetDate = this.selectedDate;
    const targetRange = this.chartRange;

    if (!options?.silent) {
      this.isLoading = true;
      this.error = null;
      this.notify();
    }

    try {
      const startDate = this.getStartDateForRange(targetRange, targetDate);
      const [log, ma, photos, history] = await Promise.all([
        this.bodyRepo.getBodyLog(targetDate),
        this.bodyRepo.calculateMovingAverage(targetDate, 7),
        this.bodyRepo.getPhotos(),
        this.bodyRepo.getWeightHistory(startDate, undefined),
      ]);

      if (reqId !== this.loadRequestId || targetDate !== this.selectedDate) {
        return;
      }

      this.currentBodyLog = log;
      this.currentMovingAverage = ma;
      this.photos = photos;
      this.weightHistory = history;

      if (log && log.weightKg > 0) {
        this.currentComposition = calculateBodyComposition(log.weightKg, log.bodyFatPct);
      } else {
        this.currentComposition = null;
      }
    } catch (err: any) {
      if (reqId !== this.loadRequestId) {
        return;
      }
      this.error = err?.message || 'Falha ao carregar dados corporais';
    } finally {
      if (reqId === this.loadRequestId) {
        if (!options?.silent) {
          this.isLoading = false;
        }
        this.notify();
      }
    }
  }

  /**
   * Merge-on-Save weigh-in: preserves existing circumferences and photos (serialized)
   */
  public async saveWeighIn(weightKg: number, targetDate?: string): Promise<BodyLog> {
    const date = targetDate || this.selectedDate;
    const saved = await this.enqueueMutation(async () => {
      const existing = await this.bodyRepo.getBodyLog(date);
      return this.bodyRepo.saveBodyLog({
        date,
        weightKg,
        bodyFatPct: existing?.bodyFatPct,
        waistCm: existing?.waistCm,
        chestCm: existing?.chestCm,
        armsCm: existing?.armsCm,
        legsCm: existing?.legsCm,
        photoUris: existing?.photoUris ?? [],
      });
    });
    await this.loadData({ silent: true });
    return saved;
  }

  /**
   * Merge-on-Save measurements: preserves weight and photos (serialized)
   */
  public async saveMeasurements(
    measurements: {
      bodyFatPct?: number;
      waistCm?: number;
      chestCm?: number;
      armsCm?: number;
      legsCm?: number;
    },
    targetDate?: string
  ): Promise<BodyLog> {
    const date = targetDate || this.selectedDate;
    const saved = await this.enqueueMutation(async () => {
      const existing = await this.bodyRepo.getBodyLog(date);
      return this.bodyRepo.saveBodyLog({
        date,
        weightKg: existing?.weightKg ?? 0,
        bodyFatPct:
          measurements.bodyFatPct !== undefined ? measurements.bodyFatPct : existing?.bodyFatPct,
        waistCm: measurements.waistCm !== undefined ? measurements.waistCm : existing?.waistCm,
        chestCm: measurements.chestCm !== undefined ? measurements.chestCm : existing?.chestCm,
        armsCm: measurements.armsCm !== undefined ? measurements.armsCm : existing?.armsCm,
        legsCm: measurements.legsCm !== undefined ? measurements.legsCm : existing?.legsCm,
        photoUris: existing?.photoUris ?? [],
      });
    });
    await this.loadData({ silent: true });
    return saved;
  }

  public async savePhoto(photoUri: string, targetDate?: string): Promise<string[]> {
    const date = targetDate || this.selectedDate;
    const uris = await this.enqueueMutation(() => this.bodyRepo.savePhoto(date, photoUri));
    await this.loadData({ silent: true });
    return uris;
  }

  public async deletePhoto(photoUri: string, targetDate?: string): Promise<string[]> {
    const date = targetDate || this.selectedDate;
    const uris = await this.enqueueMutation(async () => {
      const remaining = await this.bodyRepo.deletePhoto(date, photoUri);
      await PhotoStorageService.deletePhotoFile(photoUri);
      return remaining;
    });
    await this.loadData({ silent: true });
    return uris;
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

  public async getBodyLog(date: string): Promise<BodyLog | null> {
    return this.bodyRepo.getBodyLog(date);
  }
}

export interface BodyProviderProps {
  children: React.ReactNode;
  bodyRepo: IBodyRepository;
  initialDate?: string;
  userKey?: string;
  enabled?: boolean;
}

export const BodyProvider: React.FC<BodyProviderProps> = ({
  children,
  bodyRepo,
  initialDate,
  userKey,
  enabled = true,
}) => {
  const [selectedDate, setSelectedDateState] = useState<string>(initialDate || getTodayDateString());
  const [currentBodyLog, setCurrentBodyLog] = useState<BodyLog | null>(null);
  const [currentMovingAverage, setCurrentMovingAverage] = useState<number | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightHistoryPoint[]>([]);
  const [chartRange, setChartRangeState] = useState<ChartRange>('1M');
  const [photos, setPhotos] = useState<{ date: string; uri: string }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequestIdRef = useRef(0);
  const selectedDateRef = useRef(selectedDate);
  const mutationQueueRef = useRef<Promise<any>>(Promise.resolve());

  const enqueueMutation = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = mutationQueueRef.current.then(fn, fn);
    mutationQueueRef.current = next.catch(() => {});
    return next;
  }, []);

  const getStartDateForRange = useCallback(
    (range: ChartRange, baseDate: string): string | undefined => {
      switch (range) {
        case '1M':
          return shiftDateString(baseDate, -30);
        case '3M':
          return shiftDateString(baseDate, -90);
        case '6M':
          return shiftDateString(baseDate, -180);
        case '1Y':
          return shiftDateString(baseDate, -365);
        case 'ALL':
        default:
          return undefined;
      }
    },
    []
  );

  const loadData = useCallback(
    async (date: string, range: ChartRange, options?: { silent?: boolean }) => {
      if (!enabled) {
        setCurrentBodyLog(null);
        setCurrentMovingAverage(null);
        setWeightHistory([]);
        setPhotos([]);
        setIsLoading(false);
        return;
      }

      const reqId = ++loadRequestIdRef.current;
      if (!options?.silent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const startDate = getStartDateForRange(range, date);
        const [log, ma, history, pList] = await Promise.all([
          bodyRepo.getBodyLog(date),
          bodyRepo.calculateMovingAverage(date, 7),
          bodyRepo.getWeightHistory(startDate, undefined),
          bodyRepo.getPhotos(),
        ]);

        if (reqId !== loadRequestIdRef.current || date !== selectedDateRef.current) {
          return;
        }

        setCurrentBodyLog(log);
        setCurrentMovingAverage(ma);
        setWeightHistory(history);
        setPhotos(pList);
      } catch (err: any) {
        if (reqId !== loadRequestIdRef.current) {
          return;
        }
        setError(err?.message || 'Falha ao carregar dados corporais');
      } finally {
        if (reqId === loadRequestIdRef.current && !options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [bodyRepo, getStartDateForRange, enabled]
  );

  useEffect(() => {
    selectedDateRef.current = selectedDate;
    void userKey;
    let active = true;
    (async () => {
      await Promise.resolve();
      if (active) {
        await loadData(selectedDate, chartRange);
      }
    })();
    return () => {
      active = false;
      loadRequestIdRef.current += 1;
    };
  }, [loadData, selectedDate, chartRange, userKey]);

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

  const setChartRange = useCallback(async (range: ChartRange) => {
    setChartRangeState(range);
  }, []);

  const saveWeighIn = useCallback(
    async (weightKg: number, targetDate?: string) => {
      const date = targetDate || selectedDate;
      const saved = await enqueueMutation(async () => {
        const existing = await bodyRepo.getBodyLog(date);
        return bodyRepo.saveBodyLog({
          date,
          weightKg,
          bodyFatPct: existing?.bodyFatPct,
          waistCm: existing?.waistCm,
          chestCm: existing?.chestCm,
          armsCm: existing?.armsCm,
          legsCm: existing?.legsCm,
          photoUris: existing?.photoUris ?? [],
        });
      });
      await loadData(selectedDate, chartRange, { silent: true });
      return saved;
    },
    [bodyRepo, selectedDate, chartRange, loadData, enqueueMutation]
  );

  const saveMeasurements = useCallback(
    async (
      measurements: {
        bodyFatPct?: number;
        waistCm?: number;
        chestCm?: number;
        armsCm?: number;
        legsCm?: number;
      },
      targetDate?: string
    ) => {
      const date = targetDate || selectedDate;
      const saved = await enqueueMutation(async () => {
        const existing = await bodyRepo.getBodyLog(date);
        return bodyRepo.saveBodyLog({
          date,
          weightKg: existing?.weightKg ?? 0,
          bodyFatPct:
            measurements.bodyFatPct !== undefined ? measurements.bodyFatPct : existing?.bodyFatPct,
          waistCm: measurements.waistCm !== undefined ? measurements.waistCm : existing?.waistCm,
          chestCm: measurements.chestCm !== undefined ? measurements.chestCm : existing?.chestCm,
          armsCm: measurements.armsCm !== undefined ? measurements.armsCm : existing?.armsCm,
          legsCm: measurements.legsCm !== undefined ? measurements.legsCm : existing?.legsCm,
          photoUris: existing?.photoUris ?? [],
        });
      });
      await loadData(selectedDate, chartRange, { silent: true });
      return saved;
    },
    [bodyRepo, selectedDate, chartRange, loadData, enqueueMutation]
  );

  const savePhoto = useCallback(
    async (photoUri: string, targetDate?: string) => {
      const date = targetDate || selectedDate;
      const uris = await enqueueMutation(() => bodyRepo.savePhoto(date, photoUri));
      await loadData(selectedDate, chartRange, { silent: true });
      return uris;
    },
    [bodyRepo, selectedDate, chartRange, loadData, enqueueMutation]
  );

  const deletePhoto = useCallback(
    async (photoUri: string, targetDate?: string) => {
      const date = targetDate || selectedDate;
      const uris = await enqueueMutation(async () => {
        const remaining = await bodyRepo.deletePhoto(date, photoUri);
        await PhotoStorageService.deletePhotoFile(photoUri);
        return remaining;
      });
      await loadData(selectedDate, chartRange, { silent: true });
      return uris;
    },
    [bodyRepo, selectedDate, chartRange, loadData, enqueueMutation]
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadData(selectedDate, chartRange, { silent: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData, selectedDate, chartRange]);

  const getBodyLog = useCallback(
    async (date: string) => {
      return bodyRepo.getBodyLog(date);
    },
    [bodyRepo]
  );

  const currentComposition = useMemo(() => {
    if (!currentBodyLog || currentBodyLog.weightKg <= 0) return null;
    return calculateBodyComposition(currentBodyLog.weightKg, currentBodyLog.bodyFatPct);
  }, [currentBodyLog]);

  const value = useMemo<BodyContextValue>(
    () => ({
      selectedDate,
      setSelectedDate,
      goToToday,
      goToNextDay,
      goToPreviousDay,
      currentBodyLog,
      currentMovingAverage,
      currentComposition,
      weightHistory,
      chartRange,
      setChartRange,
      photos,
      isLoading,
      isRefreshing,
      error,
      saveWeighIn,
      saveMeasurements,
      savePhoto,
      deletePhoto,
      refresh,
      getBodyLog,
    }),
    [
      selectedDate,
      setSelectedDate,
      goToToday,
      goToNextDay,
      goToPreviousDay,
      currentBodyLog,
      currentMovingAverage,
      currentComposition,
      weightHistory,
      chartRange,
      setChartRange,
      photos,
      isLoading,
      isRefreshing,
      error,
      saveWeighIn,
      saveMeasurements,
      savePhoto,
      deletePhoto,
      refresh,
      getBodyLog,
    ]
  );

  return <BodyContext.Provider value={value}>{children}</BodyContext.Provider>;
};
