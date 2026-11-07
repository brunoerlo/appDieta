import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkTheme } from '../../constants/theme';
import { Badge } from '../ui/Badge';

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
  name: string;
  muscleGroup: string;
  defaultRestSeconds: number;
}

const MUSCLE_GROUPS = [
  'Todos',
  'Peito',
  'Costas',
  'Quadríceps',
  'Posterior',
  'Ombros',
  'Bíceps',
  'Tríceps',
  'Abdômen',
  'Panturrilha',
];

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
  { name: 'Elevação Pélvica com Barra', muscleGroup: 'Posterior', defaultRestSeconds: 90 },

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

  // Abdômen & Panturrilha
  { name: 'Abdominal Supra na Polia', muscleGroup: 'Abdômen', defaultRestSeconds: 45 },
  { name: 'Elevação de Pernas na Barra Fixa', muscleGroup: 'Abdômen', defaultRestSeconds: 45 },
  { name: 'Prancha Isométrica', muscleGroup: 'Abdômen', defaultRestSeconds: 45 },
  { name: 'Panturrilha em Pé na Máquina', muscleGroup: 'Panturrilha', defaultRestSeconds: 45 },
  { name: 'Panturrilha Sentado (Gêmeos)', muscleGroup: 'Panturrilha', defaultRestSeconds: 45 },
];

export const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({
  visible,
  onSelectExercise,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('Todos');

  const filteredExercises = useMemo(() => {
    return DEFAULT_EXERCISE_CATALOG.filter((ex) => {
      const matchesSearch =
        !searchQuery.trim() ||
        ex.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchesMuscle =
        selectedMuscle === 'Todos' || ex.muscleGroup === selectedMuscle;
      return matchesSearch && matchesMuscle;
    });
  }, [searchQuery, selectedMuscle]);

  const handleSelect = (item: CatalogExercise) => {
    onSelectExercise({
      name: item.name,
      muscleGroup: item.muscleGroup,
      targetSets: 3,
      defaultRestSeconds: item.defaultRestSeconds,
    });
    setSearchQuery('');
    onClose();
  };

  const handleCreateCustom = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    onSelectExercise({
      name: trimmed,
      muscleGroup: selectedMuscle === 'Todos' ? 'Geral' : selectedMuscle,
      targetSets: 3,
      defaultRestSeconds: 60,
    });
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Selecionar Exercício</Text>
          <TouchableOpacity
            onPress={onClose}
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
            placeholderTextColor={DarkTheme.colors.textDimmed}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Muscle Group Horizontal Filter Pills */}
        <View style={styles.pillsContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={MUSCLE_GROUPS}
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

        {/* Exercise List */}
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.exerciseItem}
              onPress={() => handleSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`Selecionar ${item.name}`}
            >
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{item.name}</Text>
                <View style={styles.metaRow}>
                  <Badge
                    label={item.muscleGroup}
                    color={DarkTheme.colors.primary}
                    backgroundColor={DarkTheme.colors.primaryMuted}
                  />
                  <Text style={styles.metaRest}>
                    • Descanso: {item.defaultRestSeconds}s
                  </Text>
                </View>
              </View>
              <View style={styles.addIconCircle}>
                <Text style={styles.addIconText}>+</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhum exercício encontrado.</Text>
              {searchQuery.trim().length > 0 && (
                <TouchableOpacity
                  style={styles.customBtn}
                  onPress={handleCreateCustom}
                  accessibilityRole="button"
                  accessibilityLabel={`Criar exercício ${searchQuery}`}
                >
                  <Text style={styles.customBtnText}>
                    + Criar exercício &quot;{searchQuery.trim()}&quot;
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DarkTheme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: DarkTheme.spacing.lg,
    paddingTop: DarkTheme.spacing.md,
    paddingBottom: DarkTheme.spacing.sm,
  },
  headerTitle: {
    color: DarkTheme.colors.textPrimary,
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
    color: DarkTheme.colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: DarkTheme.spacing.lg,
    marginBottom: DarkTheme.spacing.sm,
  },
  searchInput: {
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    color: DarkTheme.colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: DarkTheme.spacing.md,
    paddingVertical: 10,
    minHeight: 44,
  },
  pillsContainer: {
    marginBottom: DarkTheme.spacing.sm,
  },
  pillsList: {
    paddingHorizontal: DarkTheme.spacing.lg,
    gap: DarkTheme.spacing.xs,
  },
  musclePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: DarkTheme.borderRadius.full,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: DarkTheme.colors.cardBorder,
    minHeight: 36,
    justifyContent: 'center',
  },
  musclePillActive: {
    backgroundColor: DarkTheme.colors.primaryMuted,
    borderColor: DarkTheme.colors.primary,
  },
  musclePillText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  musclePillTextActive: {
    color: DarkTheme.colors.primary,
  },
  listContent: {
    paddingHorizontal: DarkTheme.spacing.lg,
    paddingBottom: DarkTheme.spacing.xl,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    padding: DarkTheme.spacing.md,
    marginBottom: DarkTheme.spacing.xs,
    minHeight: 64,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: DarkTheme.spacing.sm,
  },
  exerciseName: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRest: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 12,
  },
  addIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DarkTheme.colors.cardBorder,
  },
  addIconText: {
    color: DarkTheme.colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: DarkTheme.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 14,
    marginBottom: DarkTheme.spacing.md,
  },
  customBtn: {
    backgroundColor: DarkTheme.colors.primaryMuted,
    borderColor: DarkTheme.colors.primary,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    paddingHorizontal: DarkTheme.spacing.lg,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  customBtnText: {
    color: DarkTheme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
