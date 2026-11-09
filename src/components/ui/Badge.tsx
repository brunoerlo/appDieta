import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export interface BadgeProps {
  label: string;
  color?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  color,
  backgroundColor,
  style,
}) => {
  const { colors } = useTheme();
  const badgeColor = color ?? colors.primary;
  const badgeBg = backgroundColor ?? colors.primaryMuted;

  return (
    <View style={[styles.badge, { backgroundColor: badgeBg }, style]}>
      <Text style={[styles.text, { color: badgeColor }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
