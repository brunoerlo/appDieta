import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useProfile } from '../hooks/useProfile';
import { useTheme } from '../hooks/useTheme';
import { useBody } from '../hooks/useBody';
import { calculateSuggestedTargets } from '../utils/nutrition';
import { TrainingGoal, ActivityLevel } from '../database/repositories/interfaces';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string }>();
  const { colors } = useTheme();
  const { login, register, completeOnboarding, isLoggedIn, onboardingCompleted } = useProfile();

  let bodyContext: { saveWeighIn?: (weightKg: number) => Promise<any> } = {};
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    bodyContext = useBody();
  } catch {
    // Graceful fallback if BodyContext is unmounted
  }

  // Determine active step
  const [internalStep, setInternalStep] = useState<'auth' | 'onboarding'>('auth');
  const isAlreadyOnboarding = params.step === 'onboarding' || (isLoggedIn && !onboardingCompleted);
  const step = isAlreadyOnboarding ? 'onboarding' : internalStep;

  // Step 1: Credentials State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 2: Onboarding Biometrics State
  const [weightKg, setWeightKg] = useState('75.0');
  const [heightCm, setHeightCm] = useState('175');
  const [targetWeightKg, setTargetWeightKg] = useState('75.0');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState('25');

  const [trainingGoal, setTrainingGoal] = useState<TrainingGoal>('hypertrophy');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');

  // Step 2: Editable Nutritional Targets State with manual override tracking
  const [manualCalories, setManualCalories] = useState<string | null>(null);
  const [manualProtein, setManualProtein] = useState<string | null>(null);
  const [manualCarbs, setManualCarbs] = useState<string | null>(null);
  const [manualFat, setManualFat] = useState<string | null>(null);
  const [manualWaterMl, setManualWaterMl] = useState<string | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [isOnboardingSubmitting, setIsOnboardingSubmitting] = useState(false);

  // Reactive calculation of suggested targets
  const suggested = useMemo(() => {
    const w = parseFloat(weightKg.replace(',', '.'));
    const h = parseFloat(heightCm);
    const a = parseInt(age, 10) || 25;
    if (!w || isNaN(w) || !h || isNaN(h)) return null;

    return calculateSuggestedTargets({
      weightKg: w,
      heightCm: h,
      age: a,
      gender,
      trainingGoal,
      activityLevel,
    });
  }, [weightKg, heightCm, age, gender, trainingGoal, activityLevel]);

  const targetCalories =
    manualCalories !== null
      ? manualCalories
      : suggested
      ? String(suggested.calories)
      : '2400';
  const targetProtein =
    manualProtein !== null
      ? manualProtein
      : suggested
      ? String(suggested.protein)
      : '150';
  const targetCarbs =
    manualCarbs !== null
      ? manualCarbs
      : suggested
      ? String(suggested.carbs)
      : '250';
  const targetFat =
    manualFat !== null
      ? manualFat
      : suggested
      ? String(suggested.fat)
      : '65';
  const targetWaterMl =
    manualWaterMl !== null
      ? manualWaterMl
      : suggested
      ? String(suggested.waterMl)
      : '3000';

  const hasManuallyEdited =
    manualCalories !== null ||
    manualProtein !== null ||
    manualCarbs !== null ||
    manualFat !== null ||
    manualWaterMl !== null;

  const handleResetToSuggestions = () => {
    setManualCalories(null);
    setManualProtein(null);
    setManualCarbs(null);
    setManualFat(null);
    setManualWaterMl(null);
  };

  // Step 1: Submit Login / Register
  const handleAuthSubmit = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      if (authMode === 'register') {
        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedName) throw new Error('Por favor, informe seu nome.');
        if (!trimmedEmail || !/\S+@\S+\.\S+/.test(trimmedEmail)) {
          throw new Error('Informe um e-mail válido.');
        }
        if (password.length < 4) {
          throw new Error('A senha deve ter pelo menos 4 caracteres.');
        }

        const user = await register({
          name: trimmedName,
          email: trimmedEmail,
          password,
        });

        if (!user.onboardingCompleted) {
          setInternalStep('onboarding');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail) throw new Error('Informe seu e-mail.');
        if (!password) throw new Error('Informe sua senha.');

        const user = await login({
          email: trimmedEmail,
          password,
        });

        if (!user.onboardingCompleted) {
          setInternalStep('onboarding');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao autenticar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Submit Onboarding
  const handleOnboardingSubmit = async () => {
    setOnboardingError(null);
    const parsedWeight = parseFloat(weightKg.replace(',', '.'));
    const parsedHeight = parseFloat(heightCm);
    const parsedTargetWeight = targetWeightKg
      ? parseFloat(targetWeightKg.replace(',', '.'))
      : parsedWeight;
    const parsedCalories = parseFloat(targetCalories);
    const parsedProtein = parseFloat(targetProtein);
    const parsedCarbs = parseFloat(targetCarbs);
    const parsedFat = parseFloat(targetFat);
    const parsedWater = parseInt(targetWaterMl, 10);

    if (!parsedWeight || isNaN(parsedWeight) || parsedWeight < 30 || parsedWeight > 300) {
      setOnboardingError('Informe um peso atual válido entre 30kg e 300kg.');
      return;
    }
    if (!parsedHeight || isNaN(parsedHeight) || parsedHeight < 100 || parsedHeight > 250) {
      setOnboardingError('Informe uma altura válida entre 100cm e 250cm.');
      return;
    }
    if (!parsedCalories || isNaN(parsedCalories) || parsedCalories < 800) {
      setOnboardingError('Informe uma meta calórica válida (mínimo 800 kcal).');
      return;
    }

    setIsOnboardingSubmitting(true);
    try {
      await completeOnboarding({
        heightCm: parsedHeight,
        targetWeightKg: parsedTargetWeight,
        currentWeightKg: parsedWeight,
        trainingGoal,
        activityLevel,
        targetCalories: parsedCalories,
        targetProtein: parsedProtein,
        targetCarbs: parsedCarbs,
        targetFat: parsedFat,
        targetWaterMl: parsedWater,
      });

      if (bodyContext.saveWeighIn) {
        try {
          await bodyContext.saveWeighIn(parsedWeight);
        } catch {
          // Non-blocking weigh-in persistence
        }
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      setOnboardingError(err?.message || 'Falha ao salvar metas iniciais.');
    } finally {
      setIsOnboardingSubmitting(false);
    }
  };

  // Real-time Atwater calculation
  const atwaterCalculatedKcal = useMemo(() => {
    const p = parseFloat(targetProtein) || 0;
    const c = parseFloat(targetCarbs) || 0;
    const f = parseFloat(targetFat) || 0;
    return Math.round(p * 4 + c * 4 + f * 9);
  }, [targetProtein, targetCarbs, targetFat]);

  const targetCalorieNum = parseFloat(targetCalories) || 0;
  const atwaterDifference = atwaterCalculatedKcal - targetCalorieNum;
  const isAtwaterBalanced = Math.abs(atwaterDifference) <= 50;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* -Frango Athletic Branding */}
          <View style={styles.brandContainer}>
            <View style={[styles.brandLogoCircle, { backgroundColor: colors.primaryMuted }]}>
              <Text style={[styles.brandLogoText, { color: colors.primary }]}>-F</Text>
            </View>
            <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
              <Text style={{ color: colors.primary }}>-</Text>Frango
            </Text>
            <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
              {step === 'auth'
                ? 'Sua jornada atlética de alta performance começa aqui'
                : 'Configuração científica de metas para o seu corpo'}
            </Text>
          </View>

          {/* ============================================================= */}
          {/* STEP 1: AUTHENTICATION (LOGIN & REGISTRATION)                 */}
          {/* ============================================================= */}
          {step === 'auth' ? (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              {/* Segmented Mode Toggle */}
              <View style={[styles.toggleContainer, { backgroundColor: colors.surfaceMuted }]}>
                <TouchableOpacity
                  style={[styles.toggleBtn, authMode === 'login' && styles.toggleBtnActive]}
                  onPress={() => {
                    setAuthMode('login');
                    setErrorMsg(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      authMode === 'login'
                        ? styles.toggleTextActive
                        : { color: colors.textSecondary },
                    ]}
                  >
                    Entrar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleBtn, authMode === 'register' && styles.toggleBtnActive]}
                  onPress={() => {
                    setAuthMode('register');
                    setErrorMsg(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      authMode === 'register'
                        ? styles.toggleTextActive
                        : { color: colors.textSecondary },
                    ]}
                  >
                    Criar Conta
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Error Banner */}
              {errorMsg && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                </View>
              )}

              {/* Name Field (Registration only) */}
              {authMode === 'register' && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    NOME COMPLETO
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.cardBorder,
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="Ex: Carlos Silva"
                    placeholderTextColor={colors.textDimmed}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!isSubmitting}
                  />
                </View>
              )}

              {/* Email Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>E-MAIL</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.cardBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="atleta@menosfrango.app"
                  placeholderTextColor={colors.textDimmed}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>SENHA</Text>
                <View
                  style={[
                    styles.passwordWrapper,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.passwordInput, { color: colors.textPrimary }]}
                    placeholder="Mínimo de 4 caracteres"
                    placeholderTextColor={colors.textDimmed}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={{ fontSize: 16 }}>{showPassword ? '👁️' : '🔒'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: colors.primary },
                  isSubmitting && { opacity: 0.7 },
                ]}
                onPress={handleAuthSubmit}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {authMode === 'login' ? 'Entrar no -Frango' : 'Continuar para Metas ➔'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* ============================================================= */
            /* STEP 2: ONBOARDING DE METAS DO ATLETA                          */
            /* ============================================================= */
            <View style={styles.onboardingContainer}>
              {/* Step indicator badge */}
              <View style={[styles.stepBadge, { backgroundColor: colors.primaryMuted }]}>
                <Text style={[styles.stepBadgeText, { color: colors.primary }]}>
                  ⚡ PASSO 2 DE 2 • CONFIGURAÇÃO DE METAS
                </Text>
              </View>

              {/* Onboarding Error Banner */}
              {onboardingError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>⚠️ {onboardingError}</Text>
                </View>
              )}

              {/* Card 1: Biometria */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>
                  📏 Dados Físicos
                </Text>
                <Text style={[styles.cardSubheading, { color: colors.textSecondary }]}>
                  Suas medidas permitem calcular o gasto energético basal (BMR).
                </Text>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                      PESO ATUAL (KG)
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.surfaceMuted,
                          borderColor: colors.cardBorder,
                          color: colors.textPrimary,
                        },
                      ]}
                      value={weightKg}
                      onChangeText={setWeightKg}
                      keyboardType="decimal-pad"
                      placeholder="75.0"
                      placeholderTextColor={colors.textDimmed}
                    />
                  </View>

                  <View style={styles.col}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                      ALTURA (CM)
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.surfaceMuted,
                          borderColor: colors.cardBorder,
                          color: colors.textPrimary,
                        },
                      ]}
                      value={heightCm}
                      onChangeText={setHeightCm}
                      keyboardType="numeric"
                      placeholder="175"
                      placeholderTextColor={colors.textDimmed}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                      META DE PESO (KG)
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.surfaceMuted,
                          borderColor: colors.cardBorder,
                          color: colors.textPrimary,
                        },
                      ]}
                      value={targetWeightKg}
                      onChangeText={setTargetWeightKg}
                      keyboardType="decimal-pad"
                      placeholder="75.0"
                      placeholderTextColor={colors.textDimmed}
                    />
                  </View>

                  <View style={styles.col}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>IDADE</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.surfaceMuted,
                          borderColor: colors.cardBorder,
                          color: colors.textPrimary,
                        },
                      ]}
                      value={age}
                      onChangeText={setAge}
                      keyboardType="numeric"
                      placeholder="25"
                      placeholderTextColor={colors.textDimmed}
                    />
                  </View>
                </View>

                {/* Biological sex selector */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 4 }]}>
                  SEXO BIOLÓGICO (FÓRMULA MIFFLIN-ST JEOR)
                </Text>
                <View style={styles.chipsRow}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          gender === 'male' ? colors.primaryMuted : colors.surfaceMuted,
                        borderColor: gender === 'male' ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => setGender('male')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: gender === 'male' ? colors.primary : colors.textSecondary },
                      ]}
                    >
                      👨 Masculino
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          gender === 'female' ? colors.primaryMuted : colors.surfaceMuted,
                        borderColor: gender === 'female' ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => setGender('female')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: gender === 'female' ? colors.primary : colors.textSecondary },
                      ]}
                    >
                      👩 Feminino
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Card 2: Objetivo & Atividade */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>
                  🎯 Objetivo Principal
                </Text>

                <View style={styles.goalOptionsContainer}>
                  {[
                    {
                      key: 'hypertrophy',
                      label: '🔥 Hipertrofia',
                      desc: '+12% calorias, 2.0g/kg proteína para ganho de massa',
                    },
                    {
                      key: 'cutting',
                      label: '✂️ Cutting / Definição',
                      desc: '-18% déficit, 2.2g/kg proteína preservando músculo',
                    },
                    {
                      key: 'maintenance',
                      label: '⚖️ Manutenção',
                      desc: 'Equilíbrio metabólico, 1.8g/kg proteína',
                    },
                  ].map((g) => (
                    <TouchableOpacity
                      key={g.key}
                      style={[
                        styles.goalOptionCard,
                        {
                          backgroundColor:
                            trainingGoal === g.key ? colors.primaryMuted : colors.surfaceMuted,
                          borderColor:
                            trainingGoal === g.key ? colors.primary : colors.cardBorder,
                        },
                      ]}
                      onPress={() => setTrainingGoal(g.key as TrainingGoal)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.goalOptionTitle,
                          {
                            color:
                              trainingGoal === g.key ? colors.primary : colors.textPrimary,
                          },
                        ]}
                      >
                        {g.label}
                      </Text>
                      <Text style={[styles.goalOptionDesc, { color: colors.textSecondary }]}>
                        {g.desc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.cardHeading, { color: colors.textPrimary, marginTop: 16 }]}>
                  🏃 Nível de Atividade Diária
                </Text>

                <View style={styles.chipsWrap}>
                  {[
                    { key: 'sedentary', label: '🛋️ Sedentário' },
                    { key: 'light', label: '🚶 Leve (1-3x)' },
                    { key: 'moderate', label: '🏃 Moderado (3-5x)' },
                    { key: 'intense', label: '⚡ Intenso (6-7x)' },
                    { key: 'very_active', label: '🏆 Atleta (2x/dia)' },
                  ].map((act) => (
                    <TouchableOpacity
                      key={act.key}
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            activityLevel === act.key ? colors.primaryMuted : colors.surfaceMuted,
                          borderColor:
                            activityLevel === act.key ? colors.primary : colors.cardBorder,
                        },
                      ]}
                      onPress={() => setActivityLevel(act.key as ActivityLevel)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color:
                              activityLevel === act.key ? colors.primary : colors.textSecondary,
                          },
                        ]}
                      >
                        {act.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Card 3: Metas Nutricionais Sugeridas & Editáveis */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                <View style={styles.spaceBetweenRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>
                      ⚡ Metas Nutricionais
                    </Text>
                    <Text style={[styles.cardSubheading, { color: colors.textSecondary }]}>
                      Calculadas com base científica. Você pode ajustá-las livremente.
                    </Text>
                  </View>
                  {hasManuallyEdited && (
                    <TouchableOpacity
                      onPress={handleResetToSuggestions}
                      style={[styles.resetBtn, { backgroundColor: colors.primaryMuted }]}
                    >
                      <Text style={[styles.resetBtnText, { color: colors.primary }]}>
                        ↺ Restaurar
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Basal & TDEE badges */}
                {suggested && (
                  <View style={[styles.metabolismRow, { backgroundColor: colors.surfaceMuted }]}>
                    <Text style={[styles.metabolismText, { color: colors.textSecondary }]}>
                      BMR: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{suggested.bmr} kcal</Text>
                    </Text>
                    <Text style={[styles.metabolismDivider, { color: colors.textDimmed }]}>•</Text>
                    <Text style={[styles.metabolismText, { color: colors.textSecondary }]}>
                      Gasto Total (TDEE): <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{suggested.tdee} kcal</Text>
                    </Text>
                  </View>
                )}

                {/* Calories target */}
                <View style={styles.macroBlock}>
                  <Text style={[styles.inputLabel, { color: colors.calories }]}>
                    🔥 CALORIAS DIÁRIAS (KCAL)
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.calorieInput,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.cardBorder,
                        color: colors.calories,
                      },
                    ]}
                    value={targetCalories}
                    onChangeText={setManualCalories}
                    keyboardType="numeric"
                  />
                </View>

                {/* Macros 3-Column */}
                <View style={styles.macroGridRow}>
                  {/* Protein */}
                  <View style={styles.macroGridCol}>
                    <Text style={[styles.inputLabel, { color: colors.protein }]}>PROTEÍNA</Text>
                    <View
                      style={[
                        styles.macroInputWrapper,
                        { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                      ]}
                    >
                      <TextInput
                        style={[styles.macroInput, { color: colors.protein }]}
                        value={targetProtein}
                        onChangeText={setManualProtein}
                        keyboardType="numeric"
                      />
                      <Text style={[styles.macroUnit, { color: colors.textDimmed }]}>g</Text>
                    </View>
                  </View>

                  {/* Carbs */}
                  <View style={styles.macroGridCol}>
                    <Text style={[styles.inputLabel, { color: colors.carbs }]}>CARBOS</Text>
                    <View
                      style={[
                        styles.macroInputWrapper,
                        { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                      ]}
                    >
                      <TextInput
                        style={[styles.macroInput, { color: colors.carbs }]}
                        value={targetCarbs}
                        onChangeText={setManualCarbs}
                        keyboardType="numeric"
                      />
                      <Text style={[styles.macroUnit, { color: colors.textDimmed }]}>g</Text>
                    </View>
                  </View>

                  {/* Fat */}
                  <View style={styles.macroGridCol}>
                    <Text style={[styles.inputLabel, { color: colors.fat }]}>GORDURA</Text>
                    <View
                      style={[
                        styles.macroInputWrapper,
                        { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                      ]}
                    >
                      <TextInput
                        style={[styles.macroInput, { color: colors.fat }]}
                        value={targetFat}
                        onChangeText={setManualFat}
                        keyboardType="numeric"
                      />
                      <Text style={[styles.macroUnit, { color: colors.textDimmed }]}>g</Text>
                    </View>
                  </View>
                </View>

                {/* Atwater Balance Check */}
                <View
                  style={[
                    styles.atwaterBanner,
                    {
                      backgroundColor: isAtwaterBalanced
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(245, 158, 11, 0.12)',
                      borderColor: isAtwaterBalanced ? colors.carbs : colors.calories,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.atwaterText,
                      { color: isAtwaterBalanced ? colors.carbs : colors.calories },
                    ]}
                  >
                    {isAtwaterBalanced
                      ? `✓ Macros balanceados: ${atwaterCalculatedKcal} kcal calculadas (4-4-9)`
                      : `ℹ️ Soma dos macros (${atwaterCalculatedKcal} kcal) difere da meta (${targetCalorieNum} kcal) em ${Math.abs(
                          atwaterDifference
                        )} kcal`}
                  </Text>
                </View>

                {/* Water Target */}
                <View style={[styles.macroBlock, { marginTop: 12 }]}>
                  <Text style={[styles.inputLabel, { color: colors.water }]}>
                    💧 META DE ÁGUA DIÁRIA (ML)
                  </Text>
                  <View
                    style={[
                      styles.macroInputWrapper,
                      { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                    ]}
                  >
                    <TextInput
                      style={[styles.macroInput, { color: colors.water }]}
                      value={targetWaterMl}
                      onChangeText={setManualWaterMl}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.macroUnit, { color: colors.textDimmed }]}>ml</Text>
                  </View>
                </View>
              </View>

              {/* Complete Onboarding Button */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: colors.primary },
                  isOnboardingSubmitting && { opacity: 0.7 },
                ]}
                onPress={handleOnboardingSubmit}
                disabled={isOnboardingSubmitting}
                activeOpacity={0.8}
              >
                {isOnboardingSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>🚀 Concluir e Iniciar -Frango</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandLogoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandLogoText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#10B981',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  passwordWrapper: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  onboardingContainer: {
    gap: 4,
  },
  stepBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 16,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardHeading: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSubheading: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  col: {
    flex: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  goalOptionsContainer: {
    gap: 10,
    marginTop: 6,
  },
  goalOptionCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  goalOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  goalOptionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  spaceBetweenRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metabolismRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  metabolismText: {
    fontSize: 12,
  },
  metabolismDivider: {
    marginHorizontal: 8,
    fontSize: 12,
  },
  macroBlock: {
    marginBottom: 12,
  },
  calorieInput: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  macroGridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  macroGridCol: {
    flex: 1,
  },
  macroInputWrapper: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  macroInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  macroUnit: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  atwaterBanner: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  atwaterText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
