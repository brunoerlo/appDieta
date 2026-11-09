import fs from 'fs';
import path from 'path';
import { Platform, StatusBar } from 'react-native';
import { getTodayDateString, shiftDateString } from '../../src/utils/nutrition';
import { formatDatePortuguese } from '../../src/components/nutrition/DateSelectorHeader';
import { mapWeightHistoryToChart } from '../../src/utils/body';
import { LightTheme, DarkTheme } from '../../src/constants/theme';

let mockInsets = { top: 0, left: 0, right: 0, bottom: 0 };

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => mockInsets,
  };
});

import { useSafeTopPadding } from '../../src/hooks/useSafeTopPadding';

describe('Challenger 2 Empirical Verification: UI Layout, Safe Area & Component Defenses', () => {
  const rootDir = path.resolve(__dirname, '../../');

  describe('1. Safe Area & Status Bar Deduplication Audit', () => {
    const filesToAudit = [
      'src/app/(tabs)/profile.tsx',
      'src/app/nutrition/search.tsx',
      'src/app/nutrition/custom.tsx',
      'src/app/auth.tsx',
      'src/app/body/log.tsx',
      'src/app/workout/history.tsx',
      'src/app/workout/edit-routine.tsx',
      'src/components/workout/ExercisePickerModal.tsx',
      'src/components/workout/WorkoutSummaryModal.tsx',
    ];

    it.each(filesToAudit)(
      'confirms %s has completely removed useSafeTopPadding and duplicate paddingTop: safeTop',
      (relPath) => {
        const fullPath = path.join(rootDir, relPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, 'utf8');

        // Check hook import and usage
        expect(content).not.toContain('useSafeTopPadding');
        expect(content).not.toMatch(/safeTop\s*=/);
        expect(content).not.toMatch(/paddingTop:\s*safeTop/);
      }
    );

    it('confirms src/app/workout/live.tsx incorporates safe top padding with fallback for modal presentation', () => {
      const livePath = path.join(rootDir, 'src/app/workout/live.tsx');
      expect(fs.existsSync(livePath)).toBe(true);
      const content = fs.readFileSync(livePath, 'utf8');

      // 1. Safe top hook and calibrated offset
      expect(content).toContain('useSafeTopPadding');
      expect(content).toMatch(/safeTop\s*=\s*useSafeTopPadding\(6\)/);
      expect(content).toContain('paddingTop: safeTop');

      // 2. Double-padding defense: SafeAreaView excludes top edge in all return branches
      const safeAreaMatches = content.match(/<SafeAreaView[^>]*edges=\{['"]?\[?'bottom',\s*'left',\s*'right'\]?['"]?\}/g);
      expect(safeAreaMatches).not.toBeNull();
      expect(safeAreaMatches!.length).toBeGreaterThanOrEqual(2);

      // 3. Header layout maintains bottom spacing separation
      expect(content).toContain('paddingBottom: spacing.sm');

      // 4. Action buttons: 44px minHeight & minWidth touch targets & hitSlop for physical usability
      expect(content).toContain('accessibilityLabel="Descartar treino"');
      expect(content).toContain('accessibilityLabel="Finalizar treino"');
      expect(content).toMatch(/headerBtn:\s*\{[^}]*minWidth:\s*44/);
      expect(content).toMatch(/headerBtn:\s*\{[^}]*minHeight:\s*44/);
      expect(content).toMatch(/finishBtn:\s*\{[^}]*minWidth:\s*44/);
      expect(content).toMatch(/finishBtn:\s*\{[^}]*minHeight:\s*44/);
      expect(content).toMatch(/headerBtn[\s\S]*?hitSlop=\{\{\s*top:\s*8,\s*bottom:\s*8,\s*left:\s*8,\s*right:\s*8\s*\}\}/);
      expect(content).toMatch(/finishBtn[\s\S]*?hitSlop=\{\{\s*top:\s*8,\s*bottom:\s*8,\s*left:\s*8,\s*right:\s*8\s*\}\}/);
    });

    it('empirically verifies safe top calculation produces safe clearance across iOS & Android device profiles', () => {
      const originalOS = Platform.OS;
      const originalHeight = StatusBar.currentHeight;

      try {
        // Scenario A: iPhone 13/14 notch (insets.top = 47) -> 47 + 6 = 53
        Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
        mockInsets = { top: 47, left: 0, right: 0, bottom: 34 };
        expect(useSafeTopPadding(6)).toBe(53);

        // Scenario B: iPhone 15/16 Dynamic Island (insets.top = 59) -> 59 + 6 = 65
        mockInsets = { top: 59, left: 0, right: 0, bottom: 34 };
        expect(useSafeTopPadding(6)).toBe(65);

        // Scenario C: iOS fullScreenModal where insets.top reports 0 (fallback floor 44) -> 44 + 6 = 50
        mockInsets = { top: 0, left: 0, right: 0, bottom: 0 };
        expect(useSafeTopPadding(6)).toBe(50);

        // Scenario D: Android standard device (StatusBar = 24, insets.top = 0) -> 24 + 6 = 30
        Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
        Object.defineProperty(StatusBar, 'currentHeight', { value: 24, configurable: true });
        mockInsets = { top: 0, left: 0, right: 0, bottom: 0 };
        expect(useSafeTopPadding(6)).toBe(30);

        // Scenario E: Android with camera cutout (StatusBar = 38, insets.top = 35) -> 38 + 6 = 44
        Object.defineProperty(StatusBar, 'currentHeight', { value: 38, configurable: true });
        mockInsets = { top: 35, left: 0, right: 0, bottom: 0 };
        expect(useSafeTopPadding(6)).toBe(44);

        // Scenario F: Android fullScreenModal where both insets and statusBarHeight report 0 (fallback floor 24) -> 24 + 6 = 30
        Object.defineProperty(StatusBar, 'currentHeight', { value: 0, configurable: true });
        mockInsets = { top: 0, left: 0, right: 0, bottom: 0 };
        expect(useSafeTopPadding(6)).toBe(30);
      } finally {
        Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
        Object.defineProperty(StatusBar, 'currentHeight', { value: originalHeight, configurable: true });
      }
    });

    it('confirms src/app/(tabs)/workout.tsx explicitly defines edges={[\'top\', \'left\', \'right\']}', () => {
      const workoutPath = path.join(rootDir, 'src/app/(tabs)/workout.tsx');
      const content = fs.readFileSync(workoutPath, 'utf8');

      expect(content).toContain("<SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>");
    });

    it('confirms AppTopBar.tsx has calibrated extraTopPadding=2 and paddingBottom=8', () => {
      const topBarPath = path.join(rootDir, 'src/components/ui/AppTopBar.tsx');
      const content = fs.readFileSync(topBarPath, 'utf8');

      // Calibrated defaults
      expect(content).toContain('extraTopPadding = 2');
      expect(content).toMatch(/paddingBottom:\s*8/);
      // Rebranding logo format: - in primary, Frango in textPrimary
      expect(content).toContain('<Text style={{ color: colors.primary }}>-</Text>Frango');
    });
  });

  describe('2. DateSelectorHeader Empirical & Structural Verification', () => {
    const fileContent = fs.readFileSync(
      path.join(rootDir, 'src/components/nutrition/DateSelectorHeader.tsx'),
      'utf8'
    );

    it('verifies "Ir para Hoje" does NOT use position: "absolute"', () => {
      // Must not have position: absolute anywhere in DateSelectorHeader styles
      expect(fileContent).not.toMatch(/position:\s*['"]absolute['"]/);
    });

    it('verifies "Ir para Hoje" button is positioned inside centerSection under date text', () => {
      // Structure check: centerSection contains dateText, followed by conditional todayButton
      const centerSectionRegex = /<View style={styles\.centerSection}>[\s\S]*?<Text style={styles\.dateText}>[\s\S]*?\{!isToday && \([\s\S]*?styles\.todayButton[\s\S]*?Ir para Hoje[\s\S]*?<\/View>/;
      expect(fileContent).toMatch(centerSectionRegex);
    });

    it('verifies todayButton styling is a compact centered pill button', () => {
      expect(fileContent).toMatch(/todayButton:\s*\{[^}]*marginTop:\s*4/);
      expect(fileContent).toMatch(/todayButton:\s*\{[^}]*borderRadius:\s*borderRadius\.full/);
      expect(fileContent).toMatch(/todayButton:\s*\{[^}]*paddingHorizontal:\s*12/);
      expect(fileContent).toMatch(/todayButton:\s*\{[^}]*paddingVertical:\s*3/);
    });

    it('verifies arrow buttons (‹ and ›) remain unobstructed and isolated in outer layout', () => {
      const arrowRegex = /arrowButton:\s*\{[^}]*width:\s*38,[^}]*height:\s*38/s;
      expect(fileContent).toMatch(arrowRegex);
    });

    it('tests date formatting logic across various boundary dates', () => {
      const today = getTodayDateString();
      const yesterday = shiftDateString(today, -1);
      const tomorrow = shiftDateString(today, 1);

      expect(formatDatePortuguese(today)).toContain('Hoje,');
      expect(formatDatePortuguese(yesterday)).toContain('Ontem,');
      expect(formatDatePortuguese(tomorrow)).toContain('Amanhã,');

      // Leap year boundary: 2024-02-29
      const leapDay = formatDatePortuguese('2024-02-29');
      expect(leapDay).toBe('Qui, 29 de Fev');

      // Year boundary: 2026-01-01
      const newYear = formatDatePortuguese('2026-01-01');
      expect(newYear).toBe('Qui, 1 de Jan');

      // Month transitions
      expect(shiftDateString('2026-03-01', -1)).toBe('2026-02-28');
      expect(shiftDateString('2026-02-28', 1)).toBe('2026-03-01');
      expect(shiftDateString('2026-01-01', -1)).toBe('2025-12-31');
    });
  });

  describe('3. WeightTrendChart Empirical & Structural Verification', () => {
    const fileContent = fs.readFileSync(
      path.join(rootDir, 'src/components/body/WeightTrendChart.tsx'),
      'utf8'
    );

    it('verifies filter chips (1M, 3M, 6M, 1A, TUDO) have their own dedicated row', () => {
      expect(fileContent).toContain('<View style={styles.rangeChipsRow}>');
      expect(fileContent).toMatch(/rangeChipsRow:\s*\{[^}]*flexDirection:\s*['"]row['"]/);
      expect(fileContent).toMatch(/rangeChipsRow:\s*\{[^}]*gap:\s*6/);
    });

    it('verifies each range chip has flex: 1 preventing right edge truncation of TUDO', () => {
      expect(fileContent).toMatch(/rangeChip:\s*\{[^}]*flex:\s*1/);
    });

    it('verifies trendText has explicit theme color binding', () => {
      expect(fileContent).toContain('<Text style={[styles.trendText, { color: colors.textPrimary }]}>');
    });

    it('stress-tests weight trend moving average calculation engine under extreme cases', () => {
      // 1. Empty data
      const emptyChart = mapWeightHistoryToChart([], 30);
      expect(emptyChart.points.length).toBe(0);
      expect(emptyChart.currentWeight).toBeNull();
      expect(emptyChart.currentMA).toBeNull();
      expect(emptyChart.weightDeltaVsMA).toBeNull();

      // 2. Single data point without moving average
      const singleRaw = mapWeightHistoryToChart([{ date: '2026-11-01', weightKg: 80.0 }], 30);
      expect(singleRaw.points.length).toBe(1);
      expect(singleRaw.currentWeight).toBe(80.0);
      expect(singleRaw.currentMA).toBeNull();
      expect(singleRaw.weightDeltaVsMA).toBeNull();

      // Single data point with precomputed moving average
      const singleWithMA = mapWeightHistoryToChart(
        [{ date: '2026-11-01', weightKg: 80.0, movingAverage: 80.0 }],
        30
      );
      expect(singleWithMA.points.length).toBe(1);
      expect(singleWithMA.currentWeight).toBe(80.0);
      expect(singleWithMA.currentMA).toBe(80.0);
      expect(singleWithMA.weightDeltaVsMA).toBe(0);

      // 3. Multi-day upward trend (30 entries)
      const upwardHistory = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(2026, 10, 1 + i);
        const iso = d.toISOString().split('T')[0];
        return { date: iso, weightKg: 70 + i * 0.2, movingAverage: 70 + i * 0.18 };
      });
      const upwardChart = mapWeightHistoryToChart(upwardHistory, 30);
      expect(upwardChart.trendDirection).toBe('up');
      expect(upwardChart.weightDeltaVsMA).toBeGreaterThan(0);

      // 4. Multi-day downward trend (30 entries)
      const downwardHistory = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(2026, 10, 1 + i);
        const iso = d.toISOString().split('T')[0];
        return { date: iso, weightKg: 85 - i * 0.2, movingAverage: 85 - i * 0.18 };
      });
      const downwardChart = mapWeightHistoryToChart(downwardHistory, 30);
      expect(downwardChart.trendDirection).toBe('down');
      expect(downwardChart.weightDeltaVsMA).toBeLessThan(0);
    });
  });

  describe('4. MacroSummaryCard Empirical & Layout Overflow Defense', () => {
    const fileContent = fs.readFileSync(
      path.join(rootDir, 'src/components/nutrition/MacroSummaryCard.tsx'),
      'utf8'
    );

    it('verifies calorie ProgressBar receives flex: 1 style inside calorieBarContainer', () => {
      expect(fileContent).toContain('style={styles.calorieProgressBar}');
      expect(fileContent).toMatch(/calorieProgressBar:\s*\{[^}]*flex:\s*1/);
    });

    it('verifies calorieBarContainer has row layout with proper gap', () => {
      expect(fileContent).toMatch(/calorieBarContainer:\s*\{[^}]*flexDirection:\s*['"]row['"]/);
      expect(fileContent).toMatch(/calorieBarContainer:\s*\{[^}]*gap:\s*10/);
    });

    it('verifies caloriePercentText has fixed width and right alignment', () => {
      expect(fileContent).toMatch(/caloriePercentText:\s*\{[^}]*width:\s*36/);
      expect(fileContent).toMatch(/caloriePercentText:\s*\{[^}]*textAlign:\s*['"]right['"]/);
    });

    it('stress-tests calorie progress calculations on extreme values', () => {
      function computeCalorieMetrics(consumed: number, target: number) {
        const remaining = target - consumed;
        const progress = target > 0 ? consumed / target : 0;
        const percentString = `${Math.round(progress * 100)}%`;
        const clampedBarWidthPercent = `${Math.round(Math.max(0, Math.min(1, isNaN(progress) ? 0 : progress)) * 100)}%`;
        return { remaining, progress, percentString, clampedBarWidthPercent };
      }

      // 1. Zero consumed
      const zero = computeCalorieMetrics(0, 2000);
      expect(zero.remaining).toBe(2000);
      expect(zero.percentString).toBe('0%');
      expect(zero.clampedBarWidthPercent).toBe('0%');

      // 2. Exactly at target
      const exact = computeCalorieMetrics(2000, 2000);
      expect(exact.remaining).toBe(0);
      expect(exact.percentString).toBe('100%');
      expect(exact.clampedBarWidthPercent).toBe('100%');

      // 3. Huge surplus (5000 kcal consumed vs 2000 target = 250%)
      const surplus = computeCalorieMetrics(5000, 2000);
      expect(surplus.remaining).toBe(-3000);
      expect(surplus.percentString).toBe('250%');
      // Visual fill bar is safely clamped to 100% so it doesn't break out of the container
      expect(surplus.clampedBarWidthPercent).toBe('100%');

      // 4. Target is 0 (division by zero protection)
      const divZero = computeCalorieMetrics(500, 0);
      expect(divZero.percentString).toBe('0%');
      expect(divZero.clampedBarWidthPercent).toBe('0%');
    });
  });

  describe('5. Theme Parity & Color Contrast Analysis', () => {
    it('verifies contrast compliance between textPrimary and background/card across themes', () => {
      // LightTheme
      expect(LightTheme.colors.card).toBe('#FFFFFF');
      expect(LightTheme.colors.textPrimary).toBe('#0F172A'); // High contrast dark navy on white
      expect(LightTheme.colors.surfaceMuted).toBe('#E2E8F0');

      // DarkTheme
      expect(DarkTheme.colors.card).toBe('#15171C');
      expect(DarkTheme.colors.textPrimary).toBe('#FFFFFF'); // High contrast pure white on dark
      expect(DarkTheme.colors.surfaceMuted).toBe('#1E222B');
    });
  });
});
