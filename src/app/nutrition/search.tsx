import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { openFoodFactsService } from '../../services/OpenFoodFactsService';
import { ServingSizeModal } from '../../components/nutrition/ServingSizeModal';
import { FoodItem, MealType } from '../../types/domain';
import { MEAL_TYPE_NAMES } from '../../utils/nutrition';
import { useDiet } from '../../hooks/useDiet';
import { translateErrorToPtBr } from '../../utils/errorMessages';
import {
  TACO_FOODS_SEED,
  READY_DISHES_SEED,
  BEVERAGES_SEED,
} from '../../database/seed/tacoFoods';
import {
  dedupeFoods,
  matchesFoodTokens,
  normalizeFoodText,
  tokenizeFoodQuery,
} from '../../utils/text';

type FilterTab = 'all' | 'meals' | 'drinks' | 'taco' | 'custom' | 'off';

const VALID_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner', 'supper'];
const SEED_FOODS_FALLBACK: FoodItem[] = [
  ...READY_DISHES_SEED,
  ...BEVERAGES_SEED,
  ...TACO_FOODS_SEED,
].map((item) => ({ ...item, createdAt: '' }));

function searchSeedFallback(query: string): FoodItem[] {
  const tokens = tokenizeFoodQuery(query);
  if (tokens.length === 0) return SEED_FOODS_FALLBACK;
  return SEED_FOODS_FALLBACK.filter((item) => matchesFoodTokens(item, tokens));
}

export default function FoodSearchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ mealType?: MealType; date?: string }>();
  const mealType: MealType =
    params.mealType && VALID_MEAL_TYPES.includes(params.mealType)
      ? params.mealType
      : 'lunch';

  const { addFoodLog, searchFoods, createFood } = useDiet();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [localResults, setLocalResults] = useState<FoodItem[]>([]);
  const [remoteResults, setRemoteResults] = useState<FoodItem[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingModalVisible, setServingModalVisible] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef<number>(0);
  const remoteRequestIdRef = useRef<number>(0);

  // Initial load: instant local TACO/seed foods + background Supabase catalog merge
  useEffect(() => {
    let active = true;
    const reqId = ++requestIdRef.current;
    const remoteReqId = ++remoteRequestIdRef.current;

    searchFoods('', 200, { localOnly: true })
      .then((foods) => {
        if (active && requestIdRef.current === reqId) {
          setLocalResults(dedupeFoods([...foods, ...SEED_FOODS_FALLBACK]));
        }
      })
      .catch(() => {
        if (active && requestIdRef.current === reqId) {
          setLocalResults(SEED_FOODS_FALLBACK);
        }
      });

    searchFoods('', 200)
      .then((foods) => {
        if (active && remoteRequestIdRef.current === remoteReqId) {
          setLocalResults(dedupeFoods([...foods, ...SEED_FOODS_FALLBACK]));
        }
      })
      .catch(() => {
        // Keep local/seed results on offline/remote failure
      });

    return () => {
      active = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchFoods]);

  // Handle Query Changes with instant non-blocking local/TACO search & debounced remote search
  const handleQueryChange = (text: string) => {
    setQuery(text);
    const currentReqId = ++requestIdRef.current;
    const currentRemoteReqId = ++remoteRequestIdRef.current;
    const seedHits = searchSeedFallback(text);

    // 1. Instant local SQLite + TACO seed search (never blocked by network)
    searchFoods(text, 200, { localOnly: true })
      .then((foods) => {
        if (requestIdRef.current === currentReqId) {
          setLocalResults(dedupeFoods([...foods, ...seedHits]));
        }
      })
      .catch(() => {
        if (requestIdRef.current === currentReqId) {
          setLocalResults(seedHits);
        }
      });

    // Clear previous remote timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setRemoteResults([]);
      setIsSearchingRemote(false);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const dbMerged = await searchFoods('', 200);
          if (remoteRequestIdRef.current === currentRemoteReqId) {
            setLocalResults(dedupeFoods([...dbMerged, ...SEED_FOODS_FALLBACK]));
          }
        } catch {
          // Keep instant local results
        }
      }, 250);
      return;
    }

    setIsSearchingRemote(trimmed.length >= 2);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const [dbMerged, offResults] = await Promise.all([
          searchFoods(text, 200).catch(() => [] as FoodItem[]),
          trimmed.length >= 2
            ? openFoodFactsService.searchFoods(trimmed, 20).catch(() => [] as FoodItem[])
            : Promise.resolve([] as FoodItem[]),
        ]);

        if (remoteRequestIdRef.current === currentRemoteReqId) {
          if (dbMerged.length > 0) {
            setLocalResults((prev) => dedupeFoods([...dbMerged, ...prev, ...seedHits]));
          }
          setRemoteResults(offResults);
        }
      } finally {
        if (remoteRequestIdRef.current === currentRemoteReqId) {
          setIsSearchingRemote(false);
        }
      }
    }, 300);
  };

  // Combine and filter results according to tab (deduped by id, barcode, and normalized name+source)
  const displayedResults = useMemo(() => {
    const combined = dedupeFoods([...localResults, ...remoteResults]);

    if (activeTab === 'all') return combined;
    if (activeTab === 'meals') {
      return combined.filter(
        (item) => item.category === 'Refeições' || (item.source === 'recipe' && item.category !== 'Bebidas')
      );
    }
    if (activeTab === 'drinks') {
      return combined.filter((item) => item.category === 'Bebidas');
    }
    if (activeTab === 'taco') return combined.filter((item) => item.source === 'taco' && item.category !== 'Refeições' && item.category !== 'Bebidas');
    if (activeTab === 'custom') return combined.filter((item) => item.source === 'custom' && item.category !== 'Refeições' && item.category !== 'Bebidas');
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
    try {
      let foodToLog = entry.food;

      // Only cache transient Open Food Facts results (`off-*`) if not already stored in DB
      if (entry.food.source === 'openfoodfacts' && entry.food.id.startsWith('off-')) {
        const normName = normalizeFoodText(entry.food.name);
        const existingLocal = localResults.find(
          (loc) =>
            !loc.id.startsWith('off-') &&
            ((entry.food.barcode && loc.barcode === entry.food.barcode) ||
              (normName &&
                normalizeFoodText(loc.name) === normName &&
                loc.source === 'openfoodfacts'))
        );

        if (existingLocal) {
          foodToLog = existingLocal;
        } else {
          try {
            foodToLog = await createFood(entry.food);
          } catch {
            // Already cached or offline; still proceed with logging
          }
        }
      }

      await addFoodLog({
        mealType: entry.mealType,
        food: foodToLog,
        servingGrams: entry.servingGrams,
      });

      router.back();
    } catch (err: any) {
      Alert.alert(
        'Erro ao registrar',
        translateErrorToPtBr(err, 'Não foi possível registrar o alimento.')
      );
      throw err;
    }
  };

  const renderSourceBadge = (item: FoodItem) => {
    if (item.category === 'Bebidas') {
      return <Text style={styles.badgeDrink}>Bebida</Text>;
    }
    if (item.category === 'Refeições' || item.source === 'recipe') {
      return <Text style={styles.badgeMeal}>Refeição</Text>;
    }
    switch (item.source) {
      case 'taco':
        return <Text style={styles.badgeTaco}>TACO</Text>;
      case 'openfoodfacts':
        return <Text style={styles.badgeOff}>OFF</Text>;
      case 'custom':
        return <Text style={styles.badgeCustom}>Custom</Text>;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
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
          placeholder="Buscar alimentos ou pratos (ex: carbonara, omelete, frango...)"
          placeholderTextColor={colors.textDimmed}
          value={query}
          onChangeText={handleQueryChange}
          autoCorrect={false}
          clearButtonMode="while-editing"
          maxLength={100}
        />
        {isSearchingRemote && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={styles.searchSpinner}
          />
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'meals' && styles.tabActive]}
            onPress={() => setActiveTab('meals')}
          >
            <Text style={[styles.tabText, activeTab === 'meals' && styles.tabTextActive]}>
              🍲 Refeições
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'drinks' && styles.tabActive]}
            onPress={() => setActiveTab('drinks')}
          >
            <Text style={[styles.tabText, activeTab === 'drinks' && styles.tabTextActive]}>
              🥤 Bebidas
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
        </ScrollView>
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
                {renderSourceBadge(item)}
              </View>

              <Text style={styles.foodRowMacros}>
                {item.category === 'Bebidas' ? '100ml' : '100g'} • <Text style={styles.macroHighlight}>{item.calories} kcal</Text> • P:{' '}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    headerTitle: {
      color: colors.textPrimary,
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
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionIconText: {
      fontSize: 16,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      paddingHorizontal: 12,
      height: 48,
    },
    searchIcon: {
      fontSize: 16,
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      height: '100%',
    },
    searchSpinner: {
      marginLeft: 8,
    },
    tabsWrapper: {
      marginBottom: spacing.sm,
    },
    tabsScrollContent: {
      paddingHorizontal: spacing.md,
      gap: 8,
      alignItems: 'center',
    },
    tab: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
    },
    tabActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    tabTextActive: {
      color: colors.primary,
    },
    listContent: {
      paddingHorizontal: spacing.md,
      paddingBottom: 24,
    },
    foodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
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
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '600',
      flex: 1,
      marginRight: 8,
    },
    foodRowMacros: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    macroHighlight: {
      color: colors.calories,
      fontWeight: '600',
    },
    chevron: {
      color: colors.textDimmed,
      fontSize: 20,
      fontWeight: '600',
    },
    badgeTaco: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeOff: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.water,
      backgroundColor: colors.waterTrack,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeCustom: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.calories,
      backgroundColor: colors.caloriesTrack,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeMeal: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.calories,
      backgroundColor: colors.caloriesTrack,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeDrink: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.water,
      backgroundColor: colors.waterTrack,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    emptyContainer: {
      paddingVertical: 36,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textDimmed,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 16,
    },
    createPromptBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
    },
    createPromptText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
  });
