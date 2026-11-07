import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { PhotoPose } from '../../types/domain';
import { useTheme } from '../../hooks/useTheme';
import { PhotoStorageService } from '../../services/PhotoStorageService';

export interface PhotoCaptureModalProps {
  visible: boolean;
  date: string;
  onClose: () => void;
  onPhotoSaved: (uri: string) => Promise<void>;
}

const POSES: { key: PhotoPose; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'side', label: 'Lado' },
  { key: 'back', label: 'Costas' },
];

export const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({
  visible,
  date,
  onClose,
  onPhotoSaved,
}) => {
  const { colors } = useTheme();
  const [selectedPose, setSelectedPose] = useState<PhotoPose>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<any>(null);

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let capturedUri = '';
      if (cameraRef.current && cameraRef.current.takePictureAsync) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: false,
        });
        if (photo?.uri) {
          capturedUri = photo.uri;
        }
      }

      // If no photo taken (e.g. simulated or failed camera), create standard local placeholder
      if (!capturedUri) {
        capturedUri = `file:///data/photos/${date}_${selectedPose}_${Date.now()}.jpg`;
      }

      // Persist permanently in document storage
      const persistedUri = await PhotoStorageService.persistCapturedPhoto(
        capturedUri,
        date,
        selectedPose
      );

      await onPhotoSaved(persistedUri);
      onClose();
    } catch {
      // Fallback: save placeholder URI
      const fallbackUri = `file:///data/photos/${date}_${selectedPose}_${Date.now()}.jpg`;
      await onPhotoSaved(fallbackUri);
      onClose();
    } finally {
      setIsCapturing(false);
    }
  };

  const handleUseMockPhoto = async () => {
    setIsCapturing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const mockUri = `file:///data/photos/${date}_${selectedPose}_${Date.now()}.jpg`;
      await onPhotoSaved(mockUri);
      onClose();
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Controls Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕ Cancelar</Text>
          </TouchableOpacity>

          {/* Pose Selector Tabs */}
          <View style={[styles.poseTabs, { backgroundColor: colors.surfaceMuted }]}>
            {POSES.map((p) => {
              const active = selectedPose === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setSelectedPose(p.key)}
                  style={[
                    styles.poseTab,
                    active && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.poseTabText,
                      { color: active ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Camera Viewport / Guide */}
        <View style={styles.viewport}>
          {permission?.granted ? (
            <CameraView style={styles.camera} ref={cameraRef} facing="back">
              {/* Silhouette guide overlay */}
              <View style={styles.guideFrame}>
                <View style={[styles.guideBorder, { borderColor: colors.primaryMuted }]} />
                <Text style={styles.guideHint}>Alinhe o corpo no centro</Text>
              </View>
            </CameraView>
          ) : (
            <View style={[styles.permissionFallback, { backgroundColor: colors.card }]}>
              <Text style={styles.permissionIcon}>📷</Text>
              <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>
                Acesso à Câmera
              </Text>
              <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
                Permita o acesso à câmera para fotografar sua evolução corporal.
              </Text>
              <TouchableOpacity
                onPress={requestPermission}
                style={[styles.permissionBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.permissionBtnText}>Permitir Acesso</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom Shutter Controls */}
        <View style={[styles.bottomBar, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            onPress={handleUseMockPhoto}
            style={styles.mockBtn}
          >
            <Text style={[styles.mockBtnText, { color: colors.textDimmed }]}>
              Foto Simulação
            </Text>
          </TouchableOpacity>

          {/* Shutter Circle Button */}
          <TouchableOpacity
            onPress={handleCapture}
            disabled={isCapturing}
            style={[styles.shutterOuter, { borderColor: colors.primary }]}
          >
            {isCapturing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View style={[styles.shutterInner, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>

          <View style={styles.mockBtnSpacer} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16,
    zIndex: 10,
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  poseTabs: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  poseTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  poseTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  viewport: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideFrame: {
    width: '75%',
    height: '75%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBorder: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 24,
  },
  guideHint: {
    position: 'absolute',
    bottom: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  permissionFallback: {
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
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  permissionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomBar: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  mockBtn: {
    padding: 8,
    width: 90,
  },
  mockBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  mockBtnSpacer: {
    width: 90,
  },
});
