import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DarkTheme } from '../../constants/theme';
import { DietLogEntry } from '../../types/domain';

export interface FoodLogRowProps {
  entry: DietLogEntry;
  onEdit: (entry: DietLogEntry) => void;
  onDelete: (id: string) => void;
}

export const FoodLogRow: React.FC<FoodLogRowProps> = ({
  entry,
  onEdit,
  onDelete,
}) => {
  const handleDelete = () => {
    Alert.alert(
      'Remover alimento',
      `Deseja remover "${entry.foodName}" desta refeição?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => onDelete(entry.id) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Food Details */}
      <View style={styles.infoColumn}>
        <Text style={styles.foodName} numberOfLines={1} ellipsizeMode="tail">
          {entry.foodName}
        </Text>
        <Text style={styles.macroDetails}>
          {entry.servingGrams}g •{' '}
          <Text style={styles.caloriesText}>{Math.round(entry.calories)} kcal</Text> • P:{' '}
          {entry.protein}g C: {entry.carbs}g G: {entry.fat}g
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          accessibilityLabel={`Editar ${entry.foodName}`}
          onPress={() => onEdit(entry)}
          style={styles.actionBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel={`Excluir ${entry.foodName}`}
          onPress={handleDelete}
          style={styles.actionBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.colors.cardBorder,
  },
  infoColumn: {
    flex: 1,
    marginRight: 12,
  },
  foodName: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  macroDetails: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
  },
  caloriesText: {
    color: DarkTheme.colors.calories,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: DarkTheme.borderRadius.sm,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 13,
  },
  deleteIcon: {
    fontSize: 13,
  },
});
