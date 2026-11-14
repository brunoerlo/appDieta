import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProfile } from '../../hooks/useProfile';
import { useTheme } from '../../hooks/useTheme';
import { parseDecimalInput } from '../../utils/nutrition';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, toggleTheme, isDark } = useTheme();
  const { profile, updateProfile, logout, isLoading } = useProfile();
  const [loggingOut, setLoggingOut] = useState(false);

  // Local state for editable fields
  const [name, setName] = useState('Atleta');
  const [email, setEmail] = useState('');
  const [targetCalories, setTargetCalories] = useState('2000');
  const [targetProtein, setTargetProtein] = useState('150');
  const [targetCarbs, setTargetCarbs] = useState('200');
  const [targetFat, setTargetFat] = useState('60');
  const [targetWaterMl, setTargetWaterMl] = useState('2500');

  // Optional athlete fields
  const [targetWeight, setTargetWeight] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [trainingGoal, setTrainingGoal] = useState<'hypertrophy' | 'cutting' | 'maintenance'>('hypertrophy');
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'moderate' | 'intense'>('moderate');

  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active && profile) {
        setName(profile.name || 'Atleta');
        setEmail(profile.email || '');
        setTargetCalories(String(profile.targetCalories || 2000));
        setTargetProtein(String(profile.targetProtein || 150));
        setTargetCarbs(String(profile.targetCarbs || 200));
        setTargetFat(String(profile.targetFat || 60));
        setTargetWaterMl(String(profile.targetWaterMl || 2500));

        if (profile.targetWeightKg) setTargetWeight(String(profile.targetWeightKg));
        if (profile.heightCm) setHeightCm(String(profile.heightCm));
        if (profile.trainingGoal) setTrainingGoal(profile.trainingGoal as any);
        if (profile.activityLevel) setActivityLevel(profile.activityLevel as any);
      }
    });
    return () => {
      active = false;
    };
  }, [profile]);


  // Macro Energy Math (Atwater 4-4-9)
  const pGrams = Math.max(0, parseDecimalInput(targetProtein) || 0);
  const cGrams = Math.max(0, parseDecimalInput(targetCarbs) || 0);
  const fGrams = Math.max(0, parseDecimalInput(targetFat) || 0);
  const computedKcal = Math.round(pGrams * 4 + cGrams * 4 + fGrams * 9);
  const goalKcal = Math.max(0, parseDecimalInput(targetCalories) || 0);
  const kcalDiff = computedKcal - goalKcal;

  const handleAdjustCalories = (delta: number) => {
    const parsedCur = parseDecimalInput(targetCalories);
    const cur = Number.isFinite(parsedCur) && parsedCur > 0 ? parsedCur : 2000;
    const next = Math.max(1000, Math.min(6000, cur + delta));
    setTargetCalories(String(next));
  };

  const handleWaterPreset = (ml: number) => {
    setTargetWaterMl(String(ml));
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Dados Inválidos', 'Por favor, informe um nome válido.');
      return;
    }

    const parsedCalories = parseDecimalInput(targetCalories);
    const parsedProtein = parseDecimalInput(targetProtein);
    const parsedCarbs = parseDecimalInput(targetCarbs);
    const parsedFat = parseDecimalInput(targetFat);
    const parsedWater = Math.round(parseDecimalInput(targetWaterMl));
    const parsedTargetWeight = targetWeight.trim() ? parseDecimalInput(targetWeight) : undefined;
    const parsedHeight = heightCm.trim() ? parseDecimalInput(heightCm) : undefined;

    if (!Number.isFinite(parsedCalories) || parsedCalories < 500 || parsedCalories > 20000) {
      Alert.alert('Dados Inválidos', 'Informe uma meta calórica válida entre 500 e 20000 kcal.');
      return;
    }
    if (!Number.isFinite(parsedProtein) || parsedProtein < 0 || parsedProtein > 2000) {
      Alert.alert('Dados Inválidos', 'Informe uma meta de proteína válida entre 0g e 2000g.');
      return;
    }
    if (!Number.isFinite(parsedCarbs) || parsedCarbs < 0 || parsedCarbs > 3000) {
      Alert.alert('Dados Inválidos', 'Informe uma meta de carboidratos válida entre 0g e 3000g.');
      return;
    }
    if (!Number.isFinite(parsedFat) || parsedFat < 0 || parsedFat > 1000) {
      Alert.alert('Dados Inválidos', 'Informe uma meta de gorduras válida entre 0g e 1000g.');
      return;
    }
    if (!Number.isFinite(parsedWater) || parsedWater < 500 || parsedWater > 20000) {
      Alert.alert('Dados Inválidos', 'Informe uma meta hídrica válida entre 500ml e 20000ml.');
      return;
    }
    if (
      parsedTargetWeight !== undefined &&
      (!Number.isFinite(parsedTargetWeight) || parsedTargetWeight < 20 || parsedTargetWeight > 400)
    ) {
      Alert.alert('Dados Inválidos', 'Informe uma meta de peso válida entre 20kg e 400kg.');
      return;
    }
    if (
      parsedHeight !== undefined &&
      (!Number.isFinite(parsedHeight) || parsedHeight < 50 || parsedHeight > 300)
    ) {
      Alert.alert('Dados Inválidos', 'Informe uma altura válida entre 50cm e 300cm.');
      return;
    }

    setSaving(true);
    setFeedbackMsg(null);
    try {
      await updateProfile({
        name: trimmedName,
        targetCalories: parsedCalories,
        targetProtein: parsedProtein,
        targetCarbs: parsedCarbs,
        targetFat: parsedFat,
        targetWaterMl: parsedWater,
        targetWeightKg: parsedTargetWeight,
        heightCm: parsedHeight,
        trainingGoal,
        activityLevel,
      });
      setFeedbackMsg('Configurações salvas com sucesso!');
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackMsg(null);
        feedbackTimerRef.current = null;
      }, 3000);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza de que deseja sair da sua conta no -Frango? Seus dados e treinos permanecerão salvos com segurança neste dispositivo.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair da Conta',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              router.replace('/auth');
            } catch {
              Alert.alert('Erro', 'Não foi possível encerrar a sessão. Tente novamente.');
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Screen Title */}
      <View style={styles.topHeader}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Perfil & Metas</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Athlete Header Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.athleteRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.athleteInfo}>
              <TextInput
                style={[styles.athleteNameInput, { color: colors.textPrimary }]}
                value={name}
                onChangeText={setName}
                maxLength={120}
                placeholder="Nome do Atleta"
                placeholderTextColor={colors.textDimmed}
              />
              <TextInput
                style={[styles.athleteEmailInput, { color: colors.textSecondary }]}
                value={profile?.email || email}
                editable={false}
                maxLength={254}
                placeholder="atleta@menosfrango.app"
                placeholderTextColor={colors.textDimmed}
                keyboardType="email-address"
              />
              <View style={[styles.roleBadge, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.roleText, { color: colors.primary }]}>⚡ Atleta -Frango</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Nutritional Goals Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Metas Nutricionais Diárias</Text>
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Calorias e macronutrientes alinhados ao seu objetivo
          </Text>

          {/* Calories Target Input */}
          <View style={styles.caloriesBox}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Calorias (kcal)</Text>
            <View style={styles.caloriesInputRow}>
              <TouchableOpacity
                onPress={() => handleAdjustCalories(-100)}
                style={[styles.calorieStepBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
              >
                <Text style={[styles.calorieStepText, { color: colors.textPrimary }]}>-100</Text>
              </TouchableOpacity>

              <View
                style={[
                  styles.calorieInputWrapper,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                ]}
              >
                <TextInput
                  style={[styles.calorieInput, { color: colors.calories }]}
                  value={targetCalories}
                  onChangeText={setTargetCalories}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <Text style={[styles.calorieUnit, { color: colors.textDimmed }]}>kcal</Text>
              </View>

              <TouchableOpacity
                onPress={() => handleAdjustCalories(100)}
                style={[styles.calorieStepBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
              >
                <Text style={[styles.calorieStepText, { color: colors.textPrimary }]}>+100</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Macros Row: Protein, Carbs, Fat */}
          <View style={styles.macrosRow}>
            {/* Protein */}
            <View style={styles.macroCol}>
              <View style={styles.macroHeader}>
                <View style={[styles.dot, { backgroundColor: colors.protein }]} />
                <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Proteínas</Text>
              </View>
              <View
                style={[
                  styles.macroInputWrapper,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                ]}
              >
                <TextInput
                  style={[styles.macroInput, { color: colors.protein }]}
                  value={targetProtein}
                  onChangeText={setTargetProtein}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <Text style={[styles.macroUnit, { color: colors.textDimmed }]}>g</Text>
              </View>
              <Text style={[styles.macroKcalSubtext, { color: colors.textDimmed }]}>
                {Math.round(pGrams * 4)} kcal
              </Text>
            </View>

            {/* Carbs */}
            <View style={styles.macroCol}>
              <View style={styles.macroHeader}>
                <View style={[styles.dot, { backgroundColor: colors.carbs }]} />
                <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Carboidratos</Text>
              </View>
              <View
                style={[
                  styles.macroInputWrapper,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                ]}
              >
                <TextInput
                  style={[styles.macroInput, { color: colors.carbs }]}
                  value={targetCarbs}
                  onChangeText={setTargetCarbs}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <Text style={[styles.macroUnit, { color: colors.textDimmed }]}>g</Text>
              </View>
              <Text style={[styles.macroKcalSubtext, { color: colors.textDimmed }]}>
                {Math.round(cGrams * 4)} kcal
              </Text>
            </View>

            {/* Fat */}
            <View style={styles.macroCol}>
              <View style={styles.macroHeader}>
                <View style={[styles.dot, { backgroundColor: colors.fat }]} />
                <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Gorduras</Text>
              </View>
              <View
                style={[
                  styles.macroInputWrapper,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                ]}
              >
                <TextInput
                  style={[styles.macroInput, { color: colors.fat }]}
                  value={targetFat}
                  onChangeText={setTargetFat}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <Text style={[styles.macroUnit, { color: colors.textDimmed }]}>g</Text>
              </View>
              <Text style={[styles.macroKcalSubtext, { color: colors.textDimmed }]}>
                {Math.round(fGrams * 9)} kcal
              </Text>
            </View>
          </View>

          {/* Atwater Macro Energy Balance */}
          <View style={[styles.atwaterBanner, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.atwaterTitle, { color: colors.textSecondary }]}>
              Balanço Atwater: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{computedKcal} kcal</Text>
            </Text>
            <Text
              style={[
                styles.atwaterStatus,
                { color: Math.abs(kcalDiff) <= 50 ? colors.primary : colors.calories },
              ]}
            >
              {Math.abs(kcalDiff) <= 50
                ? '✓ Macros perfeitamente balanceados com a meta'
                : `Diferença de ${kcalDiff > 0 ? '+' : ''}${kcalDiff} kcal vs meta`}
            </Text>
          </View>
        </View>

        {/* Daily Hydration Target Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Meta Hídrica Diária</Text>
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Consumo ideal de água para performance e recuperação
          </Text>

          <View style={styles.waterInputRow}>
            <View
              style={[
                styles.waterInputWrapper,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
              ]}
            >
              <TextInput
                style={[styles.waterInput, { color: colors.water }]}
                value={targetWaterMl}
                onChangeText={setTargetWaterMl}
                keyboardType="numeric"
                maxLength={10}
              />
              <Text style={[styles.waterUnit, { color: colors.textDimmed }]}>ml</Text>
            </View>

            {/* Hydration Presets */}
            <View style={styles.presetChips}>
              {[2000, 2500, 3000, 3500, 4000].map((ml) => (
                <TouchableOpacity
                  key={ml}
                  onPress={() => handleWaterPreset(ml)}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor:
                        parseInt(targetWaterMl, 10) === ml ? colors.water : colors.surfaceMuted,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetText,
                      {
                        color:
                          parseInt(targetWaterMl, 10) === ml ? '#FFFFFF' : colors.textSecondary,
                        fontWeight: parseInt(targetWaterMl, 10) === ml ? '700' : '500',
                      },
                    ]}
                  >
                    {ml}ml
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Theme & Appearance Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.themeToggleRow}>
            <View style={styles.themeInfo}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Aparência da Interface
              </Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                {isDark
                  ? '🌙 Dark OLED (#0A0A0C) — Máximo contraste esportivo'
                  : '☀️ Modo Claro Esportivo (#F8F9FA) — Alta visibilidade'}
              </Text>
            </View>

            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#CBD5E1', true: colors.primary }}
              thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : isDark ? '#FFFFFF' : '#F1F5F9'}
            />
          </View>
        </View>

        {/* Athlete Physical Stats & Goals */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Dados Corporais & Treino</Text>
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Parâmetros utilizados para cálculo de volume e progressão
          </Text>

          <View style={styles.statsRow}>
            {/* Height */}
            <View style={styles.statCol}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Altura (cm)</Text>
              <View
                style={[
                  styles.statInputWrapper,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                ]}
              >
                <TextInput
                  style={[styles.statInput, { color: colors.textPrimary }]}
                  value={heightCm}
                  onChangeText={setHeightCm}
                  placeholder="178"
                  placeholderTextColor={colors.textDimmed}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <Text style={[styles.statUnit, { color: colors.textDimmed }]}>cm</Text>
              </View>
            </View>

            {/* Target Weight */}
            <View style={styles.statCol}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Meta de Peso (kg)</Text>
              <View
                style={[
                  styles.statInputWrapper,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                ]}
              >
                <TextInput
                  style={[styles.statInput, { color: colors.textPrimary }]}
                  value={targetWeight}
                  onChangeText={setTargetWeight}
                  placeholder="80.0"
                  placeholderTextColor={colors.textDimmed}
                  keyboardType="decimal-pad"
                  maxLength={10}
                />
                <Text style={[styles.statUnit, { color: colors.textDimmed }]}>kg</Text>
              </View>
            </View>
          </View>

          {/* Goal Picker */}
          <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 14 }]}>
            Objetivo Principal
          </Text>
          <View style={styles.goalChipsRow}>
            {[
              { key: 'hypertrophy', label: 'Hipertrofia' },
              { key: 'cutting', label: 'Definição (Cutting)' },
              { key: 'maintenance', label: 'Manutenção' },
            ].map((g) => {
              const active = trainingGoal === g.key;
              return (
                <TouchableOpacity
                  key={g.key}
                  onPress={() => setTrainingGoal(g.key as any)}
                  style={[
                    styles.goalChip,
                    {
                      backgroundColor: active ? colors.primary : colors.surfaceMuted,
                      borderColor: active ? colors.primary : colors.cardBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.goalChipText,
                      { color: active ? '#FFFFFF' : colors.textSecondary, fontWeight: active ? '700' : '500' },
                    ]}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Feedback message */}
        {feedbackMsg && (
          <View style={[styles.feedbackBanner, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
            <Text style={[styles.feedbackText, { color: colors.primary }]}>{feedbackMsg}</Text>
          </View>
        )}

        {/* Save Action Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSave}
          disabled={saving || isLoading}
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Salvando Configurações...' : 'Salvar Alterações'}
          </Text>
        </TouchableOpacity>

        {/* Account & Session Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 4 }]}>
          <View style={styles.sessionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Conta & Sessão</Text>
              <Text style={[styles.sessionEmailText, { color: colors.textSecondary }]}>
                Conectado como <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{profile?.email || '—'}</Text>
              </Text>
            </View>
            <View style={[styles.activeStatusPill, { backgroundColor: colors.primaryMuted }]}>
              <Text style={[styles.activeStatusText, { color: colors.primary }]}>● Ativo</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLogout}
            disabled={loggingOut || isLoading}
            style={[
              styles.logoutBtn,
              {
                backgroundColor: colors.dangerMuted,
                borderColor: colors.danger,
              },
            ]}
          >
            <Text style={[styles.logoutBtnText, { color: colors.danger }]}>
              {loggingOut ? 'Encerrando sessão...' : '🚪 Sair da Conta'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  athleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
  },
  athleteInfo: {
    flex: 1,
  },
  athleteNameInput: {
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 2,
  },
  athleteEmailInput: {
    fontSize: 13,
    paddingVertical: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionDesc: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  caloriesBox: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  caloriesInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calorieStepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  calorieStepText: {
    fontSize: 13,
    fontWeight: '700',
  },
  calorieInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
  },
  calorieInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
  },
  calorieUnit: {
    fontSize: 13,
    fontWeight: '600',
  },
  macrosRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  macroCol: {
    flex: 1,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  macroInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 42,
  },
  macroInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  macroUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  macroKcalSubtext: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  atwaterBanner: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  atwaterTitle: {
    fontSize: 12,
  },
  atwaterStatus: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  waterInputRow: {
    gap: 12,
  },
  waterInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
  },
  waterInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
  },
  waterUnit: {
    fontSize: 13,
    fontWeight: '600',
  },
  presetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetText: {
    fontSize: 11,
  },
  themeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeInfo: {
    flex: 1,
    paddingRight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCol: {
    flex: 1,
  },
  statInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
  },
  statInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  goalChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  goalChipText: {
    fontSize: 12,
  },
  feedbackBanner: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sessionEmailText: {
    fontSize: 13,
    marginTop: 2,
  },
  activeStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
