import React from 'react';
import { StyleSheet } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBody } from '../../hooks/useBody';
import { useTheme } from '../../hooks/useTheme';
import { BeforeAfterViewerModal } from '../../components/body/BeforeAfterViewerModal';

export default function BodyCompareScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { photos, getBodyLog } = useBody();

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
});
