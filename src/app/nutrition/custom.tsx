import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { DarkTheme } from '../../constants/theme';
import { SqliteDietRepository } from '../../database/repositories/SqliteDietRepository';
import { Button } from '../../components/ui/Button';
import { MealType } from '../../types/domain';
import {
  calculateAtwaterCalories,
  isAtwaterConsistent,
  MEAL_TYPE_NAMES,
} from '../../utils/nutrition';
import { useDiet } from '../../hooks/useDiet';

type EntryMode = '100g' | 'portion';

export default function CustomFoodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mealType?: MealType;
    date?: string;
    barcode?: string;
    initialName?: string;
  }>();

  const mealType: MealType = params.mealType || 'lunch';

  const db = useSQLiteContext();
  const dietRepo = useMemo(() => new SqliteDietRepository(db), [db]);
  const { addFoodLog } = useDiet();

  const [name, setName] = useState(params.initialName || '');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState(params.barcode || '');
  const [mode, setMode] = useState<EntryMode>('100g');
  const [portionGrams, setPortionGrams] = useState('30');
  const [portionName, setPortionName] = useState('porção');

  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');

  const [saving, setSaving] = useState(false);

  // Numeric values
  const numKcal = parseFloat(calories) || 0;
  const numP = parseFloat(protein) || 0;
  const numC = parseFloat(carbs) || 0;
  const numF = parseFloat(fat) || 0;
  const numFiber = fiber ? parseFloat(fiber) || 0 : undefined;
  const numPortionGrams = parseFloat(portionGrams) || 100;

  // Atwater Calculation
  const atwaterKcal = calculateAtwaterCalories(numP, numC, numF);
  const isConsistent = isAtwaterConsistent(numKcal, numP, numC, numF, 20);

  const validate = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Nome obrigatório', 'Por favor, informe o nome do alimento.');
      return false;
    }
    if (numKcal <= 0 && numP <= 0 && numC <= 0 && numF <= 0) {
      Alert.alert(
        'Valores nutricionais inválidos',
        'Por favor, informe calorias ou macronutrientes do alimento.'
      );
      return false;
    }
    if (mode === 'portion' && numPortionGrams <= 0) {
      Alert.alert('Porção inválida', 'Por favor, informe a quantidade da porção em gramas.');
      return false;
    }
    return true;
  };

  const getNormalizedFood = () => {
    if (mode === '100g') {
      return {
        name: brand.trim() ? `${name.trim()} (${brand.trim()})` : name.trim(),
        category: brand.trim() || 'Personalizados',
        servingGrams: 100,
        calories: Number(numKcal.toFixed(1)),
        protein: Number(numP.toFixed(1)),
        carbs: Number(numC.toFixed(1)),
        fat: Number(numF.toFixed(1)),
        fiber: numFiber !== undefined ? Number(numFiber.toFixed(1)) : undefined,
        barcode: barcode.trim() || undefined,
        source: 'custom' as const,
        servingUnitName: 'g',
        servingUnitGrams: 1,
      };
    } else {
      // Scale portion values to 100g standard
      const factor = 100 / numPortionGrams;
      return {
        name: brand.trim() ? `${name.trim()} (${brand.trim()})` : name.trim(),
        category: brand.trim() || 'Personalizados',
        servingGrams: 100,
        calories: Number((numKcal * factor).toFixed(1)),
        protein: Number((numP * factor).toFixed(1)),
        carbs: Number((numC * factor).toFixed(1)),
        fat: Number((numF * factor).toFixed(1)),
        fiber: numFiber !== undefined ? Number((numFiber * factor).toFixed(1)) : undefined,
        barcode: barcode.trim() || undefined,
        source: 'custom' as const,
        servingUnitName: portionName.trim() || 'porção',
        servingUnitGrams: numPortionGrams,
      };
    }
  };

  const handleSaveOnly = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const foodItem = getNormalizedFood();
      await dietRepo.createFood(foodItem);
      Alert.alert('Sucesso', 'Alimento salvo com sucesso no seu catálogo!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o alimento personalizado.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndLog = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const foodItem = getNormalizedFood();
      const created = await dietRepo.createFood(foodItem);

      // Serving size to log: if entered by portion, log the portion grams; otherwise 100g
      const gramsToLog = mode === 'portion' ? numPortionGrams : 100;

      await addFoodLog({
        mealType,
        food: created,
        servingGrams: gramsToLog,
      });

      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar e registrar o alimento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Criar Alimento</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Food Name */}
          <Text style={styles.label}>NOME DO ALIMENTO *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Pasta de Amendoim Integral"
            placeholderTextColor={DarkTheme.colors.textDimmed}
            value={name}
            onChangeText={setName}
          />

          {/* Brand */}
          <Text style={styles.label}>MARCA / FABRICANTE (OPCIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Dr. Peanut"
            placeholderTextColor={DarkTheme.colors.textDimmed}
            value={brand}
            onChangeText={setBrand}
          />

          {/* Barcode */}
          <Text style={styles.label}>CÓDIGO DE BARRAS (OPCIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 7898950001234"
            placeholderTextColor={DarkTheme.colors.textDimmed}
            value={barcode}
            onChangeText={setBarcode}
            keyboardType="numeric"
          />

          {/* Mode Switcher */}
          <Text style={styles.label}>MODO DE INSERÇÃO DOS MACROS:</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === '100g' && styles.modeBtnActive]}
              onPress={() => setMode('100g')}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeText, mode === '100g' && styles.modeTextActive]}>
                Valores por 100g
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeBtn, mode === 'portion' && styles.modeBtnActive]}
              onPress={() => setMode('portion')}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeText, mode === 'portion' && styles.modeTextActive]}>
                Por Porção (ex: 30g)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Portion Fields (if mode is portion) */}
          {mode === 'portion' && (
            <View style={styles.portionFieldsRow}>
              <View style={styles.portionCol}>
                <Text style={styles.label}>PESO DA PORÇÃO (g) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="30"
                  placeholderTextColor={DarkTheme.colors.textDimmed}
                  value={portionGrams}
                  onChangeText={setPortionGrams}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.portionCol}>
                <Text style={styles.label}>NOME DA PORÇÃO</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: scoop, fatia"
                  placeholderTextColor={DarkTheme.colors.textDimmed}
                  value={portionName}
                  onChangeText={setPortionName}
                />
              </View>
            </View>
          )}

          {/* Macro Inputs */}
          <Text style={styles.sectionTitle}>
            MACRONUTRIENTES {mode === '100g' ? '(por 100g)' : `(por ${numPortionGrams}g)`}:
          </Text>

          <View style={styles.macroGrid}>
            <View style={styles.macroInputWrapper}>
              <Text style={styles.macroInputLabel}>Calorias (kcal) *</Text>
              <TextInput
                style={styles.macroInput}
                placeholder="0"
                placeholderTextColor={DarkTheme.colors.textDimmed}
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.macroInputWrapper}>
              <Text style={styles.macroInputLabel}>Proteína (g) *</Text>
              <TextInput
                style={styles.macroInput}
                placeholder="0"
                placeholderTextColor={DarkTheme.colors.textDimmed}
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.macroInputWrapper}>
              <Text style={styles.macroInputLabel}>Carboidratos (g) *</Text>
              <TextInput
                style={styles.macroInput}
                placeholder="0"
                placeholderTextColor={DarkTheme.colors.textDimmed}
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.macroInputWrapper}>
              <Text style={styles.macroInputLabel}>Gorduras (g) *</Text>
              <TextInput
                style={styles.macroInput}
                placeholder="0"
                placeholderTextColor={DarkTheme.colors.textDimmed}
                value={fat}
                onChangeText={setFat}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.singleMacroRow}>
            <Text style={styles.macroInputLabel}>Fibras (g, opcional)</Text>
            <TextInput
              style={styles.macroInput}
              placeholder="0"
              placeholderTextColor={DarkTheme.colors.textDimmed}
              value={fiber}
              onChangeText={setFiber}
              keyboardType="numeric"
            />
          </View>

          {/* Atwater Consistency Badge */}
          {numKcal > 0 && (numP > 0 || numC > 0 || numF > 0) && (
            <View
              style={[
                styles.atwaterBox,
                !isConsistent && styles.atwaterBoxWarning,
              ]}
            >
              <Text style={styles.atwaterText}>
                ℹ️ Atwater Estimado: <Text style={styles.bold}>{atwaterKcal} kcal</Text>{' '}
                ({isConsistent ? 'Consistente' : 'Variação elevada'})
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionStack}>
            <Button
              title={`Salvar e Adicionar ao ${MEAL_TYPE_NAMES[mealType]}`}
              onPress={handleSaveAndLog}
              loading={saving}
              variant="primary"
            />
            <Button
              title="Salvar no Catálogo"
              onPress={handleSaveOnly}
              loading={saving}
              variant="secondary"
              style={styles.spacingBtn}
            />
            <Button
              title="Cancelar"
              onPress={() => router.back()}
              variant="ghost"
              style={styles.spacingBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DarkTheme.colors.background,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DarkTheme.spacing.md,
    paddingVertical: DarkTheme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.colors.cardBorder,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: DarkTheme.borderRadius.full,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    padding: DarkTheme.spacing.lg,
    paddingBottom: 40,
  },
  label: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.sm,
    paddingHorizontal: 12,
    height: 44,
    color: DarkTheme.colors.textPrimary,
    fontSize: 14,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  modeBtn: {
    flex: 1,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: DarkTheme.colors.primaryMuted,
    borderColor: DarkTheme.colors.primary,
  },
  modeText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  modeTextActive: {
    color: DarkTheme.colors.primary,
  },
  portionFieldsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  portionCol: {
    flex: 1,
  },
  sectionTitle: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  macroInputWrapper: {
    width: '48%',
  },
  macroInputLabel: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  macroInput: {
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.sm,
    paddingHorizontal: 12,
    height: 44,
    color: DarkTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  singleMacroRow: {
    marginTop: 10,
    width: '48%',
  },
  atwaterBox: {
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.sm,
    padding: 10,
    marginTop: 14,
  },
  atwaterBoxWarning: {
    borderColor: DarkTheme.colors.calories,
    backgroundColor: DarkTheme.colors.caloriesTrack,
  },
  atwaterText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
  },
  bold: {
    color: DarkTheme.colors.textPrimary,
    fontWeight: '700',
  },
  actionStack: {
    marginTop: 24,
    gap: 8,
  },
  spacingBtn: {
    marginTop: 4,
  },
});
