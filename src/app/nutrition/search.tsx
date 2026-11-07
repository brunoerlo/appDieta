import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { DarkTheme } from '../../constants/theme';
import { SqliteDietRepository } from '../../database/repositories/SqliteDietRepository';
import { openFoodFactsService } from '../../services/OpenFoodFactsService';
import { ServingSizeModal } from '../../components/nutrition/ServingSizeModal';
import { FoodItem, MealType } from '../../types/domain';
import { MEAL_TYPE_NAMES } from '../../utils/nutrition';
import { useDiet } from '../../hooks/useDiet';

type FilterTab = 'all' | 'taco' | 'custom' | 'off';

export default function FoodSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mealType?: MealType; date?: string }>();
  const mealType: MealType = params.mealType || 'lunch';

  const db = useSQLiteContext();
  const dietRepo = useMemo(() => new SqliteDietRepository(db), [db]);
  const { addFoodLog } = useDiet();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [localResults, setLocalResults] = useState<FoodItem[]>([]);
  const [remoteResults, setRemoteResults] = useState<FoodItem[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingModalVisible, setServingModalVisible] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initial load of common TACO foods
  useEffect(() => {
    let active = true;
    dietRepo.searchFoods('', 30).then((foods) => {
      if (active) setLocalResults(foods);
    });
    return () => {
      active = false;
    };
  }, [dietRepo]);

  // Handle Query Changes with immediate local search & debounced remote search
  const handleQueryChange = (text: string) => {
    setQuery(text);

    // Immediate local search
    dietRepo.searchFoods(text, 50).then((foods) => {
      setLocalResults(foods);
    });

    // Clear previous remote timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!text.trim() || text.trim().length < 2) {
      setRemoteResults([]);
      setIsSearchingRemote(false);
      return;
    }

    setIsSearchingRemote(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const offResults = await openFoodFactsService.searchFoods(text.trim(), 20);
        setRemoteResults(offResults);
      } catch {
        setRemoteResults([]);
      } finally {
        setIsSearchingRemote(false);
      }
    }, 400);
  };

  // Combine and filter results according to tab
  const displayedResults = useMemo(() => {
    const combined: FoodItem[] = [...localResults];

    // Append remote results if not already present by barcode/id/name
    for (const rem of remoteResults) {
      const alreadyInLocal = combined.some(
        (loc) => (loc.barcode && loc.barcode === rem.barcode) || loc.id === rem.id
      );
      if (!alreadyInLocal) {
        combined.push(rem);
      }
    }

    if (activeTab === 'all') return combined;
    if (activeTab === 'taco') return combined.filter((item) => item.source === 'taco');
    if (activeTab === 'custom') return combined.filter((item) => item.source === 'custom');
    if (activeTab === 'off') return combined.filter((item) => item.source === 'openfoodfacts');
    return combined;
  }, [localResults, remoteResults, activeTab]);

  const handleSelectFood = (item: FoodItem) => {
    Keyboard.dismiss();
    setSelectedFood(item);
    setServingModalVisible(true);
  };

  const handleConfirmServing = async (entry: {
    food: FoodItem;
    mealType: MealType;
    servingGrams: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => {
    // If food is from Open Food Facts and not in local DB, cache it
    if (entry.food.source === 'openfoodfacts') {
      try {
        await dietRepo.createFood(entry.food);
      } catch {
        // Already cached or ignored
      }
    }

    await addFoodLog({
      mealType: entry.mealType,
      food: entry.food,
      servingGrams: entry.servingGrams,
    });

    router.back();
  };

  const renderSourceBadge = (source: 'taco' | 'openfoodfacts' | 'custom') => {
    switch (source) {
      case 'taco':
        return <Text style={styles.badgeTaco}>TACO</Text>;
      case 'openfoodfacts':
        return <Text style={styles.badgeOff}>OFF</Text>;
      case 'custom':
        return <Text style={styles.badgeCustom}>Custom</Text>;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Adicionar ao {MEAL_TYPE_NAMES[mealType]}
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() =>
              router.push({
                pathname: '/nutrition/scanner',
                params: { mealType, date: params.date },
              })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.actionIconText}>📷</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() =>
              router.push({
                pathname: '/nutrition/custom',
                params: { mealType, date: params.date },
              })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.actionIconText}>➕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar alimentos (ex: frango, arroz, maçã...)"
          placeholderTextColor={DarkTheme.colors.textDimmed}
          value={query}
          onChangeText={handleQueryChange}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {isSearchingRemote && (
          <ActivityIndicator
            size="small"
            color={DarkTheme.colors.primary}
            style={styles.searchSpinner}
          />
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'taco' && styles.tabActive]}
          onPress={() => setActiveTab('taco')}
        >
          <Text style={[styles.tabText, activeTab === 'taco' && styles.tabTextActive]}>
            TACO / IBGE
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'custom' && styles.tabActive]}
          onPress={() => setActiveTab('custom')}
        >
          <Text style={[styles.tabText, activeTab === 'custom' && styles.tabTextActive]}>
            Personalizados
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'off' && styles.tabActive]}
          onPress={() => setActiveTab('off')}
        >
          <Text style={[styles.tabText, activeTab === 'off' && styles.tabTextActive]}>
            Web (OFF)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results List */}
      <FlatList
        data={displayedResults}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {query
                ? `Nenhum alimento encontrado para "${query}".`
                : 'Digite o nome do alimento ou escaneie o código de barras.'}
            </Text>
            {query.length >= 2 && (
              <TouchableOpacity
                style={styles.createPromptBtn}
                onPress={() =>
                  router.push({
                    pathname: '/nutrition/custom',
                    params: { mealType, date: params.date, initialName: query },
                  })
                }
              >
                <Text style={styles.createPromptText}>
                  {`+ Cadastrar "${query}" como alimento personalizado`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.foodRow}
            onPress={() => handleSelectFood(item)}
            activeOpacity={0.7}
          >
            <View style={styles.foodRowInfo}>
              <View style={styles.foodRowHeader}>
                <Text style={styles.foodRowName} numberOfLines={1}>
                  {item.name}
                </Text>
                {renderSourceBadge(item.source)}
              </View>

              <Text style={styles.foodRowMacros}>
                100g • <Text style={styles.macroHighlight}>{item.calories} kcal</Text> • P:{' '}
                {item.protein}g • C: {item.carbs}g • G: {item.fat}g
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />

      {/* Serving Selection Modal */}
      <ServingSizeModal
        visible={servingModalVisible}
        food={selectedFood}
        mealType={mealType}
        onClose={() => {
          setServingModalVisible(false);
          setSelectedFood(null);
        }}
        onConfirm={handleConfirmServing}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DarkTheme.colors.background,
  },
  headerBar: {
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
  headerTitle: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: DarkTheme.borderRadius.full,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconText: {
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    marginHorizontal: DarkTheme.spacing.md,
    marginTop: DarkTheme.spacing.md,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: DarkTheme.colors.textPrimary,
    fontSize: 14,
    height: '100%',
  },
  searchSpinner: {
    marginLeft: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: DarkTheme.spacing.md,
    paddingVertical: DarkTheme.spacing.sm,
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: DarkTheme.borderRadius.full,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
  },
  tabActive: {
    backgroundColor: DarkTheme.colors.primaryMuted,
    borderColor: DarkTheme.colors.primary,
  },
  tabText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: DarkTheme.colors.primary,
  },
  listContent: {
    paddingHorizontal: DarkTheme.spacing.md,
    paddingBottom: 24,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.colors.cardBorder,
  },
  foodRowInfo: {
    flex: 1,
    marginRight: 10,
  },
  foodRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  foodRowName: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  foodRowMacros: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
  },
  macroHighlight: {
    color: DarkTheme.colors.calories,
    fontWeight: '600',
  },
  chevron: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 20,
    fontWeight: '600',
  },
  badgeTaco: {
    fontSize: 10,
    fontWeight: '700',
    color: DarkTheme.colors.primary,
    backgroundColor: DarkTheme.colors.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeOff: {
    fontSize: 10,
    fontWeight: '700',
    color: DarkTheme.colors.water,
    backgroundColor: DarkTheme.colors.waterTrack,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeCustom: {
    fontSize: 10,
    fontWeight: '700',
    color: DarkTheme.colors.calories,
    backgroundColor: DarkTheme.colors.caloriesTrack,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyText: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  createPromptBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
  },
  createPromptText: {
    color: DarkTheme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
