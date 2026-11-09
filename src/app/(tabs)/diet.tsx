import React, { useState } from 'react';
import { ScrollView, StyleSheet, RefreshControl } from 'react-native';
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
          onDeleteLog={handleDeleteLog}
        />

        <MealCard
          mealType="lunch"
          title="Almoço"
          icon="🍽️"
          logs={dailySummary.meals.lunch}
          onAddFood={handleAddFood}
          onEditLog={handleEditLog}
          onDeleteLog={handleDeleteLog}
        />

        <MealCard
          mealType="snack"
          title="Lanche"
          icon="🍎"
          logs={dailySummary.meals.snack}
          onAddFood={handleAddFood}
          onEditLog={handleEditLog}
          onDeleteLog={handleDeleteLog}
        />

        <MealCard
          mealType="dinner"
          title="Jantar"
          icon="🌙"
          logs={dailySummary.meals.dinner}
          onAddFood={handleAddFood}
          onEditLog={handleEditLog}
          onDeleteLog={handleDeleteLog}
        />

        <MealCard
          mealType="supper"
          title="Ceia"
          icon="🥛"
          logs={dailySummary.meals.supper}
          onAddFood={handleAddFood}
          onEditLog={handleEditLog}
          onDeleteLog={handleDeleteLog}
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
});
