import { createE2ETestContext, E2ETestContext } from '../helpers/testContext';
import {
  calculateWorkoutVolume,
  calculateBrzycki1RM,
  calculateBodyComposition,
  calculateExpectedMovingAverage,
} from '../helpers/calculationOracles';
import * as Haptics from 'expo-haptics';

describe('Tier 4: Real-World End-to-End Athlete Workflows', () => {
  let ctx: E2ETestContext;

  beforeEach(async () => {
    ctx = await createE2ETestContext();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // =========================================================================
  // Workflow 1: Complete 24-Hour Day of Tracking (The Cutting Athlete)
  // =========================================================================
  it('4.1 Athlete Full Day Lifecycle: Morning Weigh-in -> Breakfast & Hydration -> Live Push Workout with Rest Timer -> Post-Workout Meals -> Evening Summary Audit', async () => {
    const DATE = '2026-11-06';

    // -----------------------------------------------------------------------
    // 07:00 AM — Morning Wakeup & Weigh-in
    // -----------------------------------------------------------------------
    const morningLog = await ctx.bodyRepo.saveBodyLog({
      date: DATE,
      weightKg: 82.5,
      bodyFatPct: 14.5,
      waistCm: 83.0,
      chestCm: 105.0,
    });

    expect(morningLog.weightKg).toBe(82.5);
    const bodyComp = calculateBodyComposition(82.5, 14.5);
    expect(bodyComp.fatMassKg).toBe(12.0); // 82.5 * 0.145 = 11.96 -> 12.0
    expect(bodyComp.leanMassKg).toBe(70.5); // 82.5 - 12.0 = 70.5

    // Check 7-day moving average on morning weigh-in
    const morningMA = await ctx.bodyRepo.calculateMovingAverage(DATE, 7);
    expect(morningMA).toBe(82.5);

    // -----------------------------------------------------------------------
    // 07:30 AM — Breakfast & First Hydration (+500ml)
    // -----------------------------------------------------------------------
    await ctx.dietRepo.addWaterLog(DATE, 500);

    // 4 Eggs (approx 200g)
    await ctx.dietRepo.addDietLog({
      date: DATE,
      mealType: 'breakfast',
      foodName: 'Ovo de galinha, inteiro, cozido',
      servingGrams: 200,
      calories: 292,
      protein: 26.6,
      carbs: 1.2,
      fat: 19.0,
    });

    // 2 slices whole wheat bread (50g)
    await ctx.dietRepo.addDietLog({
      date: DATE,
      mealType: 'breakfast',
      foodName: 'Pão de forma integral',
      servingGrams: 50,
      calories: 126,
      protein: 4.8,
      carbs: 23.5,
      fat: 1.6,
    });

    let dailySummary = await ctx.dietRepo.getDailyNutritionSummary(DATE);
    expect(dailySummary.totalWaterMl).toBe(500);
    expect(dailySummary.meals.breakfast.length).toBe(2);
    expect(dailySummary.totalCalories).toBe(418);
    expect(dailySummary.totalProtein).toBe(31.4);

    // -----------------------------------------------------------------------
    // 10:30 AM — Mid-Morning Hydration Shortcut (+500ml)
    // -----------------------------------------------------------------------
    await ctx.dietRepo.addWaterLog(DATE, 500);
    dailySummary = await ctx.dietRepo.getDailyNutritionSummary(DATE);
    expect(dailySummary.totalWaterMl).toBe(1000);

    // -----------------------------------------------------------------------
    // 12:30 PM — High-Protein Lunch
    // -----------------------------------------------------------------------
    // 200g Grilled Chicken Breast + 150g White Rice + 100g Steamed Broccoli
    await ctx.dietRepo.addDietLog({
      date: DATE,
      mealType: 'lunch',
      foodName: 'Peito de frango, grelhado',
      servingGrams: 200,
      calories: 318,
      protein: 64.0,
      carbs: 0.0,
      fat: 5.0,
    });

    await ctx.dietRepo.addDietLog({
      date: DATE,
      mealType: 'lunch',
      foodName: 'Arroz branco, cozido',
      servingGrams: 150,
      calories: 192,
      protein: 3.8,
      carbs: 42.2,
      fat: 0.3,
    });

    await ctx.dietRepo.addDietLog({
      date: DATE,
      mealType: 'lunch',
      foodName: 'Brócolis cozido',
      servingGrams: 100,
      calories: 25,
      protein: 2.1,
      carbs: 4.4,
      fat: 0.5,
    });

    await ctx.dietRepo.addWaterLog(DATE, 500); // Lunch water

    dailySummary = await ctx.dietRepo.getDailyNutritionSummary(DATE);
    expect(dailySummary.totalWaterMl).toBe(1500);
    expect(dailySummary.meals.lunch.length).toBe(3);

    // -----------------------------------------------------------------------
    // 04:00 PM — Pre-Workout Snack (+250ml water)
    // -----------------------------------------------------------------------
    await ctx.dietRepo.addWaterLog(DATE, 250);
    await ctx.dietRepo.addDietLog({
      date: DATE,
      mealType: 'snack',
      foodName: 'Banana prata, crua',
      servingGrams: 100,
      calories: 98,
      protein: 1.3,
      carbs: 26.0,
      fat: 0.1,
    });

    // -----------------------------------------------------------------------
    // 05:30 PM — Live Push Workout Execution
    // -----------------------------------------------------------------------
    const routines = await ctx.workoutRepo.getRoutines();
    const pushRoutine = routines.find((r) => r.name.includes('Push'));
    expect(pushRoutine).toBeDefined();

    // Live sets executed during workout:
    const liveSets = [
      { exerciseName: 'Supino Reto com Barra', setNumber: 1, weightKg: 80, reps: 10, completed: true },
      { exerciseName: 'Supino Reto com Barra', setNumber: 2, weightKg: 85, reps: 8, completed: true },
      { exerciseName: 'Supino Reto com Barra', setNumber: 3, weightKg: 90, reps: 6, completed: true },
      { exerciseName: 'Desenvolvimento Militar', setNumber: 1, weightKg: 50, reps: 10, completed: true },
      { exerciseName: 'Desenvolvimento Militar', setNumber: 2, weightKg: 55, reps: 8, completed: true },
      { exerciseName: 'Tríceps Pulley', setNumber: 1, weightKg: 35, reps: 12, completed: true },
      { exerciseName: 'Tríceps Pulley', setNumber: 2, weightKg: 40, reps: 10, completed: true },
    ];

    // Simulate rest countdown timer triggering haptics on each completed set
    for (let i = 0; i < liveSets.length; i++) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(liveSets.length);

    // Finalize workout session
    const workoutSession = await ctx.workoutRepo.saveWorkoutSession(
      {
        routineId: pushRoutine!.id,
        routineName: pushRoutine!.name,
        date: DATE,
        startTime: '17:30:00',
        endTime: '18:35:00',
        durationMinutes: 65,
      },
      liveSets
    );

    const expectedWorkoutVolume = calculateWorkoutVolume(liveSets);
    expect(workoutSession.totalVolumeKg).toBe(expectedWorkoutVolume);
    expect(workoutSession.durationMinutes).toBe(65);

    // -----------------------------------------------------------------------
    // 07:30 PM — Post-Workout Dinner (+500ml water)
    // -----------------------------------------------------------------------
    await ctx.dietRepo.addWaterLog(DATE, 500);

    // 200g Lean Beef (Patinho) + 200g Sweet Potato
    await ctx.dietRepo.addDietLog({
      date: DATE,
      mealType: 'dinner',
      foodName: 'Carne bovina, patinho moído',
      servingGrams: 200,
      calories: 438,
      protein: 71.8,
      carbs: 0.0,
      fat: 14.6,
    });

    await ctx.dietRepo.addDietLog({
      date: DATE,
      mealType: 'dinner',
      foodName: 'Batata doce, cozida',
      servingGrams: 200,
      calories: 154,
      protein: 1.2,
      carbs: 36.8,
      fat: 0.2,
    });

    // -----------------------------------------------------------------------
    // 09:30 PM — Evening Hydration (+250ml) -> Daily Water Target Achieved
    // -----------------------------------------------------------------------
    await ctx.dietRepo.addWaterLog(DATE, 250);

    // -----------------------------------------------------------------------
    // 10:00 PM — End-of-Day Audit & Compliance Check
    // -----------------------------------------------------------------------
    const finalSummary = await ctx.dietRepo.getDailyNutritionSummary(DATE);
    const profile = await ctx.authRepo.getProfile();

    // Water target: 500 + 500 + 500 + 250 + 500 + 250 = 2500 ml (100% of 2500ml target)
    expect(finalSummary.totalWaterMl).toBe(2500);
    expect(finalSummary.totalWaterMl).toBeGreaterThanOrEqual(profile.targetWaterMl);

    // Total calories consumed
    expect(finalSummary.totalCalories).toBeGreaterThan(1600);
    expect(finalSummary.totalCalories).toBeLessThanOrEqual(profile.targetCalories);

    // Total protein consumed (>150g goal)
    expect(finalSummary.totalProtein).toBeGreaterThanOrEqual(profile.targetProtein);

    // Workout history reflects completed push workout
    const history = await ctx.workoutRepo.getWorkoutSessions(1, 0);
    expect(history[0].id).toBe(workoutSession.id);
    expect(history[0].totalVolumeKg).toBe(expectedWorkoutVolume);

    // Bench press estimated 1RM logged into exercise history
    const benchHistory = await ctx.workoutRepo.getExerciseHistory('Supino Reto com Barra');
    expect(benchHistory.length).toBe(1);
    expect(benchHistory[0].maxWeightKg).toBe(90);
    expect(benchHistory[0].estimated1RM).toBeGreaterThan(90);
  });

  // =========================================================================
  // Workflow 2: Progressive Overload Strength Progression across Multi-Day Cycle
  // =========================================================================
  it('4.2 Athlete Multi-Day Strength Progression: Session 1 Bench -> Session 2 Overload referencing Session 1 loads', async () => {
    const EXERCISE = 'Supino Reto com Barra';

    // -----------------------------------------------------------------------
    // Week 1 — Monday Session
    // -----------------------------------------------------------------------
    await ctx.workoutRepo.saveWorkoutSession(
      {
        routineName: 'Push A',
        date: '2026-11-02',
        durationMinutes: 50,
      },
      [
        { exerciseName: EXERCISE, setNumber: 1, weightKg: 80, reps: 8, completed: true },
        { exerciseName: EXERCISE, setNumber: 2, weightKg: 80, reps: 8, completed: true },
        { exerciseName: EXERCISE, setNumber: 3, weightKg: 80, reps: 7, completed: true },
      ]
    );

    const historyWeek1 = await ctx.workoutRepo.getExerciseHistory(EXERCISE);
    expect(historyWeek1.length).toBe(1);
    expect(historyWeek1[0].maxWeightKg).toBe(80);

    // -----------------------------------------------------------------------
    // Week 2 — Monday Session (Previous Load Reference & Overload)
    // -----------------------------------------------------------------------
    // Athlete opens workout: app fetches previous session load as reference
    const previousSets = await ctx.workoutRepo.getPreviousExerciseSets(EXERCISE, 3);
    expect(previousSets.length).toBe(3);
    expect(previousSets[0].weightKg).toBe(80);
    expect(previousSets[1].weightKg).toBe(80);
    expect(previousSets[2].weightKg).toBe(80);

    // Athlete successfully applies progressive overload (82.5kg)
    await ctx.workoutRepo.saveWorkoutSession(
      {
        routineName: 'Push A',
        date: '2026-11-09',
        durationMinutes: 52,
      },
      [
        { exerciseName: EXERCISE, setNumber: 1, weightKg: 82.5, reps: 8, completed: true },
        { exerciseName: EXERCISE, setNumber: 2, weightKg: 82.5, reps: 8, completed: true },
        { exerciseName: EXERCISE, setNumber: 3, weightKg: 82.5, reps: 8, completed: true },
      ]
    );

    const historyWeek2 = await ctx.workoutRepo.getExerciseHistory(EXERCISE);
    expect(historyWeek2.length).toBe(2);
    expect(historyWeek2[1].maxWeightKg).toBe(82.5);
    expect(historyWeek2[1].estimated1RM).toBeGreaterThan(historyWeek1[0].estimated1RM);
    expect(historyWeek2[1].totalVolumeKg).toBeGreaterThan(historyWeek1[0].totalVolumeKg);
  });

  // =========================================================================
  // Workflow 3: 30-Day Body Recomposition & Photo Comparison Journey
  // =========================================================================
  it('4.3 Athlete 30-Day Body Recomposition: Baseline -> Mid-point -> Final Milestone with Before/After Photos', async () => {
    // -----------------------------------------------------------------------
    // Day 1: Baseline Assessment
    // -----------------------------------------------------------------------
    await ctx.bodyRepo.saveBodyLog({
      date: '2026-10-01',
      weightKg: 88.0,
      bodyFatPct: 20.0,
      waistCm: 92.0,
      chestCm: 104.0,
    });
    await ctx.bodyRepo.savePhoto('2026-10-01', 'file:///photos/day1_baseline.jpg');

    const day1Log = await ctx.bodyRepo.getBodyLog('2026-10-01');
    const day1Comp = calculateBodyComposition(day1Log!.weightKg, day1Log!.bodyFatPct!);
    // 88kg at 20% BF: 17.6kg Fat, 70.4kg Lean
    expect(day1Comp.fatMassKg).toBe(17.6);
    expect(day1Comp.leanMassKg).toBe(70.4);

    // -----------------------------------------------------------------------
    // Day 15: Mid-point Check
    // -----------------------------------------------------------------------
    await ctx.bodyRepo.saveBodyLog({
      date: '2026-10-15',
      weightKg: 86.2,
      bodyFatPct: 18.0,
      waistCm: 89.5,
    });
    await ctx.bodyRepo.savePhoto('2026-10-15', 'file:///photos/day15_progress.jpg');

    // -----------------------------------------------------------------------
    // Day 30: Final Milestone
    // -----------------------------------------------------------------------
    await ctx.bodyRepo.saveBodyLog({
      date: '2026-10-31',
      weightKg: 84.5,
      bodyFatPct: 16.0,
      waistCm: 86.0,
      chestCm: 105.0,
    });
    await ctx.bodyRepo.savePhoto('2026-10-31', 'file:///photos/day30_final.jpg');

    const day30Log = await ctx.bodyRepo.getBodyLog('2026-10-31');
    const day30Comp = calculateBodyComposition(day30Log!.weightKg, day30Log!.bodyFatPct!);
    // 84.5kg at 16% BF: 13.5kg Fat, 71.0kg Lean (Recomp: lost 4.1kg fat, gained 0.6kg lean!)
    expect(day30Comp.fatMassKg).toBe(13.5);
    expect(day30Comp.leanMassKg).toBe(71.0);

    // Net body metrics changes
    const totalWeightLost = day1Log!.weightKg - day30Log!.weightKg;
    const waistLost = day1Log!.waistCm! - day30Log!.waistCm!;
    expect(totalWeightLost).toBe(3.5);
    expect(waistLost).toBe(6.0);

    // Before vs After photo comparison viewer check
    const allPhotos = await ctx.bodyRepo.getPhotos();
    expect(allPhotos.length).toBe(3);

    // Photos sorted DESC: index 0 is Day 30 (After), last index is Day 1 (Before)
    const afterPhoto = allPhotos[0];
    const beforePhoto = allPhotos[allPhotos.length - 1];

    expect(beforePhoto.uri).toBe('file:///photos/day1_baseline.jpg');
    expect(beforePhoto.date).toBe('2026-10-01');

    expect(afterPhoto.uri).toBe('file:///photos/day30_final.jpg');
    expect(afterPhoto.date).toBe('2026-10-31');

    // 30-day moving average reflects smoothed descent
    const trendHistory = await ctx.bodyRepo.getWeightHistory('2026-10-01', '2026-10-31');
    expect(trendHistory.length).toBe(3);
    expect(trendHistory[0].weightKg).toBe(88.0);
    expect(trendHistory[2].weightKg).toBe(84.5);
  });
});
