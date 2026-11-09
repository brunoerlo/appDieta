import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { SqliteDietRepository } from '../../database/repositories/SqliteDietRepository';
import { openFoodFactsService } from '../../services/OpenFoodFactsService';
import { ServingSizeModal } from '../../components/nutrition/ServingSizeModal';
import { FoodItem, MealType } from '../../types/domain';
import { useDiet } from '../../hooks/useDiet';
import { useSafeTopPadding } from '../../hooks/useSafeTopPadding';

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const safeTop = useSafeTopPadding(10);
  const params = useLocalSearchParams<{ mealType?: MealType; date?: string }>();
  const mealType = params.mealType || 'snack';

  const db = useSQLiteContext();
  const dietRepo = useMemo(() => new SqliteDietRepository(db), [db]);
  const { addFoodLog } = useDiet();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [torch, setTorch] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const processBarcode = async (barcode: string) => {
    const clean = barcode.trim();
    if (!clean || loading) return;

    setLoading(true);
    setScanned(true);

    try {
      // 1. Search Local SQLite database first
      const localFood = await dietRepo.getFoodByBarcode(clean);
      if (localFood) {
        setSelectedFood(localFood);
        setModalVisible(true);
        setLoading(false);
        return;
      }

      // 2. Search Remote Open Food Facts
      const remoteFood = await openFoodFactsService.getProductByBarcode(clean);
      if (remoteFood) {
        // Cache to local SQLite so subsequent scans are offline and instantaneous
        try {
          await dietRepo.createFood(remoteFood);
        } catch {
          // Ignore unique collision
        }
        setSelectedFood(remoteFood);
        setModalVisible(true);
        setLoading(false);
        return;
      }

      // 3. Not Found -> Prompt to register custom food
      Alert.alert(
        'Produto Não Encontrado',
        `Nenhum alimento cadastrado com o código ${clean}. Deseja cadastrá-lo manualmente?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => setScanned(false) },
          {
            text: 'Cadastrar',
            onPress: () => {
              router.replace({
                pathname: '/nutrition/custom',
                params: { barcode: clean, mealType, date: params.date },
              });
            },
          },
        ]
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível consultar o código de barras.');
      setScanned(false);
    } finally {
      setLoading(false);
    }
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
    await addFoodLog({
      mealType: entry.mealType,
      food: entry.food,
      servingGrams: entry.servingGrams,
    });
    setModalVisible(false);
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Camera View or Permission Box */}
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'],
          }}
          onBarcodeScanned={scanned ? undefined : ({ data }) => processBarcode(data)}
        />
      ) : (
        <View style={styles.permissionBox}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Permissão de Câmera</Text>
          <Text style={styles.permissionText}>
            O -Frango precisa de acesso à câmera para ler códigos de barras de alimentos.
          </Text>
          <TouchableOpacity style={styles.btnPerm} onPress={requestPermission}>
            <Text style={styles.btnPermText}>Permitir Câmera</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Viewfinder Overlay HUD */}
      {permission?.granted && (
        <View style={styles.reticleOverlay} pointerEvents="none">
          <View style={styles.targetFrame} />
          <Text style={styles.helperText}>
            Posicione o código de barras no centro do quadro
          </Text>
        </View>
      )}

      {/* Top Controls Overlay */}
      <View style={[styles.topControls, { paddingTop: safeTop, paddingBottom: 12 }]}>
        <TouchableOpacity
          style={styles.circleBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.circleBtnText}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.screenTitle}>Escanear Código</Text>

        <TouchableOpacity
          style={[styles.circleBtn, torch && styles.circleBtnActive]}
          onPress={() => setTorch((t) => !t)}
          activeOpacity={0.7}
        >
          <Text style={styles.circleBtnText}>{torch ? '⚡' : '💡'}</Text>
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Consultando produto...</Text>
        </View>
      )}

      {/* Manual / Simulator Barcode Input HUD */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomHud}
      >
        <View style={styles.manualCard}>
          <Text style={styles.manualTitle}>⌨️ Digitar código de barras:</Text>
          <View style={styles.manualInputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ex: 7898215150014"
              placeholderTextColor={colors.textDimmed}
              value={manualCode}
              onChangeText={setManualCode}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={styles.btnSearch}
              onPress={() => processBarcode(manualCode)}
              activeOpacity={0.7}
            >
              <Text style={styles.btnSearchText}>Buscar</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Simulation Chips */}
          <View style={styles.simChipsRow}>
            <TouchableOpacity
              style={styles.simChip}
              onPress={() => processBarcode('7898215150014')}
            >
              <Text style={styles.simChipText}>Simular Leite (7898215150014)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.simChip}
              onPress={() => processBarcode('9999000011112')}
            >
              <Text style={styles.simChipText}>Simular Desconhecido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Serving Modal */}
      <ServingSizeModal
        visible={modalVisible}
        food={selectedFood}
        mealType={mealType}
        onClose={() => {
          setModalVisible(false);
          setSelectedFood(null);
          setScanned(false);
        }}
        onConfirm={handleConfirmServing}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    permissionBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    permissionIcon: {
      fontSize: 48,
      marginBottom: 16,
    },
    permissionTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 8,
    },
    permissionText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    btnPerm: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    btnPermText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 15,
    },
    reticleOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    targetFrame: {
      width: 280,
      height: 160,
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 16,
      backgroundColor: 'rgba(16, 185, 129, 0.05)',
    },
    helperText: {
      color: '#FFFFFF',
      marginTop: 20,
      fontSize: 13,
      fontWeight: '600',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 9999,
    },
    topControls: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    screenTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    circleBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleBtnActive: {
      backgroundColor: colors.primary,
    },
    circleBtnText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
      marginTop: 12,
    },
    bottomHud: {
      position: 'absolute',
      bottom: 24,
      left: 16,
      right: 16,
    },
    manualCard: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
    },
    manualTitle: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 8,
    },
    manualInputRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      height: 44,
      color: colors.textPrimary,
      fontSize: 15,
    },
    btnSearch: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnSearchText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    simChipsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    simChip: {
      flex: 1,
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 8,
      alignItems: 'center',
    },
    simChipText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
  });
