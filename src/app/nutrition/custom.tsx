import React, { useState, useMemo, useEffect } from 'react';
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
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { DarkTheme } from '../../constants/theme';
import { SqliteDietRepository } from '../../database/repositories/SqliteDietRepository';
import { Button } from '../../components/ui/Button';
import { FoodItem, MealType } from '../../types/domain';
import {
  calculateAtwaterCalories,
  isAtwaterConsistent,
  MEAL_TYPE_NAMES,
} from '../../utils/nutrition';
import { useDiet } from '../../hooks/useDiet';
import { useSafeTopPadding } from '../../hooks/useSafeTopPadding';

type CreationType = 'food' | 'meal';
type EntryMode = '100g' | 'portion';
type MealMode = 'ingredients' | 'direct';

export interface RecipeIngredient {
  id: string;
  food: FoodItem;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function CustomFoodScreen() {
  const router = useRouter();
  const safeTop = useSafeTopPadding(6);
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

  // Main Segmented: Food vs Meal/Dish
  const [creationType, setCreationType] = useState<CreationType>('food');

  // --- Single Food Form State ---
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

  // --- Meal / Dish Form State ---
  const [mealMode, setMealMode] = useState<MealMode>('ingredients');
  const [dishName, setDishName] = useState(params.initialName || '');

  // Mode 1: Ingredients Builder
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerFoods, setPickerFoods] = useState<FoodItem[]>([]);
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [selectedIngredientFood, setSelectedIngredientFood] = useState<FoodItem | null>(null);
  const [ingredientGramsInput, setIngredientGramsInput] = useState('100');

  // Mode 2: Direct Dish Macros
  const [dishPortionGrams, setDishPortionGrams] = useState('250');
  const [dishPortionName, setDishPortionName] = useState('prato (250g)');
  const [dishCalories, setDishCalories] = useState('');
  const [dishProtein, setDishProtein] = useState('');
  const [dishCarbs, setDishCarbs] = useState('');
  const [dishFat, setDishFat] = useState('');
  const [dishFiber, setDishFiber] = useState('');

  const [saving, setSaving] = useState(false);

  // Numeric values for Single Food
  const numKcal = parseFloat(calories) || 0;
  const numP = parseFloat(protein) || 0;
  const numC = parseFloat(carbs) || 0;
  const numF = parseFloat(fat) || 0;
  const numFiber = fiber ? parseFloat(fiber) || 0 : undefined;
  const numPortionGrams = parseFloat(portionGrams) || 100;

  // Atwater Calculation for Single Food
  const atwaterKcal = calculateAtwaterCalories(numP, numC, numF);
  const isConsistent = isAtwaterConsistent(numKcal, numP, numC, numF, 20);

  // Numeric values for Direct Dish
  const numDishKcal = parseFloat(dishCalories) || 0;
  const numDishP = parseFloat(dishProtein) || 0;
  const numDishC = parseFloat(dishCarbs) || 0;
  const numDishF = parseFloat(dishFat) || 0;
  const numDishFiber = dishFiber ? parseFloat(dishFiber) || 0 : undefined;
  const numDishPortionGrams = parseFloat(dishPortionGrams) || 250;

  // Atwater for Direct Dish
  const atwaterDishKcal = calculateAtwaterCalories(numDishP, numDishC, numDishF);
  const isDishConsistent = isAtwaterConsistent(numDishKcal, numDishP, numDishC, numDishF, 20);

  // Live Ingredient Calculations for Mode 1
  const totalGrams = useMemo(
    () => ingredients.reduce((sum, item) => sum + (item.grams || 0), 0),
    [ingredients]
  );
  const totalCalories = useMemo(
    () => Number(ingredients.reduce((sum, item) => sum + item.calories, 0).toFixed(1)),
    [ingredients]
  );
  const totalProtein = useMemo(
    () => Number(ingredients.reduce((sum, item) => sum + item.protein, 0).toFixed(1)),
    [ingredients]
  );
  const totalCarbs = useMemo(
    () => Number(ingredients.reduce((sum, item) => sum + item.carbs, 0).toFixed(1)),
    [ingredients]
  );
  const totalFat = useMemo(
    () => Number(ingredients.reduce((sum, item) => sum + item.fat, 0).toFixed(1)),
    [ingredients]
  );

  const handlePickerSearchChange = (text: string) => {
    setPickerSearch(text);
    setIsPickerLoading(true);
  };

  // Search DB foods when ingredient picker is open
  useEffect(() => {
    if (!isPickerVisible) return;
    let active = true;
    dietRepo.searchFoods(pickerSearch, 30).then((foods) => {
      if (active) {
        setPickerFoods(foods);
        setIsPickerLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [dietRepo, isPickerVisible, pickerSearch]);

  const handleOpenIngredientPicker = () => {
    setPickerSearch('');
    setSelectedIngredientFood(null);
    setIngredientGramsInput('100');
    setIsPickerLoading(true);
    setIsPickerVisible(true);
  };

  const handleAddIngredient = () => {
    if (!selectedIngredientFood) return;
    const g = parseFloat(ingredientGramsInput) || 100;
    const ratio = (g > 0 ? g : 0) / (selectedIngredientFood.servingGrams || 100);

    const newIng: RecipeIngredient = {
      id: `${selectedIngredientFood.id}-${Date.now()}`,
      food: selectedIngredientFood,
      grams: g,
      calories: Number((selectedIngredientFood.calories * ratio).toFixed(1)),
      protein: Number((selectedIngredientFood.protein * ratio).toFixed(1)),
      carbs: Number((selectedIngredientFood.carbs * ratio).toFixed(1)),
      fat: Number((selectedIngredientFood.fat * ratio).toFixed(1)),
    };

    setIngredients((prev) => [...prev, newIng]);
    setSelectedIngredientFood(null);
    setIsPickerVisible(false);
  };

  const handleUpdateIngredientGrams = (id: string, textGrams: string) => {
    const g = parseFloat(textGrams) || 0;
    setIngredients((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const ratio = g / (item.food.servingGrams || 100);
        return {
          ...item,
          grams: g,
          calories: Number((item.food.calories * ratio).toFixed(1)),
          protein: Number((item.food.protein * ratio).toFixed(1)),
          carbs: Number((item.food.carbs * ratio).toFixed(1)),
          fat: Number((item.food.fat * ratio).toFixed(1)),
        };
      })
    );
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((item) => item.id !== id));
  };

  // Validations
  const validateFood = (): boolean => {
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

  const validateMeal = (): boolean => {
    if (!dishName.trim()) {
      Alert.alert('Nome obrigatório', 'Por favor, informe o nome da refeição / prato.');
      return false;
    }
    if (mealMode === 'ingredients') {
      if (ingredients.length === 0) {
        Alert.alert(
          'Sem ingredientes',
          'Adicione pelo menos um ingrediente para calcular os macros do prato.'
        );
        return false;
      }
      if (totalGrams <= 0) {
        Alert.alert('Peso inválido', 'O peso total dos ingredientes deve ser maior que zero.');
        return false;
      }
    } else {
      if (numDishPortionGrams <= 0) {
        Alert.alert('Porção inválida', 'Por favor, informe o peso da porção em gramas.');
        return false;
      }
      if (numDishKcal <= 0 && numDishP <= 0 && numDishC <= 0 && numDishF <= 0) {
        Alert.alert(
          'Valores nutricionais inválidos',
          'Por favor, informe calorias ou macros do prato.'
        );
        return false;
      }
    }
    return true;
  };

  // Normalization logic
  const getNormalizedFood = (): Omit<FoodItem, 'id' | 'createdAt'> => {
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

  const getNormalizedMeal = (): Omit<FoodItem, 'id' | 'createdAt'> => {
    if (mealMode === 'ingredients') {
      const scale = totalGrams > 0 ? 100 / totalGrams : 1;
      return {
        name: dishName.trim(),
        category: 'Refeições',
        servingGrams: 100,
        calories: Number((totalCalories * scale).toFixed(1)),
        protein: Number((totalProtein * scale).toFixed(1)),
        carbs: Number((totalCarbs * scale).toFixed(1)),
        fat: Number((totalFat * scale).toFixed(1)),
        fiber: 0,
        source: 'recipe' as const,
        servingUnitName: 'porção inteira',
        servingUnitGrams: totalGrams,
      };
    } else {
      const scale = 100 / numDishPortionGrams;
      return {
        name: dishName.trim(),
        category: 'Refeições',
        servingGrams: 100,
        calories: Number((numDishKcal * scale).toFixed(1)),
        protein: Number((numDishP * scale).toFixed(1)),
        carbs: Number((numDishC * scale).toFixed(1)),
        fat: Number((numDishF * scale).toFixed(1)),
        fiber: numDishFiber !== undefined ? Number((numDishFiber * scale).toFixed(1)) : undefined,
        source: 'recipe' as const,
        servingUnitName: dishPortionName.trim() || 'porção',
        servingUnitGrams: numDishPortionGrams,
      };
    }
  };

  const handleSaveOnly = async () => {
    const isValid = creationType === 'food' ? validateFood() : validateMeal();
    if (!isValid || saving) return;

    setSaving(true);
    try {
      const itemToSave = creationType === 'food' ? getNormalizedFood() : getNormalizedMeal();
      await dietRepo.createFood(itemToSave);
      Alert.alert(
        'Sucesso',
        `${creationType === 'food' ? 'Alimento' : 'Prato'} salvo com sucesso no seu catálogo!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndLog = async () => {
    const isValid = creationType === 'food' ? validateFood() : validateMeal();
    if (!isValid || saving) return;

    setSaving(true);
    try {
      const itemToSave = creationType === 'food' ? getNormalizedFood() : getNormalizedMeal();
      const created = await dietRepo.createFood(itemToSave);

      let gramsToLog: number;
      if (creationType === 'food') {
        gramsToLog = mode === 'portion' ? numPortionGrams : 100;
      } else {
        gramsToLog = mealMode === 'ingredients' ? totalGrams : numDishPortionGrams;
      }

      await addFoodLog({
        mealType,
        food: created,
        servingGrams: gramsToLog,
      });

      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar e registrar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: safeTop }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {creationType === 'food' ? 'Criar Alimento' : 'Criar Refeição / Prato'}
        </Text>
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
          {/* Main Segmented Control: Alimento vs Refeição / Prato */}
          <View style={styles.mainSegmentedRow}>
            <TouchableOpacity
              style={[
                styles.mainSegmentBtn,
                creationType === 'food' && styles.mainSegmentBtnActive,
              ]}
              onPress={() => setCreationType('food')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.mainSegmentText,
                  creationType === 'food' && styles.mainSegmentTextActive,
                ]}
              >
                🍎 Alimento
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mainSegmentBtn,
                creationType === 'meal' && styles.mainSegmentBtnActive,
              ]}
              onPress={() => setCreationType('meal')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.mainSegmentText,
                  creationType === 'meal' && styles.mainSegmentTextActive,
                ]}
              >
                🍲 Refeição / Prato
              </Text>
            </TouchableOpacity>
          </View>

          {creationType === 'food' ? (
            /* ========================================================
               SINGLE FOOD FLOW
            ======================================================== */
            <>
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
            </>
          ) : (
            /* ========================================================
               MEAL / DISH FLOW
            ======================================================== */
            <>
              {/* Dish Name */}
              <Text style={styles.label}>NOME DA REFEIÇÃO / PRATO *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Espaguete à Carbonara, Omelete Proteico..."
                placeholderTextColor={DarkTheme.colors.textDimmed}
                value={dishName}
                onChangeText={setDishName}
              />

              {/* Meal Sub-selector */}
              <Text style={styles.label}>MÉTODO DE CADASTRO DO PRATO:</Text>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeBtn, mealMode === 'ingredients' && styles.modeBtnActive]}
                  onPress={() => setMealMode('ingredients')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modeText, mealMode === 'ingredients' && styles.modeTextActive]}>
                    🥗 Montar por Ingredientes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeBtn, mealMode === 'direct' && styles.modeBtnActive]}
                  onPress={() => setMealMode('direct')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modeText, mealMode === 'direct' && styles.modeTextActive]}>
                    ✍️ Informar Macros
                  </Text>
                </TouchableOpacity>
              </View>

              {mealMode === 'ingredients' ? (
                /* Mode 1: Recipe Builder */
                <View style={styles.recipeBuilderContainer}>
                  {/* Hero Summary Card */}
                  <View style={styles.mealHeroCard}>
                    <View style={styles.mealHeroHeader}>
                      <Text style={styles.mealHeroTitle}>🍲 TOTAL DA REFEIÇÃO</Text>
                      <Text style={styles.mealHeroGrams}>Peso Total: {totalGrams}g</Text>
                    </View>
                    <Text style={styles.mealHeroCalories}>{totalCalories} kcal</Text>
                    <View style={styles.mealHeroMacrosRow}>
                      <View style={styles.macroPill}>
                        <Text style={styles.macroPillLabel}>Proteína</Text>
                        <Text style={styles.macroPillValue}>{totalProtein}g</Text>
                      </View>
                      <View style={styles.macroPill}>
                        <Text style={styles.macroPillLabel}>Carboidratos</Text>
                        <Text style={styles.macroPillValue}>{totalCarbs}g</Text>
                      </View>
                      <View style={styles.macroPill}>
                        <Text style={styles.macroPillLabel}>Gorduras</Text>
                        <Text style={styles.macroPillValue}>{totalFat}g</Text>
                      </View>
                    </View>
                  </View>

                  {/* Add Ingredient Button */}
                  <TouchableOpacity
                    style={styles.addIngredientBtn}
                    onPress={handleOpenIngredientPicker}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addIngredientBtnText}>＋ Adicionar Ingrediente</Text>
                  </TouchableOpacity>

                  {/* Ingredients List */}
                  <Text style={styles.ingredientsListTitle}>
                    Ingredientes ({ingredients.length}):
                  </Text>
                  {ingredients.length === 0 ? (
                    <Text style={styles.emptyIngredientsText}>
                      Nenhum ingrediente adicionado ainda. Toque no botão acima para buscar alimentos
                      e somar os macros automaticamente.
                    </Text>
                  ) : (
                    ingredients.map((item) => (
                      <View key={item.id} style={styles.ingredientCard}>
                        <View style={styles.ingredientInfo}>
                          <Text style={styles.ingredientName} numberOfLines={1}>
                            {item.food.name}
                          </Text>
                          <Text style={styles.ingredientMacros}>
                            {item.calories} kcal • P: {item.protein}g • C: {item.carbs}g • G:{' '}
                            {item.fat}g
                          </Text>
                        </View>
                        <View style={styles.ingredientControls}>
                          <TextInput
                            style={styles.ingredientGramsInput}
                            value={String(item.grams)}
                            onChangeText={(val) => handleUpdateIngredientGrams(item.id, val)}
                            keyboardType="numeric"
                          />
                          <Text style={styles.ingredientGramsUnit}>g</Text>
                          <TouchableOpacity
                            style={styles.removeIngredientBtn}
                            onPress={() => handleRemoveIngredient(item.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.removeIngredientText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              ) : (
                /* Mode 2: Direct Dish Macros Entry */
                <View style={styles.directMealContainer}>
                  <View style={styles.portionFieldsRow}>
                    <View style={styles.portionCol}>
                      <Text style={styles.label}>PESO DA PORÇÃO DO PRATO (g) *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="250"
                        placeholderTextColor={DarkTheme.colors.textDimmed}
                        value={dishPortionGrams}
                        onChangeText={setDishPortionGrams}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.portionCol}>
                      <Text style={styles.label}>NOME DA PORÇÃO</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ex: prato (250g)"
                        placeholderTextColor={DarkTheme.colors.textDimmed}
                        value={dishPortionName}
                        onChangeText={setDishPortionName}
                      />
                    </View>
                  </View>

                  <Text style={styles.sectionTitle}>
                    VALORES NUTRICIONAIS DA PORÇÃO ({numDishPortionGrams}g):
                  </Text>

                  <View style={styles.macroGrid}>
                    <View style={styles.macroInputWrapper}>
                      <Text style={styles.macroInputLabel}>Calorias (kcal) *</Text>
                      <TextInput
                        style={styles.macroInput}
                        placeholder="0"
                        placeholderTextColor={DarkTheme.colors.textDimmed}
                        value={dishCalories}
                        onChangeText={setDishCalories}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.macroInputWrapper}>
                      <Text style={styles.macroInputLabel}>Proteína (g) *</Text>
                      <TextInput
                        style={styles.macroInput}
                        placeholder="0"
                        placeholderTextColor={DarkTheme.colors.textDimmed}
                        value={dishProtein}
                        onChangeText={setDishProtein}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.macroInputWrapper}>
                      <Text style={styles.macroInputLabel}>Carboidratos (g) *</Text>
                      <TextInput
                        style={styles.macroInput}
                        placeholder="0"
                        placeholderTextColor={DarkTheme.colors.textDimmed}
                        value={dishCarbs}
                        onChangeText={setDishCarbs}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.macroInputWrapper}>
                      <Text style={styles.macroInputLabel}>Gorduras (g) *</Text>
                      <TextInput
                        style={styles.macroInput}
                        placeholder="0"
                        placeholderTextColor={DarkTheme.colors.textDimmed}
                        value={dishFat}
                        onChangeText={setDishFat}
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
                      value={dishFiber}
                      onChangeText={setDishFiber}
                      keyboardType="numeric"
                    />
                  </View>

                  {numDishKcal > 0 && (numDishP > 0 || numDishC > 0 || numDishF > 0) && (
                    <View
                      style={[
                        styles.atwaterBox,
                        !isDishConsistent && styles.atwaterBoxWarning,
                      ]}
                    >
                      <Text style={styles.atwaterText}>
                        ℹ️ Atwater Estimado: <Text style={styles.bold}>{atwaterDishKcal} kcal</Text>{' '}
                        ({isDishConsistent ? 'Consistente' : 'Variação elevada'})
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
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

      {/* Ingredient Picker Modal */}
      <Modal
        visible={isPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <SafeAreaView style={styles.pickerModalContainer}>
          <View style={[styles.header, { paddingTop: safeTop }]}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setIsPickerVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Selecionar Ingrediente</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.pickerSearchContainer}>
            <TextInput
              style={styles.input}
              placeholder="Buscar ingrediente (ex: ovo, bacon, queijo...)"
              placeholderTextColor={DarkTheme.colors.textDimmed}
              value={pickerSearch}
              onChangeText={handlePickerSearchChange}
              autoFocus={true}
            />
          </View>

          {isPickerLoading ? (
            <ActivityIndicator
              size="large"
              color={DarkTheme.colors.primary}
              style={{ marginTop: 20 }}
            />
          ) : (
            <FlatList
              data={pickerFoods}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: DarkTheme.spacing.md }}
              renderItem={({ item }) => {
                const isSelected = selectedIngredientFood?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerFoodRow,
                      isSelected && styles.pickerFoodRowSelected,
                    ]}
                    onPress={() => setSelectedIngredientFood(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerFoodName}>{item.name}</Text>
                      <Text style={styles.pickerFoodMacros}>
                        100g • {item.calories} kcal • P: {item.protein}g • C: {item.carbs}g • G:{' '}
                        {item.fat}g
                      </Text>
                    </View>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyIngredientsText}>
                  Nenhum alimento encontrado para &quot;{pickerSearch}&quot;.
                </Text>
              }
            />
          )}

          {selectedIngredientFood && (
            <View style={styles.pickerConfirmBar}>
              <View style={styles.pickerGramsRow}>
                <Text style={styles.pickerGramsLabel}>Quantidade:</Text>
                <TextInput
                  style={styles.pickerGramsInput}
                  value={ingredientGramsInput}
                  onChangeText={setIngredientGramsInput}
                  keyboardType="numeric"
                />
                <Text style={styles.pickerGramsUnit}>g</Text>
              </View>

              {/* Quick Gram Presets */}
              <View style={styles.quickGramsRow}>
                {[50, 100, 150, 200].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={styles.quickGramChip}
                    onPress={() => setIngredientGramsInput(String(g))}
                  >
                    <Text style={styles.quickGramChipText}>{g}g</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button
                title={`Adicionar ${ingredientGramsInput}g de ${selectedIngredientFood.name.split(',')[0]}`}
                onPress={handleAddIngredient}
                variant="primary"
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>
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

  // Main Segmented Row
  mainSegmentedRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: DarkTheme.spacing.md,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderRadius: DarkTheme.borderRadius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: DarkTheme.colors.cardBorder,
  },
  mainSegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: DarkTheme.borderRadius.sm,
  },
  mainSegmentBtnActive: {
    backgroundColor: DarkTheme.colors.card,
    borderWidth: 1,
    borderColor: DarkTheme.colors.primary,
  },
  mainSegmentText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  mainSegmentTextActive: {
    color: DarkTheme.colors.primary,
    fontWeight: '700',
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

  // Meal Recipe Builder Styles
  recipeBuilderContainer: {
    marginTop: 10,
  },
  mealHeroCard: {
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.primary,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    padding: DarkTheme.spacing.md,
    marginBottom: DarkTheme.spacing.md,
  },
  mealHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mealHeroTitle: {
    color: DarkTheme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mealHeroGrams: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  mealHeroCalories: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  mealHeroMacrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  macroPill: {
    flex: 1,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderRadius: DarkTheme.borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DarkTheme.colors.cardBorder,
  },
  macroPillLabel: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  macroPillValue: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  addIngredientBtn: {
    backgroundColor: DarkTheme.colors.primaryMuted,
    borderColor: DarkTheme.colors.primary,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: DarkTheme.spacing.md,
  },
  addIngredientBtnText: {
    color: DarkTheme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  ingredientsListTitle: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptyIngredientsText: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
    lineHeight: 18,
  },
  ingredientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    padding: DarkTheme.spacing.sm,
    marginBottom: 8,
  },
  ingredientInfo: {
    flex: 1,
    marginRight: 8,
  },
  ingredientName: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  ingredientMacros: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 11,
  },
  ingredientControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ingredientGramsInput: {
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.sm,
    color: DarkTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 48,
    textAlign: 'center',
  },
  ingredientGramsUnit: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  removeIngredientBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  removeIngredientText: {
    color: DarkTheme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },

  // Direct Dish Container
  directMealContainer: {
    marginTop: 10,
  },

  // Ingredient Picker Modal
  pickerModalContainer: {
    flex: 1,
    backgroundColor: DarkTheme.colors.background,
  },
  pickerSearchContainer: {
    paddingHorizontal: DarkTheme.spacing.md,
    paddingVertical: DarkTheme.spacing.sm,
  },
  pickerFoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: DarkTheme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.colors.cardBorder,
  },
  pickerFoodRowSelected: {
    backgroundColor: DarkTheme.colors.primaryMuted,
    borderRadius: DarkTheme.borderRadius.sm,
  },
  pickerFoodName: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  pickerFoodMacros: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 11,
  },
  checkmark: {
    color: DarkTheme.colors.primary,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  pickerConfirmBar: {
    backgroundColor: DarkTheme.colors.card,
    borderTopWidth: 1,
    borderTopColor: DarkTheme.colors.cardBorder,
    padding: DarkTheme.spacing.md,
  },
  pickerGramsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  pickerGramsLabel: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  pickerGramsInput: {
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.primary,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.sm,
    color: DarkTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 70,
    textAlign: 'center',
  },
  pickerGramsUnit: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  quickGramsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickGramChip: {
    flex: 1,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: DarkTheme.colors.cardBorder,
    borderRadius: DarkTheme.borderRadius.sm,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGramChipText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
