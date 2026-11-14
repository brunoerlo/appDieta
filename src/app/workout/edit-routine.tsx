import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemeColors, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useWorkout } from '../../hooks/useWorkout';
import { Button } from '../../components/ui/Button';
import { ExerciseConfigRow, DraftExercise } from '../../components/workout/ExerciseConfigRow';
import { ExercisePickerModal, ExercisePickerResult } from '../../components/workout/ExercisePickerModal';

const SPLIT_PRESETS = [
  { label: 'ABC', prefix: 'Treino - ' },
  { label: 'PPL', prefix: 'Push / Pull / Legs: ' },
  { label: 'Upper / Lower', prefix: 'Upper / Lower: ' },
  { label: 'Full Body', prefix: 'Full Body: ' },
  { label: 'Personalizado', prefix: '' },
];

export default function EditRoutineScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  const { routines, createRoutine, updateRoutine, getRoutineById } = useWorkout();

  const isEditing = Boolean(routineId);

  const existingRoutine = useMemo(() => {
    return routineId ? routines.find((r) => r.id === routineId) : undefined;
  }, [routineId, routines]);

  const [name, setName] = useState(() => existingRoutine?.name || '');
  const [description, setDescription] = useState(() => existingRoutine?.description || '');
  const [exercises, setExercises] = useState<DraftExercise[]>(() => {
    if (existingRoutine?.exercises) {
      return existingRoutine.exercises.map((e: any, idx: number) => ({
        id: e.id,
        name: e.name,
        muscleGroup: e.muscleGroup || 'Geral',
        targetSets: e.targetSets,
        defaultRestSeconds: e.defaultRestSeconds,
        sortOrder: e.sortOrder || idx + 1,
      }));
    }
    return [];
  });
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (routineId && !existingRoutine) {
      getRoutineById(routineId)
        .then((r) => {
          if (r && active) {
            setName(r.name);
            setDescription(r.description || '');
            if (r.exercises) {
              setExercises(
                r.exercises.map((e, idx) => ({
                  id: e.id,
                  name: e.name,
                  muscleGroup: e.muscleGroup || 'Geral',
                  targetSets: e.targetSets,
                  defaultRestSeconds: e.defaultRestSeconds,
                  sortOrder: e.sortOrder || idx + 1,
                }))
              );
            }
          }
        })
        .catch((err: any) => {
          if (active) {
            Alert.alert('Erro', err?.message || 'Não foi possível carregar a rotina.');
          }
        });
    }
    return () => {
      active = false;
    };
  }, [routineId, existingRoutine, getRoutineById]);

  const handleAddExercise = (picked: ExercisePickerResult) => {
    const newEx: DraftExercise = {
      name: picked.name,
      muscleGroup: picked.muscleGroup,
      targetSets: picked.targetSets,
      defaultRestSeconds: picked.defaultRestSeconds,
      sortOrder: exercises.length + 1,
    };
    setExercises((prev) => [...prev, newEx]);
  };

  const handleUpdateExercise = (index: number, updates: Partial<DraftExercise>) => {
    setExercises((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveExercise = (index: number) => {
    setExercises((prev) => {
      const copy = prev.filter((_, i) => i !== index);
      return copy.map((ex, i) => ({ ...ex, sortOrder: i + 1 }));
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setExercises((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy.map((ex, i) => ({ ...ex, sortOrder: i + 1 }));
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === exercises.length - 1) return;
    setExercises((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy.map((ex, i) => ({ ...ex, sortOrder: i + 1 }));
    });
  };

  const handleSave = async () => {
    if (isSubmittingRef.current) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Nome obrigatório', 'Por favor, insira o nome da rotina.');
      return;
    }

    if (exercises.length === 0) {
      Alert.alert('Exercícios necessários', 'Adicione pelo menos 1 exercício à rotina.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSaving(true);
    try {
      if (isEditing && routineId) {
        await updateRoutine(
          routineId,
          { name: trimmedName, description: description.trim() },
          exercises.map((e) => ({
            id: e.id || `ex-${Date.now()}-${Math.random()}`,
            routineId,
            name: e.name,
            muscleGroup: e.muscleGroup,
            targetSets: e.targetSets,
            defaultRestSeconds: e.defaultRestSeconds,
            sortOrder: e.sortOrder,
          }))
        );
      } else {
        await createRoutine(
          {
            name: trimmedName,
            description: description.trim(),
            sortOrder: 0,
          },
          exercises.map((e) => ({
            name: e.name,
            muscleGroup: e.muscleGroup,
            targetSets: e.targetSets,
            defaultRestSeconds: e.defaultRestSeconds,
            sortOrder: e.sortOrder,
          }))
        );
      }
      router.back();
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err?.message || 'Falha ao salvar a rotina.');
    } finally {
      isSubmittingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isSaving}
          style={styles.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancelar edição de rotina"
        >
          <Text style={[styles.cancelText, isSaving && styles.saveTextDisabled]}>Cancelar</Text>
        </TouchableOpacity>

        <Text style={styles.screenTitle}>
          {isEditing ? 'Editar Rotina' : 'Nova Rotina'}
        </Text>

        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={styles.saveBtn}
          accessibilityRole="button"
          accessibilityLabel="Salvar rotina"
        >
          <Text style={[styles.saveText, isSaving && styles.saveTextDisabled]}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Info Section */}
        <Text style={styles.sectionHeader}>INFORMAÇÕES BÁSICAS</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Nome da Rotina *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ex: Treino A - Peito e Tríceps"
            placeholderTextColor={colors.textDimmed}
            value={name}
            onChangeText={setName}
            maxLength={80}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Descrição / Foco (opcional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ex: Foco em peitoral superior e deltoides"
            placeholderTextColor={colors.textDimmed}
            value={description}
            onChangeText={setDescription}
            maxLength={200}
          />
        </View>

        {/* Split Preset Chips */}
        <Text style={styles.inputLabel}>Sugestões de Divisão</Text>
        <View style={styles.presetsRow}>
          {SPLIT_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.label}
              style={styles.presetChip}
              onPress={() => {
                if (preset.prefix && !name.startsWith(preset.prefix)) {
                  setName(`${preset.prefix}${name}`);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`Sugestão ${preset.label}`}
            >
              <Text style={styles.presetChipText}>{preset.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Exercises Section */}
        <View style={styles.exercisesHeaderRow}>
          <Text style={styles.sectionHeader}>
            EXERCÍCIOS ({exercises.length})
          </Text>
          <TouchableOpacity
            onPress={() => setIsPickerVisible(true)}
            style={styles.addExerciseLink}
            accessibilityRole="button"
            accessibilityLabel="Adicionar exercício"
          >
            <Text style={styles.addExerciseLinkText}>+ Adicionar Exercício</Text>
          </TouchableOpacity>
        </View>

        {exercises.map((exercise, index) => (
          <ExerciseConfigRow
            key={exercise.id || `${exercise.name}-${index}`}
            exercise={exercise}
            index={index}
            totalCount={exercises.length}
            onUpdate={(updates) => handleUpdateExercise(index, updates)}
            onRemove={() => handleRemoveExercise(index)}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
          />
        ))}

        <Button
          title="+ Adicionar Exercício"
          onPress={() => setIsPickerVisible(true)}
          variant="secondary"
          size="md"
          style={styles.bottomAddBtn}
        />
      </ScrollView>

      {/* Exercise Picker Modal */}
      <ExercisePickerModal
        visible={isPickerVisible}
        onSelectExercise={handleAddExercise}
        onClose={() => setIsPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
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
    screenTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '700',
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
    saveTextDisabled: {
      opacity: 0.4,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    sectionHeader: {
      color: colors.textDimmed,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    inputGroup: {
      marginBottom: spacing.md,
    },
    inputLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      color: colors.textPrimary,
      fontSize: 15,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      minHeight: 44,
    },
    presetsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: spacing.lg,
    },
    presetChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      minHeight: 36,
      justifyContent: 'center',
    },
    presetChipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    exercisesHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    addExerciseLink: {
      minHeight: 44,
      justifyContent: 'center',
    },
    addExerciseLinkText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    bottomAddBtn: {
      marginTop: spacing.md,
      width: '100%',
    },
  });
