export const DarkTheme = {
  mode: 'dark' as const,
  colors: {
    // High-Contrast OLED Surfaces
    background: '#0A0A0C',      // Deep OLED True Black
    card: '#15171C',            // Elevated Slate-Charcoal Card
    cardBorder: '#232730',      // Card Stroke Border
    cardPressed: '#1C2027',     // Active Press State
    surfaceMuted: '#1E222B',    // Badge / Input Background

    // Typography
    textPrimary: '#FFFFFF',     // Headers and main values
    textSecondary: '#94A3B8',   // Labels and subheaders (Slate 400)
    textDimmed: '#64748B',      // Placeholders and hints (Slate 500)

    // Brand & Status
    primary: '#10B981',         // Athletic Emerald 500
    primaryMuted: 'rgba(16, 185, 129, 0.15)',
    danger: '#EF4444',          // Destructive Red 500
    dangerMuted: 'rgba(239, 68, 68, 0.15)',

    // Nutrient & Hydration Accents
    calories: '#F59E0B',        // Amber 500
    caloriesTrack: '#451A03',
    protein: '#3B82F6',         // Electric Blue 500
    proteinTrack: '#1E3A8A',
    carbs: '#10B981',           // Emerald 500
    carbsTrack: '#064E3B',
    fat: '#F43F5E',             // Crimson / Rose 500
    fatTrack: '#881337',
    water: '#06B6D4',           // Cyan 500
    waterTrack: '#164E63',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
} as const;

export const LightTheme = {
  mode: 'light' as const,
  colors: {
    // Athletic Clean Light Surfaces
    background: '#F8F9FA',      // Crisp Off-White Surface
    card: '#FFFFFF',            // Pure White Elevated Card
    cardBorder: '#E2E8F0',      // Slate 200 Card Border
    cardPressed: '#F1F5F9',     // Slate 100 Active Press
    surfaceMuted: '#E2E8F0',    // Slate 200 Badge / Input Surface

    // Typography
    textPrimary: '#0F172A',     // Slate 900 High Contrast Text
    textSecondary: '#475569',   // Slate 600 Secondary Labels
    textDimmed: '#94A3B8',      // Slate 400 Placeholder & Hints

    // Brand & Status
    primary: '#059669',         // Emerald 600 (High contrast on white)
    primaryMuted: 'rgba(5, 150, 105, 0.12)',
    danger: '#DC2626',          // Red 600
    dangerMuted: 'rgba(220, 38, 38, 0.12)',

    // Nutrient & Hydration Accents
    calories: '#D97706',        // Amber 600
    caloriesTrack: '#FEF3C7',
    protein: '#2563EB',         // Blue 600
    proteinTrack: '#DBEAFE',
    carbs: '#059669',           // Emerald 600
    carbsTrack: '#D1FAE5',
    fat: '#E11D48',             // Rose 600
    fatTrack: '#FFE4E6',
    water: '#0891B2',           // Cyan 600
    waterTrack: '#CFFAFE',
  },
  spacing: DarkTheme.spacing,
  borderRadius: DarkTheme.borderRadius,
} as const;

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  cardPressed: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textDimmed: string;
  primary: string;
  primaryMuted: string;
  danger: string;
  dangerMuted: string;
  calories: string;
  caloriesTrack: string;
  protein: string;
  proteinTrack: string;
  carbs: string;
  carbsTrack: string;
  fat: string;
  fatTrack: string;
  water: string;
  waterTrack: string;
}

export type Theme = {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof DarkTheme.spacing;
  borderRadius: typeof DarkTheme.borderRadius;
};

export function getTheme(mode: ThemeMode = 'dark'): Theme {
  return mode === 'light' ? LightTheme : DarkTheme;
}

export const spacing = DarkTheme.spacing;
export const borderRadius = DarkTheme.borderRadius;


