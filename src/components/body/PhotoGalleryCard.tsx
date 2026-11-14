import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { extractPoseFromUri, resolvePhotoUri } from '../../utils/photoComparison';

export interface PhotoGalleryCardProps {
  photos: { date: string; uri: string }[];
  onAddPhoto: () => void;
  onCompare: () => void;
  onDeletePhoto?: (uri: string, date: string) => void | Promise<void>;
}

const POSE_LABELS: Record<string, string> = {
  front: 'Frente',
  side: 'Lado',
  back: 'Costas',
  other: 'Geral',
};

export const PhotoGalleryCard: React.FC<PhotoGalleryCardProps> = ({
  photos,
  onAddPhoto,
  onCompare,
  onDeletePhoto,
}) => {
  const { colors } = useTheme();
  const [failedUris, setFailedUris] = useState<Record<string, boolean>>({});

  const canCompare = photos.length >= 2;

  const handleImageError = (uri: string) => {
    setFailedUris((prev) => ({ ...prev, [uri]: true }));
  };

  const handleDelete = (uri: string, date: string) => {
    if (!onDeletePhoto) return;
    Alert.alert(
      'Excluir Foto',
      'Deseja remover esta foto de evolução?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void Promise.resolve(onDeletePhoto(uri, date)).catch((err: any) => {
              Alert.alert('Erro', err?.message || 'Não foi possível excluir a foto.');
            });
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Fotos de Evolução</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {photos.length} {photos.length === 1 ? 'foto registrada' : 'fotos registradas'}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onAddPhoto}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.addBtnText}>+ Nova Foto</Text>
        </TouchableOpacity>
      </View>

      {/* Compare CTA when >= 2 photos */}
      {canCompare && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onCompare}
          style={[
            styles.compareBanner,
            { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
          ]}
        >
          <Text style={styles.compareIcon}>📸</Text>
          <View style={styles.compareTextContainer}>
            <Text style={[styles.compareTitle, { color: colors.primary }]}>
              Comparar Antes vs. Depois
            </Text>
            <Text style={[styles.compareSubtitle, { color: colors.textSecondary }]}>
              Visualize sua evolução lado a lado com métricas de peso e medidas
            </Text>
          </View>
          <Text style={[styles.compareArrow, { color: colors.primary }]}>→</Text>
        </TouchableOpacity>
      )}

      {/* Photo List */}
      {photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={[styles.emptyText, { color: colors.textDimmed }]}>
            Nenhuma foto de evolução cadastrada ainda.
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onAddPhoto}
            style={[styles.emptyBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
          >
            <Text style={[styles.emptyBtnText, { color: colors.primary }]}>
              Tirar Primeira Foto
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {photos.map((item, idx) => {
            const pose = extractPoseFromUri(item.uri);
            const poseLabel = POSE_LABELS[pose] || 'Geral';
            const resolvedUri = resolvePhotoUri(item.uri);
            const isBroken = !resolvedUri || failedUris[item.uri];

            const parts = item.date.split('-');
            const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date;

            return (
              <View
                key={`${item.uri}-${idx}`}
                style={[
                  styles.photoItem,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                ]}
              >
                {isBroken ? (
                  <View style={styles.brokenImagePlaceholder}>
                    <Text style={styles.brokenImageIcon}>📷</Text>
                    <Text style={[styles.brokenImageText, { color: colors.textDimmed }]}>
                      Indisponível
                    </Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: resolvedUri }}
                    style={styles.photoImage}
                    resizeMode="cover"
                    onError={() => handleImageError(item.uri)}
                  />
                )}

                {/* Badges Overlay */}
                <View style={styles.overlayTop}>
                  <View style={styles.badgePill}>
                    <Text style={styles.badgePillText}>{poseLabel}</Text>
                  </View>
                  {onDeletePhoto && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleDelete(item.uri, item.date)}
                      style={styles.deleteCircle}
                    >
                      <Text style={styles.deleteCircleText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.overlayBottom}>
                  <Text style={styles.dateText}>{dateLabel}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  compareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  compareIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  compareTextContainer: {
    flex: 1,
  },
  compareTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  compareSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  compareArrow: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    marginBottom: 12,
  },
  emptyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  carousel: {
    paddingRight: 16,
    gap: 12,
  },
  photoItem: {
    width: 110,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  brokenImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  brokenImageIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  brokenImageText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  overlayTop: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgePill: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCircleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
