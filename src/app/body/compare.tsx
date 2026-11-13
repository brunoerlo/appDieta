import React from 'react';
import { StyleSheet } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBody } from '../../hooks/useBody';
import { useTheme } from '../../hooks/useTheme';
import { SupabaseBodyRepository } from '../../database/repositories/SupabaseBodyRepository';
import { BeforeAfterViewerModal } from '../../components/body/BeforeAfterViewerModal';

export default function BodyCompareScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { photos } = useBody();
  const bodyRepo = React.useMemo(() => new SupabaseBodyRepository(), []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <BeforeAfterViewerModal
        visible={true}
        photos={photos}
        getBodyLog={(d) => bodyRepo.getBodyLog(d)}
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
