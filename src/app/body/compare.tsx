import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBody } from '../../hooks/useBody';
import { useTheme } from '../../hooks/useTheme';
import { BeforeAfterViewerModal } from '../../components/body/BeforeAfterViewerModal';

export default function BodyCompareScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { photos, getBodyLog } = useBody();

  if (photos.length < 2) {
    return (
      <SafeAreaView
        style={[styles.container, styles.emptyContainer, { backgroundColor: colors.background }]}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <Text style={styles.emptyIcon}>📷</Text>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
          Fotos Insuficientes
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Registre pelo menos 2 fotos de evolução para utilizar o comparador Antes vs. Depois.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <BeforeAfterViewerModal
        visible={true}
        photos={photos}
        getBodyLog={getBodyLog}
        onClose={() => router.back()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
