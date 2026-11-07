import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useSafeTopPadding } from '../../hooks/useSafeTopPadding';
import { useTheme } from '../../hooks/useTheme';

export interface TopBarActionConfig {
  label?: string;
  icon?: React.ReactNode | string;
  onPress: () => void;
  accessibilityLabel?: string;
}

export interface AppTopBarProps {
  title?: string;
  subtitle?: string;
  isLogoInstagram?: boolean;
  centerTitle?: boolean;
  leftAction?: TopBarActionConfig | React.ReactNode;
  rightAction?: React.ReactNode;
  showBorderBottom?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  extraTopPadding?: number;
}

export const AppTopBar: React.FC<AppTopBarProps> = ({
  title,
  subtitle,
  isLogoInstagram = false,
  centerTitle = true,
  leftAction,
  rightAction,
  showBorderBottom = true,
  style,
  titleStyle,
  extraTopPadding = 8,
}) => {
  const safeTop = useSafeTopPadding(extraTopPadding);
  const { colors } = useTheme();

  const renderLeftAction = () => {
    if (!leftAction) return null;

    if (React.isValidElement(leftAction)) {
      return leftAction;
    }

    const action = leftAction as TopBarActionConfig;
    return (
      <TouchableOpacity
        onPress={action.onPress}
        style={styles.actionBtn}
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel || action.label}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        {typeof action.icon === 'string' ? (
          <Text style={[styles.actionIcon, { color: colors.primary }]}>{action.icon}</Text>
        ) : (
          action.icon
        )}
        {action.label && (
          <Text style={[styles.actionLabel, { color: colors.primary }]}>{action.label}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safeTop,
          backgroundColor: colors.background,
          borderBottomColor: showBorderBottom ? colors.cardBorder : 'transparent',
          borderBottomWidth: showBorderBottom ? StyleSheet.hairlineWidth : 0,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {/* Left Slot */}
        <View style={styles.sideSlotLeft}>
          {renderLeftAction()}
        </View>

        {/* Center / Title Slot */}
        <View style={[styles.centerSlot, !centerTitle && styles.alignLeft]}>
          {isLogoInstagram ? (
            <Text style={[styles.instagramBrand, { color: colors.textPrimary }, titleStyle]}>
              IronTrack
            </Text>
          ) : (
            <>
              {title ? (
                <Text
                  style={[
                    styles.title,
                    { color: colors.textPrimary },
                    !centerTitle && { textAlign: 'left' },
                    titleStyle,
                  ]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text
                  style={[
                    styles.subtitle,
                    { color: colors.textSecondary },
                    !centerTitle && { textAlign: 'left' },
                  ]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* Right Slot */}
        <View style={styles.sideSlotRight}>
          {rightAction}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  sideSlotLeft: {
    minWidth: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 2,
  },
  sideSlotRight: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 2,
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  alignLeft: {
    alignItems: 'flex-start',
  },
  actionBtn: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    fontSize: 20,
    fontWeight: '600',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  instagramBrand: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
