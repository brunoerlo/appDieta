import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Returns a standardized safe top padding in pixels, guaranteeing that
 * headers, buttons, and titles render comfortably below the device clock and status bar.
 *
 * Combines useSafeAreaInsets().top, StatusBar.currentHeight on Android, and minimum
 * platform fallbacks so buttons never overlap with the device status bar or notch.
 *
 * @param extraOffset Additional spacing below the status bar (default: 0)
 */
export function useSafeTopPadding(extraOffset: number = 0): number {
  const insets = useSafeAreaInsets();
  const insetsTop = insets?.top ?? 0;

  const androidBar = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
  const baseTop = Math.max(insetsTop, androidBar);
  const safeTop = baseTop > 0 ? baseTop : (Platform.OS === 'ios' ? 44 : 24);

  return safeTop + extraOffset;
}
