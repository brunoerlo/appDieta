import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDiet } from '../../hooks/useDiet';
import { useTheme } from '../../hooks/useTheme';
import { DateSelectorHeader } from '../../components/nutrition/DateSelectorHeader';
import { MacroSummaryCard } from '../../components/nutrition/MacroSummaryCard';
import { WaterTrackerCard } from '../../components/nutrition/WaterTrackerCard';
import { MealCard } from '../../components/nutrition/MealCard';
import { PortionEditModal } from '../../components/nutrition/PortionEditModal';
import { DietLogEntry, MealType } from '../../types/domain';
import { spacing, borderRadius } from '../../constants/theme';

export default function DietTabScreen() {
  const router = useRouter();
  const {
    selectedDate,
    setSelectedDate,
    goToToday,
    dailySummary,
    userProfile,
    waterTotalMl,
    isRefreshing,
    error,
    addWater,
    decrementWater,
    resetWater,
    updateFoodLog,
    deleteFoodLog,
    refresh,
  } = useDiet();

  const { colors } = useTheme();
  const [editingEntry, setEditingEntry] = useState<DietLogEntry | null>(null);
  const [portionModalVisible, setPortionModalVisible] = useState(false);

  const targets = {
    calories: userProfile?.targetCalories ?? 2000,
    protein: userProfile?.targetProtein ?? 150,
    carbs: userProfile?.targetCarbs ?? 200,
    fat: userProfile?.targetFat ?? 60,
  };

  const consumed = {
    calories: dailySummary.totalCalories,
    protein: dailySummary.totalProtein,
    carbs: dailySummary.totalCarbs,
    fat: dailySummary.totalFat,
  };

  const handleAddFood = (mealType: MealType) => {
    router.push({
      pathname: '/nutrition/search',
      params: {
        mealType,
        date: selectedDate,
      },
    });
  };

  const handleEditLog = (entry: DietLogEntry) => {
    setEditingEntry(entry);
    setPortionModalVisible(true);
  };

  const handleSavePortion = async (
    id: string,
    updated: {
      servingGrams: number;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }
  ) => {
    await updateFoodLog(id, updated);
  };

  const handleDeleteLog = async (id: string) => {
    await deleteFoodLog(id);
  };

  const handleDeleteLogFromCard = async (id: string) => {
    try {
      await deleteFoodLog(id);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível remover o alimento.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Date Stepper Header */}
      <DateSelectorHeader
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onResetToToday={goToToday}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerMuted, borderColor: colors.danger }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* Daily Macros & Calorie Hero Card */}
        <MacroSummaryCard consumed={consumed} targets={targets} />

        {/* Daily Hydration Card */}
        <WaterTrackerCard
          consumedMl={waterTotalMl}
          targetMl={userProfile?.targetWaterMl ?? 2500}
          onIncrement={addWater}
          onDecrement={decrementWater}
          onReset={resetWater}
        />

        {/* 5 Categorized Meals */}
        <MealCard
          mealType="breakfast"
          title="Café da Manhã"
          icon="☕"
          logs={dailySummary.meals.breakfast}
          onAddFood={handleAddFood}
          onEditLog={handleEditLog}
          onDeleteLog={handleDeleteLogFromCard}
        />

        <MealCard
          mealType="lunch"
          title="Almoço"
          icon="🍽️"
          logs={dailySummary.meals.lunch}
          onAddFood={handleAddFood}
          onEditLog={handleEditLog}
          onDeleteLog={handleDeleteLogFromCard}
        />

        <MealCard
          mealType="snack"
          title="Lanche"
          icon="🍎"
          logs={dailySummary.meals.snack}
          onAddFood={handleAddFood}
          onEditLog={handleEditLog}
          onDeleteLog={handleDeleteLogFromCard}
        />

        <MealCard
          mealType="dinner"
          title="Jantar"
          icon="🌙"
          logs={dailySummary.meals.dinner}
          onAddFood={handleAddFood}
          onEditLog={handleEditLog}
          onDeleteLog={handleDeleteLogFromCard}
        />

        <MealCard
          mealType="supper"
          title="Ceia"
          icon="🥛"
          logs={dailySummary.meals.supper}
          onAddFood={handleAddFood}
          onEditLog={handleEditLog}
          onDeleteLog={handleDeleteLogFromCard}
        />
      </ScrollView>

      {/* Portion Adjustment Modal */}
      <PortionEditModal
        visible={portionModalVisible}
        entry={editingEntry}
        onSave={handleSavePortion}
        onDelete={handleDeleteLog}
        onClose={() => {
          setPortionModalVisible(false);
          setEditingEntry(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  errorBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
