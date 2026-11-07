import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { DarkTheme } from '../../constants/theme';

export interface ProgressBarProps {
  progress: number; // 0 to 1
  color: string;
  trackColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
  trackColor = DarkTheme.colors.surfaceMuted,
  height = 8,
  style,
}) => {
  const clamped = Math.max(0, Math.min(1, isNaN(progress) ? 0 : progress));
  const widthPercent = `${Math.round(clamped * 100)}%` as const;

  return (
    <View style={[styles.track, { backgroundColor: trackColor, height, borderRadius: height / 2 }, style]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: widthPercent,
            height,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
