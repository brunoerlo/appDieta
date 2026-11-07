import {
  scaleMacros,
  calculateAtwaterCalories,
  isAtwaterConsistent,
  normalizeFoodName,
  summarizeDietLogs,
  getTodayDateString,
  shiftDateString,
} from '@/utils/nutrition';
import { DietLogEntry } from '@/types/domain';

describe('Unit: Nutrition Calculations & Text Normalization', () => {
  describe('scaleMacros', () => {
    const baseChicken = {
      calories: 159,
      protein: 32.0,
      carbs: 0.0,
      fat: 2.5,
      fiber: 0.0,
    };

    it('scales macros proportionally from 100g to 150g (factor 1.5)', () => {
      const scaled = scaleMacros(100, 150, baseChicken);
      expect(scaled.calories).toBe(238.5);
      expect(scaled.protein).toBe(48.0);
      expect(scaled.carbs).toBe(0.0);
      expect(scaled.fat).toBe(3.8); // 2.5 * 1.5 = 3.75 -> 3.8
      expect(scaled.fiber).toBe(0.0);
    });

    it('scales macros proportionally down from 100g to 70g (factor 0.7)', () => {
      const scaled = scaleMacros(100, 70, baseChicken);
      expect(scaled.calories).toBe(111.3);
      expect(scaled.protein).toBe(22.4);
      expect(scaled.carbs).toBe(0.0);
      expect(scaled.fat).toBe(1.8); // 2.5 * 0.7 = 1.75 -> 1.8
    });

    it('returns zeros without NaN when target serving is 0g', () => {
      const scaled = scaleMacros(100, 0, baseChicken);
      expect(scaled.calories).toBe(0);
      expect(scaled.protein).toBe(0);
      expect(scaled.carbs).toBe(0);
      expect(scaled.fat).toBe(0);
    });

    it('clamps negative base or target grams to zeros', () => {
      const scaledNegativeTarget = scaleMacros(100, -50, baseChicken);
      expect(scaledNegativeTarget.calories).toBe(0);

      const scaledNegativeBase = scaleMacros(-100, 50, baseChicken);
      expect(scaledNegativeBase.calories).toBe(0);
    });

    it('preserves optional fiber field when present and undefined when absent', () => {
      const withFiber = scaleMacros(100, 200, {
        calories: 100,
        protein: 5,
        carbs: 20,
        fat: 1,
        fiber: 3.5,
      });
      expect(withFiber.fiber).toBe(7.0);

      const withoutFiber = scaleMacros(100, 200, {
        calories: 100,
        protein: 5,
        carbs: 20,
        fat: 1,
      });
      expect(withoutFiber.fiber).toBeUndefined();
    });
  });

  describe('calculateAtwaterCalories & isAtwaterConsistent', () => {
    it('calculates theoretical Atwater energy correctly (4*P + 4*C + 9*F)', () => {
      // 30g Protein (120 kcal) + 40g Carbs (160 kcal) + 10g Fat (90 kcal) = 370 kcal
      const atwater = calculateAtwaterCalories(30, 40, 10);
      expect(atwater).toBe(370);
    });

    it('validates TACO foods within default 15% tolerance', () => {
      // Egg: 146 kcal, 13.3g P, 0.6g C, 9.5g F -> Atwater = (13.3*4) + (0.6*4) + (9.5*9) = 53.2 + 2.4 + 85.5 = 141.1 kcal
      const consistent = isAtwaterConsistent(146, 13.3, 0.6, 9.5);
      expect(consistent).toBe(true);
    });

    it('detects fabricated foods with gross calorie divergence', () => {
      // Claiming 100 kcal with 50g protein (already 200 kcal Atwater)
      const consistent = isAtwaterConsistent(100, 50, 0, 0);
      expect(consistent).toBe(false);
    });

    it('treats zero macros and zero calories as consistent', () => {
      expect(isAtwaterConsistent(0, 0, 0, 0)).toBe(true);
    });
  });

  describe('normalizeFoodName', () => {
    it('strips accents and converts to lowercase', () => {
      expect(normalizeFoodName('Pão Francês')).toBe('pao frances');
      expect(normalizeFoodName('Maçã Fuji')).toBe('maca fuji');
      expect(normalizeFoodName('Açaí')).toBe('acai');
    });

    it('handles uppercase accented strings', () => {
      expect(normalizeFoodName('PÃO DE FORMA INTEGRAL')).toBe('pao de forma integral');
      expect(normalizeFoodName('FEIJÃO CARIOCA')).toBe('feijao carioca');
    });

    it('handles empty and whitespace-only strings', () => {
      expect(normalizeFoodName('')).toBe('');
      expect(normalizeFoodName('   ')).toBe('');
    });
  });

  describe('summarizeDietLogs', () => {
    it('groups logs into 5 meals and computes meal and daily totals', () => {
      const logs: DietLogEntry[] = [
        {
          id: '1',
          date: '2026-11-06',
          mealType: 'breakfast',
          foodName: 'Ovo',
          servingGrams: 100,
          calories: 146,
          protein: 13.3,
          carbs: 0.6,
          fat: 9.5,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          date: '2026-11-06',
          mealType: 'lunch',
          foodName: 'Frango',
          servingGrams: 150,
          calories: 238.5,
          protein: 48.0,
          carbs: 0.0,
          fat: 3.8,
          createdAt: new Date().toISOString(),
        },
      ];

      const summary = summarizeDietLogs(logs);

      expect(summary.totalCalories).toBe(384.5);
      expect(summary.totalProtein).toBe(61.3);
      expect(summary.totalCarbs).toBe(0.6);
      expect(summary.totalFat).toBe(13.3);

      expect(summary.meals.breakfast.items.length).toBe(1);
      expect(summary.meals.breakfast.calories).toBe(146);
      expect(summary.meals.lunch.items.length).toBe(1);
      expect(summary.meals.lunch.calories).toBe(238.5);
      expect(summary.meals.dinner.items.length).toBe(0);
      expect(summary.meals.dinner.calories).toBe(0);
    });
  });

  describe('date utilities', () => {
    it('getTodayDateString returns YYYY-MM-DD pattern', () => {
      const today = getTodayDateString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('shiftDateString advances and rewinds dates accurately across month boundaries', () => {
      expect(shiftDateString('2026-11-06', 1)).toBe('2026-11-07');
      expect(shiftDateString('2026-11-06', -1)).toBe('2026-11-05');
      expect(shiftDateString('2026-11-30', 1)).toBe('2026-12-01');
      expect(shiftDateString('2026-12-01', -1)).toBe('2026-11-30');
      expect(shiftDateString('2026-12-31', 1)).toBe('2027-01-01');
    });
  });
});
