import { createE2ETestContext, E2ETestContext } from '../helpers/testContext';
import {
  scaleMacro,
  calculateBrzycki1RM,
  calculateBodyComposition,
  calculateWorkoutVolume,
} from '../helpers/calculationOracles';
import * as Haptics from 'expo-haptics';

describe('Tier 3: Cross-Feature Pairwise Integrations', () => {
  let ctx: E2ETestContext;
  const TODAY = '2026-11-06';
  const TOMORROW = '2026-11-07';

  beforeEach(async () => {
    ctx = await createE2ETestContext();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // =========================================================================
  // Pairwise 1: Food Logging + Water Tracking
  // =========================================================================
  it('3.1 Pairwise: Food Logging + Water Intake in a single day updates DailyNutritionSummary simultaneously', async () => {
    // 1. Log breakfast & lunch
    await ctx.dietRepo.addDietLog({
      date: TODAY,
      mealType: 'breakfast',
      foodName: 'Ovo de galinha, inteiro, cozido',
      servingGrams: 100,
      calories: 146,
      protein: 13.3,
      carbs: 0.6,
      fat: 9.5,
    });

    await ctx.dietRepo.addDietLog({
      date: TODAY,
      mealType: 'lunch',
      foodName: 'Peito de frango, grelhado',
      servingGrams: 200,
      calories: 318,
      protein: 64.0,
      carbs: 0.0,
      fat: 5.0,
    });

    // 2. Log water increments
    await ctx.dietRepo.addWaterLog(TODAY, 500);
    await ctx.dietRepo.addWaterLog(TODAY, 250);

    // 3. Verify single summary call aggregates both food and water
    const summary = await ctx.dietRepo.getDailyNutritionSummary(TODAY);
    expect(summary.totalCalories).toBe(464);
    expect(summary.totalProtein).toBe(77.3);
    expect(summary.totalWaterMl).toBe(750);
    expect(summary.meals.breakfast.length).toBe(1);
    expect(summary.meals.lunch.length).toBe(1);
  });

  // =========================================================================
  // Pairwise 2: Routine Creation -> Live Workout Execution -> Previous Load Lookup
  // =========================================================================
  it('3.2 Pairwise: Routine Creation -> Live Session 1 -> Session 2 references Session 1 loads', async () => {
    // 1. Create custom routine
    const routine = await ctx.workoutRepo.createRoutine(
      { name: 'Ombros e Braços', sortOrder: 1 },
      [
        {
          name: 'Desenvolvimento com Halteres',
          muscleGroup: 'Ombros',
          targetSets: 3,
          defaultRestSeconds: 90,
          sortOrder: 1,
        },
      ]
    );

    // 2. Execute Session 1 on Monday
    await ctx.workoutRepo.saveWorkoutSession(
      {
        routineId: routine.id,
        routineName: routine.name,
        date: '2026-11-02',
        durationMinutes: 45,
      },
      [
        { exerciseName: 'Desenvolvimento com Halteres', setNumber: 1, weightKg: 24, reps: 10, completed: true },
        { exerciseName: 'Desenvolvimento com Halteres', setNumber: 2, weightKg: 24, reps: 10, completed: true },
        { exerciseName: 'Desenvolvimento com Halteres', setNumber: 3, weightKg: 26, reps: 8, completed: true },
      ]
    );

    // 3. Start Session 2 on Friday: lookup previous session reference loads
    const prevSets = await ctx.workoutRepo.getPreviousExerciseSets('Desenvolvimento com Halteres', 3);
    expect(prevSets.length).toBe(3);
    expect(prevSets[0].weightKg).toBe(24);
    expect(prevSets[1].weightKg).toBe(24);
    expect(prevSets[2].weightKg).toBe(26);

    // 4. Record progressive overload in Session 2
    const session2 = await ctx.workoutRepo.saveWorkoutSession(
      {
        routineId: routine.id,
        routineName: routine.name,
        date: '2026-11-06',
        durationMinutes: 48,
      },
      [
        { exerciseName: 'Desenvolvimento com Halteres', setNumber: 1, weightKg: 26, reps: 10, completed: true },
        { exerciseName: 'Desenvolvimento com Halteres', setNumber: 2, weightKg: 26, reps: 9, completed: true },
        { exerciseName: 'Desenvolvimento com Halteres', setNumber: 3, weightKg: 28, reps: 6, completed: true },
      ]
    );

    expect(session2.totalVolumeKg).toBe(26 * 10 + 26 * 9 + 28 * 6);
  });

  // =========================================================================
  // Pairwise 3: Routine Execution -> Volume Calculation -> 1RM Update -> History Log
  // =========================================================================
  it('3.3 Pairwise: Live Session Execution -> Volume Calculation -> 1RM Update -> Workout History', async () => {
    const session = await ctx.workoutRepo.saveWorkoutSession(
      {
        routineName: 'Push Session',
        date: TODAY,
        durationMinutes: 52,
      },
      [
        { exerciseName: 'Supino Reto com Barra', setNumber: 1, weightKg: 90, reps: 8, completed: true },
        { exerciseName: 'Supino Reto com Barra', setNumber: 2, weightKg: 95, reps: 6, completed: true },
        { exerciseName: 'Supino Reto com Barra', setNumber: 3, weightKg: 100, reps: 4, completed: true },
      ]
    );

    // Volume assertion
    const expectedVolume = 90 * 8 + 95 * 6 + 100 * 4; // 720 + 570 + 400 = 1690 kg
    expect(session.totalVolumeKg).toBe(expectedVolume);

    // 1RM progression curve assertion
    const historyPoints = await ctx.workoutRepo.getExerciseHistory('Supino Reto com Barra');
    expect(historyPoints.length).toBe(1);
    expect(historyPoints[0].maxWeightKg).toBe(100);

    const expected1RM = Math.max(
      calculateBrzycki1RM(90, 8),
      calculateBrzycki1RM(95, 6),
      calculateBrzycki1RM(100, 4)
    );
    expect(historyPoints[0].estimated1RM).toBe(expected1RM);

    // History log assertion
    const history = await ctx.workoutRepo.getWorkoutSessions(5, 0);
    expect(history[0].id).toBe(session.id);
    expect(history[0].totalVolumeKg).toBe(expectedVolume);
  });

  // =========================================================================
  // Pairwise 4: Morning Weigh-in -> Profile Target Adjustment -> Caloric Deficit
  // =========================================================================
  it('3.4 Pairwise: Weigh-in + Profile Goal Calibration + Calorie Deficit Assessment', async () => {
    // 1. Morning weigh-in
    await ctx.bodyRepo.saveBodyLog({
      date: TODAY,
      weightKg: 85.0,
      bodyFatPct: 18.0,
    });

    // 2. Calibrate user profile to cutting targets
    await ctx.authRepo.updateProfile({
      targetCalories: 2100,
      targetProtein: 180,
      targetCarbs: 180,
      targetFat: 50,
    });

    // 3. Log meals throughout day
    await ctx.dietRepo.addDietLog({
      date: TODAY,
      mealType: 'breakfast',
      foodName: 'Ovos com Aveia',
      servingGrams: 200,
      calories: 400,
      protein: 30,
      carbs: 40,
      fat: 10,
    });

    await ctx.dietRepo.addDietLog({
      date: TODAY,
      mealType: 'lunch',
      foodName: 'Frango com Arroz e Legumes',
      servingGrams: 350,
      calories: 600,
      protein: 60,
      carbs: 65,
      fat: 8,
    });

    // 4. Audit deficit
    const summary = await ctx.dietRepo.getDailyNutritionSummary(TODAY);
    const profile = await ctx.authRepo.getProfile();

    const consumedKcal = summary.totalCalories;
    const deficitRemaining = profile.targetCalories - consumedKcal;

    expect(consumedKcal).toBe(1000);
    expect(deficitRemaining).toBe(1100);
  });

  // =========================================================================
  // Pairwise 5: Custom Food Creation -> Portion Scaling -> Meal Addition -> Deletion
  // =========================================================================
  it('3.5 Pairwise: Custom Food Creation -> Portion Scaling -> Meal Log -> Deletion & Re-audit', async () => {
    // 1. Create custom food
    const customFood = await ctx.dietRepo.createFood({
      name: 'Panqueca Hiperproteica Caseira',
      servingGrams: 100,
      calories: 220,
      protein: 25,
      carbs: 20,
      fat: 4,
      source: 'custom',
    });

    // 2. Scale to 150g serving
    const servingGrams = 150;
    const scaledCalories = scaleMacro(customFood.calories, servingGrams);
    const scaledProtein = scaleMacro(customFood.protein, servingGrams);

    expect(scaledCalories).toBe(330);
    expect(scaledProtein).toBe(37.5);

    // 3. Add to breakfast
    const logEntry = await ctx.dietRepo.addDietLog({
      date: TODAY,
      mealType: 'breakfast',
      foodId: customFood.id,
      foodName: customFood.name,
      servingGrams,
      calories: scaledCalories,
      protein: scaledProtein,
      carbs: 30,
      fat: 6,
    });

    let summary = await ctx.dietRepo.getDailyNutritionSummary(TODAY);
    expect(summary.totalCalories).toBe(330);

    // 4. Delete the logged entry
    await ctx.dietRepo.deleteDietLog(logEntry.id);

    summary = await ctx.dietRepo.getDailyNutritionSummary(TODAY);
    expect(summary.totalCalories).toBe(0);
    expect(summary.totalProtein).toBe(0);
  });

  // =========================================================================
  // Pairwise 6: Water Increment Shortcuts + Reset + Re-increment
  // =========================================================================
  it('3.6 Pairwise: Water Shortcuts (+250, +500) -> Full Reset -> Re-increment cycle', async () => {
    // Increment to 750ml
    await ctx.dietRepo.addWaterLog(TODAY, 250);
    await ctx.dietRepo.addWaterLog(TODAY, 500);

    let summary = await ctx.dietRepo.getDailyNutritionSummary(TODAY);
    expect(summary.totalWaterMl).toBe(750);

    // Reset day's water
    await ctx.dietRepo.resetWaterLogs(TODAY);

    summary = await ctx.dietRepo.getDailyNutritionSummary(TODAY);
    expect(summary.totalWaterMl).toBe(0);

    // Re-increment
    await ctx.dietRepo.addWaterLog(TODAY, 500);
    summary = await ctx.dietRepo.getDailyNutritionSummary(TODAY);
    expect(summary.totalWaterMl).toBe(500);
  });

  // =========================================================================
  // Pairwise 7: Rest Timer Config + Haptics Notification + Session Finalization
  // =========================================================================
  it('3.7 Pairwise: Exercise Rest Configuration -> Set Completion -> Haptics -> Session Finalization', async () => {
    const routine = await ctx.workoutRepo.createRoutine(
      { name: 'Leg Day Blast', sortOrder: 1 },
      [
        {
          name: 'Agachamento no Smith',
          muscleGroup: 'Pernas',
          targetSets: 3,
          defaultRestSeconds: 120,
          sortOrder: 1,
        },
      ]
    );

    const routineDetails = await ctx.workoutRepo.getRoutineById(routine.id);
    const restSeconds = routineDetails!.exercises![0].defaultRestSeconds;
    expect(restSeconds).toBe(120);

    // Simulate completing set 1 -> trigger rest timer & haptics
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    expect(Haptics.notificationAsync).toHaveBeenCalled();

    // Finalize session with 3 completed sets
    const session = await ctx.workoutRepo.saveWorkoutSession(
      {
        routineId: routine.id,
        routineName: routine.name,
        date: TODAY,
        durationMinutes: 50,
      },
      [
        { exerciseName: 'Agachamento no Smith', setNumber: 1, weightKg: 100, reps: 8, completed: true },
        { exerciseName: 'Agachamento no Smith', setNumber: 2, weightKg: 100, reps: 8, completed: true },
        { exerciseName: 'Agachamento no Smith', setNumber: 3, weightKg: 105, reps: 6, completed: true },
      ]
    );

    expect(session.totalVolumeKg).toBe(100 * 8 + 100 * 8 + 105 * 6);
  });

  // =========================================================================
  // Pairwise 8: Body Weigh-in + Circumferences + Body Fat Composition
  // =========================================================================
  it('3.8 Pairwise: Body Weigh-in + Circumference Tracking + Lean/Fat Mass Composition', async () => {
    const weightKg = 82.0;
    const bodyFatPct = 14.5;

    await ctx.bodyRepo.saveBodyLog({
      date: TODAY,
      weightKg,
      bodyFatPct,
      waistCm: 83.0,
      chestCm: 106.0,
      armsCm: 40.0,
      legsCm: 62.5,
    });

    const bodyLog = await ctx.bodyRepo.getBodyLog(TODAY);
    expect(bodyLog?.weightKg).toBe(82.0);
    expect(bodyLog?.waistCm).toBe(83.0);

    const composition = calculateBodyComposition(bodyLog!.weightKg, bodyLog!.bodyFatPct!);
    // Fat Mass = 82 * 0.145 = 11.9 kg; Lean Mass = 82 - 11.9 = 70.1 kg
    expect(composition.fatMassKg).toBe(11.9);
    expect(composition.leanMassKg).toBe(70.1);
  });

  // =========================================================================
  // Pairwise 9: Profile Theme Switch + Goal Customization + Persisted Retrieval
  // =========================================================================
  it('3.9 Pairwise: Profile Theme Switch + Goal Customization + Persisted Retrieval', async () => {
    expect(await ctx.authRepo.getTheme()).toBe('dark');

    await ctx.authRepo.setTheme('light');
    await ctx.authRepo.updateProfile({
      name: 'Super Atleta',
      targetWaterMl: 4000,
    });

    const profile = await ctx.authRepo.getProfile();
    expect(profile.theme).toBe('light');
    expect(profile.name).toBe('Super Atleta');
    expect(profile.targetWaterMl).toBe(4000);

    // Switch back to OLED dark mode
    await ctx.authRepo.setTheme('dark');
    expect(await ctx.authRepo.getTheme()).toBe('dark');
  });

  // =========================================================================
  // Pairwise 10: Multi-session Exercise History Progression (3 Sessions)
  // =========================================================================
  it('3.10 Pairwise: 3 Sequential Workout Sessions track Load & 1RM Progression Curve', async () => {
    const exercise = 'Barra Paralela com Peso';

    // Week 1
    await ctx.workoutRepo.saveWorkoutSession(
      { routineName: 'Chest/Tri', date: '2026-10-15', durationMinutes: 45 },
      [{ exerciseName: exercise, setNumber: 1, weightKg: 10, reps: 8, completed: true }]
    );

    // Week 2
    await ctx.workoutRepo.saveWorkoutSession(
      { routineName: 'Chest/Tri', date: '2026-10-22', durationMinutes: 45 },
      [{ exerciseName: exercise, setNumber: 1, weightKg: 15, reps: 8, completed: true }]
    );

    // Week 3
    await ctx.workoutRepo.saveWorkoutSession(
      { routineName: 'Chest/Tri', date: '2026-10-29', durationMinutes: 45 },
      [{ exerciseName: exercise, setNumber: 1, weightKg: 20, reps: 6, completed: true }]
    );

    const history = await ctx.workoutRepo.getExerciseHistory(exercise);
    expect(history.length).toBe(3);
    expect(history[0].maxWeightKg).toBe(10);
    expect(history[1].maxWeightKg).toBe(15);
    expect(history[2].maxWeightKg).toBe(20);

    // 1RM should strictly increase
    expect(history[1].estimated1RM).toBeGreaterThan(history[0].estimated1RM);
    expect(history[2].estimated1RM).toBeGreaterThan(history[1].estimated1RM);
  });

  // =========================================================================
  // Pairwise 11: Barcode Food Retrieval -> Logging to Dinner -> Macro Balance
  // =========================================================================
  it('3.11 Pairwise: Barcode Lookup -> Logging to Dinner -> Daily Caloric Budget Depletion', async () => {
    // 1. Create industrial barcode product
    await ctx.dietRepo.createFood({
      name: 'Iogurte Proteico Danone YoPRO 250ml',
      servingGrams: 250,
      calories: 160,
      protein: 25.0,
      carbs: 12.0,
      fat: 1.0,
      barcode: '7891025114701',
      source: 'openfoodfacts',
    });

    // 2. Barcode scan lookup
    const scannedFood = await ctx.dietRepo.getFoodByBarcode('7891025114701');
    expect(scannedFood).not.toBeNull();

    // 3. Log to dinner
    await ctx.dietRepo.addDietLog({
      date: TODAY,
      mealType: 'dinner',
      foodId: scannedFood!.id,
      foodName: scannedFood!.name,
      servingGrams: 250,
      calories: scannedFood!.calories,
      protein: scannedFood!.protein,
      carbs: scannedFood!.carbs,
      fat: scannedFood!.fat,
    });

    const summary = await ctx.dietRepo.getDailyNutritionSummary(TODAY);
    expect(summary.totalProtein).toBe(25.0);
    expect(summary.meals.dinner.length).toBe(1);
  });

  // =========================================================================
  // Pairwise 12: Cascading Deletions: Routine Deletion preserves Session History
  // =========================================================================
  it('3.12 Pairwise: Routine Deletion does not delete completed historical sessions (SET NULL constraint)', async () => {
    const routine = await ctx.workoutRepo.createRoutine({
      name: 'Rotina Temporária para Excluir',
      sortOrder: 5,
    });

    const session = await ctx.workoutRepo.saveWorkoutSession({
      routineId: routine.id,
      routineName: routine.name,
      date: TODAY,
      durationMinutes: 40,
    });

    // Delete parent routine
    await ctx.workoutRepo.deleteRoutine(routine.id);

    // Verify session still exists in history
    const details = await ctx.workoutRepo.getSessionDetails(session.id);
    expect(details).not.toBeNull();
    expect(details?.routineId).toBeFalsy();
    expect(details?.routineName).toBe('Rotina Temporária para Excluir');
  });
});
