import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Badge } from '../ui/Badge';
import { useWorkout } from '../../hooks/useWorkout';

export interface ExercisePickerResult {
  name: string;
  muscleGroup: string;
  targetSets: number;
  defaultRestSeconds: number;
}

export interface ExercisePickerModalProps {
  visible: boolean;
  onSelectExercise: (exercise: ExercisePickerResult) => void;
  onClose: () => void;
}

interface CatalogExercise {
  id?: string;
  name: string;
  muscleGroup: string;
  defaultRestSeconds: number;
  targetSets?: number;
  isCustom?: boolean;
}

export const EXERCISE_CATEGORIES = [
  'Peito',
  'Costas',
  'Quadríceps',
  'Posterior',
  'Glúteos',
  'Ombros',
  'Bíceps',
  'Tríceps',
  'Abdômen',
  'Panturrilha',
  'Cardio / Funcional',
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

const FILTER_MUSCLE_GROUPS = ['Todos', ...EXERCISE_CATEGORIES];

const DEFAULT_EXERCISE_CATALOG: CatalogExercise[] = [
  // Peito
  { name: 'Supino Reto com Barra', muscleGroup: 'Peito', defaultRestSeconds: 90 },
  { name: 'Supino Inclinado com Halteres', muscleGroup: 'Peito', defaultRestSeconds: 90 },
  { name: 'Supino Declinado com Barra', muscleGroup: 'Peito', defaultRestSeconds: 75 },
  { name: 'Crossover na Polia Média', muscleGroup: 'Peito', defaultRestSeconds: 60 },
  { name: 'Crucifixo Reto com Halteres', muscleGroup: 'Peito', defaultRestSeconds: 60 },
  { name: 'Paralelas / Dips', muscleGroup: 'Peito', defaultRestSeconds: 90 },
  { name: 'Voador / Peck Deck', muscleGroup: 'Peito', defaultRestSeconds: 60 },

  // Costas
  { name: 'Puxada Alta na Frente', muscleGroup: 'Costas', defaultRestSeconds: 75 },
  { name: 'Remada Curvada com Barra', muscleGroup: 'Costas', defaultRestSeconds: 90 },
  { name: 'Remada Baixa no Triângulo', muscleGroup: 'Costas', defaultRestSeconds: 60 },
  { name: 'Remada Unilateral com Halter (Serrote)', muscleGroup: 'Costas', defaultRestSeconds: 60 },
  { name: 'Barra Fixa (Pronada)', muscleGroup: 'Costas', defaultRestSeconds: 90 },
  { name: 'Levantamento Terra', muscleGroup: 'Costas', defaultRestSeconds: 120 },
  { name: 'Pulldown na Polia Alta', muscleGroup: 'Costas', defaultRestSeconds: 60 },

  // Quadríceps & Pernas
  { name: 'Agachamento Livre com Barra', muscleGroup: 'Quadríceps', defaultRestSeconds: 120 },
  { name: 'Leg Press 45°', muscleGroup: 'Quadríceps', defaultRestSeconds: 90 },
  { name: 'Cadeira Extensora', muscleGroup: 'Quadríceps', defaultRestSeconds: 60 },
  { name: 'Agachamento Búlgaro', muscleGroup: 'Quadríceps', defaultRestSeconds: 90 },
  { name: 'Passada com Halteres', muscleGroup: 'Quadríceps', defaultRestSeconds: 75 },
  { name: 'Hack Squat', muscleGroup: 'Quadríceps', defaultRestSeconds: 90 },

  // Posterior
  { name: 'Mesa Flexora', muscleGroup: 'Posterior', defaultRestSeconds: 60 },
  { name: 'Cadeira Flexora', muscleGroup: 'Posterior', defaultRestSeconds: 60 },
  { name: 'Stiff com Barra', muscleGroup: 'Posterior', defaultRestSeconds: 90 },

  // Glúteos
  { name: 'Elevação Pélvica com Barra', muscleGroup: 'Glúteos', defaultRestSeconds: 90 },
  { name: 'Glúteo no Cabo / Coice na Polia', muscleGroup: 'Glúteos', defaultRestSeconds: 60 },
  { name: 'Cadeira Abdutora', muscleGroup: 'Glúteos', defaultRestSeconds: 60 },

  // Ombros
  { name: 'Desenvolvimento Militar com Barra', muscleGroup: 'Ombros', defaultRestSeconds: 90 },
  { name: 'Desenvolvimento com Halteres', muscleGroup: 'Ombros', defaultRestSeconds: 75 },
  { name: 'Elevação Lateral com Halteres', muscleGroup: 'Ombros', defaultRestSeconds: 60 },
  { name: 'Elevação Lateral na Polia', muscleGroup: 'Ombros', defaultRestSeconds: 60 },
  { name: 'Crucifixo Invertido na Máquina', muscleGroup: 'Ombros', defaultRestSeconds: 60 },
  { name: 'Face Pull na Polia', muscleGroup: 'Ombros', defaultRestSeconds: 60 },

  // Bíceps
  { name: 'Rosca Direta com Barra W', muscleGroup: 'Bíceps', defaultRestSeconds: 60 },
  { name: 'Rosca Alternada com Halteres', muscleGroup: 'Bíceps', defaultRestSeconds: 60 },
  { name: 'Rosca Martelo com Halteres', muscleGroup: 'Bíceps', defaultRestSeconds: 60 },
  { name: 'Rosca Scott com Barra', muscleGroup: 'Bíceps', defaultRestSeconds: 60 },
  { name: 'Rosca Concentrada', muscleGroup: 'Bíceps', defaultRestSeconds: 60 },

  // Tríceps
  { name: 'Tríceps Corda na Polia', muscleGroup: 'Tríceps', defaultRestSeconds: 60 },
  { name: 'Tríceps Barra Reta na Polia', muscleGroup: 'Tríceps', defaultRestSeconds: 60 },
  { name: 'Tríceps Testa com Barra W', muscleGroup: 'Tríceps', defaultRestSeconds: 75 },
  { name: 'Tríceps Francês com Halter', muscleGroup: 'Tríceps', defaultRestSeconds: 60 },
  { name: 'Tríceps Coice na Polia', muscleGroup: 'Tríceps', defaultRestSeconds: 60 },

  // Abdômen
  { name: 'Abdominal Supra na Polia', muscleGroup: 'Abdômen', defaultRestSeconds: 45 },
  { name: 'Elevação de Pernas na Barra Fixa', muscleGroup: 'Abdômen', defaultRestSeconds: 45 },
  { name: 'Prancha Isométrica', muscleGroup: 'Abdômen', defaultRestSeconds: 45 },

  // Panturrilha
  { name: 'Panturrilha em Pé na Máquina', muscleGroup: 'Panturrilha', defaultRestSeconds: 45 },
  { name: 'Panturrilha Sentado (Gêmeos)', muscleGroup: 'Panturrilha', defaultRestSeconds: 45 },

  // Cardio / Funcional
  { name: 'Corrida na Esteira', muscleGroup: 'Cardio / Funcional', defaultRestSeconds: 60 },
  { name: 'Pular Corda', muscleGroup: 'Cardio / Funcional', defaultRestSeconds: 45 },
  { name: 'Burpee Funcional', muscleGroup: 'Cardio / Funcional', defaultRestSeconds: 60 },
  { name: 'Bicicleta Ergométrica', muscleGroup: 'Cardio / Funcional', defaultRestSeconds: 60 },
  { name: 'Polichinelo', muscleGroup: 'Cardio / Funcional', defaultRestSeconds: 30 },
];

export const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({
  visible,
  onSelectExercise,
  onClose,
}) => {
  const { customExercises, createCustomExercise } = useWorkout();

  // Mode: 'picker' (list) or 'create' (form)
  const [viewMode, setViewMode] = useState<'picker' | 'create'>('picker');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('Todos');

  // Create Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ExerciseCategory>('Peito');
  const [newSets, setNewSets] = useState(3);
  const newRestSeconds = 60;
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Merging custom exercises with default catalog exercises
  const mergedExercises = useMemo(() => {
    const customList: CatalogExercise[] = (customExercises || []).map((ce) => ({
      id: ce.id,
      name: ce.name,
      muscleGroup: ce.category,
      defaultRestSeconds: ce.defaultRestSeconds || 60,
      targetSets: ce.defaultSets || 3,
      isCustom: true,
    }));

    return [...customList, ...DEFAULT_EXERCISE_CATALOG];
  }, [customExercises]);

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedExercises.filter((ex) => {
      const matchesSearch = !q || ex.name.toLowerCase().includes(q);
      const matchesMuscle =
        selectedMuscle === 'Todos' || ex.muscleGroup === selectedMuscle;
      return matchesSearch && matchesMuscle;
    });
  }, [mergedExercises, searchQuery, selectedMuscle]);

  const handleSelect = (item: CatalogExercise) => {
    onSelectExercise({
      name: item.name,
      muscleGroup: item.muscleGroup,
      targetSets: item.targetSets || 3,
      defaultRestSeconds: item.defaultRestSeconds,
    });
    setSearchQuery('');
    onClose();
  };

  const openCreateForm = (prefillName = '') => {
    setNewName(prefillName);
    setNameError(false);
    if (selectedMuscle !== 'Todos') {
      setNewCategory(selectedMuscle as ExerciseCategory);
    } else {
      setNewCategory('Peito');
    }
    setNewSets(3);
    setViewMode('create');
  };

  const handleSaveCustomExercise = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setNameError(true);
      return;
    }

    setIsSaving(true);
    try {
      const created = await createCustomExercise({
        name: trimmed,
        category: newCategory,
        defaultSets: newSets,
        defaultRestSeconds: newRestSeconds,
      });

      // Immediately select newly created exercise in routine
      onSelectExercise({
        name: created.name,
        muscleGroup: created.category,
        targetSets: created.defaultSets,
        defaultRestSeconds: created.defaultRestSeconds,
      });

      // Reset and close
      setViewMode('picker');
      setSearchQuery('');
      onClose();
    } catch (err: any) {
      Alert.alert('Erro ao criar', err?.message || 'Falha ao salvar exercício personalizado.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalClose = () => {
    setViewMode('picker');
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent={true}
      onRequestClose={handleModalClose}
    >
      <SafeAreaView style={styles.container}>
        {viewMode === 'picker' ? (
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Selecionar Exercício</Text>
              <TouchableOpacity
                onPress={handleModalClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.closeBtn}
                accessibilityLabel="Fechar modal"
                accessibilityRole="button"
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nome do exercício..."
                placeholderTextColor={colors.textDimmed}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Muscle Group Horizontal Filter Pills (11 Categories + Todos) */}
            <View style={styles.pillsContainer}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={FILTER_MUSCLE_GROUPS}
                keyExtractor={(item) => item}
                contentContainerStyle={styles.pillsList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => setSelectedMuscle(item)}
                    style={[
                      styles.musclePill,
                      selectedMuscle === item && styles.musclePillActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Filtrar por ${item}`}
                  >
                    <Text
                      style={[
                        styles.musclePillText,
                        selectedMuscle === item && styles.musclePillTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>

            {/* Prominent Dedicated Action Button: + Criar Novo Exercício */}
            <View style={styles.createBannerContainer}>
              <TouchableOpacity
                style={styles.createBannerBtn}
                onPress={() => openCreateForm(searchQuery.trim())}
                accessibilityRole="button"
                accessibilityLabel="Criar novo exercício personalizado"
              >
                <View style={styles.createBannerLeft}>
                  <View style={styles.createBannerIconCircle}>
                    <Text style={styles.createBannerIcon}>＋</Text>
                  </View>
                  <View>
                    <Text style={styles.createBannerTitle}>Criar Novo Exercício</Text>
                    <Text style={styles.createBannerSubtitle}>
                      Personalize nome, categoria e séries padrão
                    </Text>
                  </View>
                </View>
                <Text style={styles.createBannerArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Exercise List */}
            <FlatList
              data={filteredExercises}
              keyExtractor={(item, idx) => item.id || `${item.name}-${idx}`}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.exerciseItem}
                  onPress={() => handleSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Selecionar ${item.name}`}
                >
                  <View style={styles.exerciseInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.exerciseName}>{item.name}</Text>
                      {item.isCustom && (
                        <Badge
                          label="Personalizado"
                          color={colors.calories}
                          backgroundColor="rgba(245, 158, 11, 0.15)"
                        />
                      )}
                    </View>
                    <View style={styles.metaRow}>
                      <Badge
                        label={item.muscleGroup}
                        color={colors.primary}
                        backgroundColor={colors.primaryMuted}
                      />
                      {item.targetSets !== undefined && (
                        <Text style={styles.metaRest}>
                          • {item.targetSets} séries
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.addIconCircle}>
                    <Text style={styles.addIconText}>+</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Nenhum exercício encontrado{searchQuery ? ` para "${searchQuery}"` : ''}.
                  </Text>
                  <TouchableOpacity
                    style={styles.customBtn}
                    onPress={() => openCreateForm(searchQuery.trim())}
                    accessibilityRole="button"
                    accessibilityLabel={`Criar exercício ${searchQuery}`}
                  >
                    <Text style={styles.customBtnText}>
                      + Criar exercício {searchQuery.trim() ? `"${searchQuery.trim()}"` : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </>
        ) : (
          /* CREATE EXERCISE FORM IN-MODAL VIEW */
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Create Top Bar */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => setViewMode('picker')}
                style={styles.cancelBtn}
                accessibilityRole="button"
                accessibilityLabel="Cancelar criação"
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Novo Exercício</Text>
              <TouchableOpacity
                onPress={handleSaveCustomExercise}
                disabled={isSaving}
                style={styles.saveBtn}
                accessibilityRole="button"
                accessibilityLabel="Salvar e adicionar exercício"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.saveText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.formScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Nome do Exercício */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nome do Exercício *</Text>
                <TextInput
                  style={[styles.formInput, nameError && styles.formInputError]}
                  placeholder="Ex: Elevação Pélvica, Agachamento Búlgaro..."
                  placeholderTextColor={colors.textDimmed}
                  value={newName}
                  onChangeText={(val) => {
                    setNewName(val);
                    if (nameError) setNameError(false);
                  }}
                  autoFocus={true}
                />
                {nameError && (
                  <Text style={styles.errorText}>Por favor, digite o nome do exercício.</Text>
                )}
              </View>

              {/* Categoria / Grupo Muscular (11 opções) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Categoria / Grupo Muscular *</Text>
                <View style={styles.categoryGrid}>
                  {EXERCISE_CATEGORIES.map((cat) => {
                    const isSelected = newCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setNewCategory(cat)}
                        style={[
                          styles.categoryChip,
                          isSelected && styles.categoryChipActive,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Selecionar categoria ${cat}`}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Séries Padrão (Stepper + Presets) */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Séries Padrão</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setNewSets((s) => Math.max(1, s - 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Diminuir séries"
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.stepperValueContainer}>
                    <Text style={styles.stepperValueText}>{newSets}</Text>
                    <Text style={styles.stepperUnitText}>séries</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setNewSets((s) => Math.min(10, s + 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Aumentar séries"
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Preset Chips */}
                <View style={styles.presetChipsRow}>
                  {[3, 4, 5].map((count) => (
                    <TouchableOpacity
                      key={count}
                      onPress={() => setNewSets(count)}
                      style={[
                        styles.quickPresetChip,
                        newSets === count && styles.quickPresetChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickPresetText,
                          newSets === count && styles.quickPresetTextActive,
                        ]}
                      >
                        {count} séries
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Botão de Salvar no final da rolagem */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSaveCustomExercise}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Salvar e adicionar exercício à rotina"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.submitBtnText}>Salvar e Adicionar ao Treino</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  cancelBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  saveBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  saveText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    color: colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
  },
  pillsContainer: {
    marginBottom: spacing.sm,
  },
  pillsList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  musclePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 36,
    justifyContent: 'center',
  },
  musclePillActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  musclePillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  musclePillTextActive: {
    color: colors.primary,
  },
  createBannerContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  createBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  createBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  createBannerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBannerIcon: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  createBannerTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  createBannerSubtitle: {
    color: colors.textDimmed,
    fontSize: 11,
  },
  createBannerArrow: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    minHeight: 64,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaRest: {
    color: colors.textDimmed,
    fontSize: 12,
  },
  addIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  addIconText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  customBtn: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  customBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Form Styles
  formScrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    color: colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 48,
  },
  formInputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 36,
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  categoryChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: colors.primary,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  stepperBtn: {
    width: 60,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  stepperValueContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  stepperUnitText: {
    color: colors.textDimmed,
    fontSize: 11,
  },
  presetChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xs,
  },
  quickPresetChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  quickPresetChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  quickPresetText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  quickPresetTextActive: {
    color: colors.primary,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 48,
  },
  submitBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
});
