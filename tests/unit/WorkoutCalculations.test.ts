import {
  calculateBrzycki1RM,
  calculateEpley1RM,
  calculate1RM,
  calculateWorkoutVolume,
  formatElapsedSeconds,
  formatDurationMinutes,
  formatRestTimerDisplay,
  formatPreviousLoad,
  mapExerciseHistoryToChart,
} from '@/utils/workout';
import { SetLog, ExerciseHistoryPoint } from '@/types/domain';

describe('Unit: WorkoutCalculations & Formatting Utilities', () => {
  describe('calculateBrzycki1RM', () => {
    it('calculates accurate 1RM for standard rep ranges', () => {
      // 100 * (36 / 27) = 133.333... -> 133.3
      expect(calculateBrzycki1RM(100, 10)).toBe(133.3);
      // 80 * (36 / 32) = 90.0
      expect(calculateBrzycki1RM(80, 5)).toBe(90.0);
    });

    it('returns exact weight when reps is 1', () => {
      expect(calculateBrzycki1RM(120, 1)).toBe(120.0);
      expect(calculateBrzycki1RM(62.5, 1)).toBe(62.5);
    });

    it('returns 0 for zero or negative values', () => {
      expect(calculateBrzycki1RM(0, 10)).toBe(0);
      expect(calculateBrzycki1RM(-50, 10)).toBe(0);
      expect(calculateBrzycki1RM(100, 0)).toBe(0);
      expect(calculateBrzycki1RM(100, -5)).toBe(0);
    });

    it('safely clamps high reps to avoid asymptote division by zero', () => {
      // 37 reps would cause division by zero if unclamped.
      // With clamping to 30: 100 * (36 / 7) = 514.285... -> 514.3
      expect(calculateBrzycki1RM(100, 37)).toBe(514.3);
      expect(calculateBrzycki1RM(100, 50)).toBe(514.3);
    });
  });

  describe('calculateEpley1RM', () => {
    it('calculates accurate 1RM using Epley formula', () => {
      // 100 * (1 + 0.333) = 133.3
      expect(calculateEpley1RM(100, 10)).toBe(133.3);
      // 80 * (1 + 0.0333 * 5) = 80 * 1.1665 = 93.32 -> 93.3
      expect(calculateEpley1RM(80, 5)).toBe(93.3);
    });

    it('returns exact weight for 1 rep', () => {
      expect(calculateEpley1RM(140, 1)).toBe(140.0);
    });

    it('returns 0 for zero or negative values', () => {
      expect(calculateEpley1RM(0, 8)).toBe(0);
      expect(calculateEpley1RM(-80, 8)).toBe(0);
      expect(calculateEpley1RM(80, 0)).toBe(0);
      expect(calculateEpley1RM(80, -2)).toBe(0);
    });
  });

  describe('calculate1RM selector', () => {
    it('uses Brzycki by default', () => {
      expect(calculate1RM(80, 5)).toBe(calculateBrzycki1RM(80, 5));
    });

    it('uses Epley when explicitly specified', () => {
      expect(calculate1RM(80, 5, 'epley')).toBe(calculateEpley1RM(80, 5));
    });
  });

  describe('calculateWorkoutVolume', () => {
    it('sums volume of completed sets', () => {
      const sets = [
        { weightKg: 80, reps: 10, completed: true },
        { weightKg: 85, reps: 8, completed: true },
        { weightKg: 90, reps: 6, completed: true },
      ];
      // 800 + 680 + 540 = 2020
      expect(calculateWorkoutVolume(sets)).toBe(2020);
    });

    it('ignores uncompleted sets', () => {
      const sets = [
        { weightKg: 100, reps: 10, completed: true }, // 1000
        { weightKg: 100, reps: 10, completed: false }, // 0
      ];
      expect(calculateWorkoutVolume(sets)).toBe(1000);
    });

    it('handles empty sets array and treats undefined completed as true', () => {
      expect(calculateWorkoutVolume([])).toBe(0);
      expect(calculateWorkoutVolume([{ weightKg: 50, reps: 10 }])).toBe(500);
    });

    it('clamps negative weight or reps to 0', () => {
      const sets = [
        { weightKg: -50, reps: 10, completed: true },
        { weightKg: 50, reps: -10, completed: true },
        { weightKg: 50, reps: 10, completed: true },
      ];
      expect(calculateWorkoutVolume(sets)).toBe(500);
    });
  });

  describe('formatElapsedSeconds', () => {
    it('formats seconds into MM:SS for durations under an hour', () => {
      expect(formatElapsedSeconds(0)).toBe('00:00');
      expect(formatElapsedSeconds(5)).toBe('00:05');
      expect(formatElapsedSeconds(65)).toBe('01:05');
      expect(formatElapsedSeconds(599)).toBe('09:59');
    });

    it('formats seconds into HH:MM:SS for durations over an hour', () => {
      expect(formatElapsedSeconds(3600)).toBe('01:00:00');
      expect(formatElapsedSeconds(3665)).toBe('01:01:05');
      expect(formatElapsedSeconds(7322)).toBe('02:02:02');
    });

    it('handles negative or zero input safely', () => {
      expect(formatElapsedSeconds(-10)).toBe('00:00');
    });
  });

  describe('formatDurationMinutes', () => {
    it('formats durations in minutes correctly', () => {
      expect(formatDurationMinutes(0)).toBe('0 min');
      expect(formatDurationMinutes(45)).toBe('45 min');
      expect(formatDurationMinutes(60)).toBe('1h');
      expect(formatDurationMinutes(75)).toBe('1h 15m');
      expect(formatDurationMinutes(120)).toBe('2h');
      expect(formatDurationMinutes(130)).toBe('2h 10m');
    });

    it('handles negative input safely', () => {
      expect(formatDurationMinutes(-5)).toBe('0 min');
    });
  });

  describe('formatRestTimerDisplay', () => {
    it('formats countdown seconds in MM:SS', () => {
      expect(formatRestTimerDisplay(0)).toBe('00:00');
      expect(formatRestTimerDisplay(15)).toBe('00:15');
      expect(formatRestTimerDisplay(90)).toBe('01:30');
      expect(formatRestTimerDisplay(120)).toBe('02:00');
    });

    it('ceils fractional seconds', () => {
      expect(formatRestTimerDisplay(59.2)).toBe('01:00');
    });
  });

  describe('formatPreviousLoad', () => {
    const mockPreviousSets: SetLog[] = [
      {
        id: 's1',
        sessionId: 'sess-1',
        exerciseName: 'Supino Reto',
        setNumber: 1,
        weightKg: 80,
        reps: 10,
        completed: true,
        createdAt: '2026-11-01',
      },
      {
        id: 's2',
        sessionId: 'sess-1',
        exerciseName: 'Supino Reto',
        setNumber: 2,
        weightKg: 85,
        reps: 8,
        completed: true,
        createdAt: '2026-11-01',
      },
    ];

    it('formats exact matching set', () => {
      expect(formatPreviousLoad(mockPreviousSets, 1)).toBe('80kg × 10');
      expect(formatPreviousLoad(mockPreviousSets, 2)).toBe('85kg × 8');
    });

    it('falls back to last recorded set if currentSetNumber exceeds previous count', () => {
      expect(formatPreviousLoad(mockPreviousSets, 3)).toBe('85kg × 8');
      expect(formatPreviousLoad(mockPreviousSets, 4)).toBe('85kg × 8');
    });

    it('returns dash if previous sets array is empty or undefined', () => {
      expect(formatPreviousLoad([], 1)).toBe('—');
      expect(formatPreviousLoad(undefined, 1)).toBe('—');
    });
  });

  describe('mapExerciseHistoryToChart', () => {
    const mockPoints: ExerciseHistoryPoint[] = [
      {
        date: '2026-11-03',
        maxWeightKg: 85,
        totalVolumeKg: 2040,
        estimated1RM: 104.2,
        bestSetReps: 8,
      },
      {
        date: '2026-10-25',
        maxWeightKg: 80,
        totalVolumeKg: 1920,
        estimated1RM: 98.1,
        bestSetReps: 8,
      },
      {
        date: '2026-11-05',
        maxWeightKg: 90,
        totalVolumeKg: 2160,
        estimated1RM: 110.5,
        bestSetReps: 8,
      },
    ];

    it('sorts points chronologically and maps coordinates', () => {
      const chart = mapExerciseHistoryToChart(mockPoints);

      expect(chart.labels).toEqual(['25/10', '03/11', '05/11']);
      expect(chart.maxWeights).toEqual([80, 85, 90]);
      expect(chart.estimated1RMs).toEqual([98.1, 104.2, 110.5]);
      expect(chart.volumes).toEqual([1920, 2040, 2160]);
      expect(chart.personalRecord).toEqual({
        maxWeight: 90,
        max1RM: 110.5,
        prDate: '2026-11-05',
      });
    });

    it('handles empty points safely', () => {
      const chart = mapExerciseHistoryToChart([]);
      expect(chart.labels).toEqual([]);
      expect(chart.maxWeights).toEqual([]);
      expect(chart.estimated1RMs).toEqual([]);
      expect(chart.volumes).toEqual([]);
      expect(chart.personalRecord).toEqual({
        maxWeight: 0,
        max1RM: 0,
        prDate: null,
      });
    });
  });
});
