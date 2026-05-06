import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

type ScreenProps = {
  children: ReactNode;
  /**
   * Safe-area edges to apply. Defaults to ['top'] so the date/title row
   * never sits under the dynamic island. Pass [] to opt out.
   */
  edges?: ReadonlyArray<Edge>;
  /**
   * When true, content scrolls vertically. When false, content fills the
   * screen with a flex column. Defaults to true.
   */
  scroll?: boolean;
  /**
   * Horizontal gutter in spacing-token units. Defaults to spacing[5] (24).
   */
  paddingHorizontal?: number;
  /**
   * Bottom padding in spacing-token units. Defaults to spacing[8] (64) on
   * scrolling screens to keep content above the home indicator.
   */
  paddingBottom?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Screen is the outermost layout primitive for every route. It paints the
 * theme background, applies safe-area insets, and provides consistent
 * horizontal gutters. Prefer this over hand-rolling SafeAreaView per screen.
 */
export function Screen({
  children,
  edges = ['top'],
  scroll = true,
  paddingHorizontal,
  paddingBottom,
  contentContainerStyle,
  style,
}: ScreenProps) {
  const theme = useTheme();
  const hPad = paddingHorizontal ?? theme.spacing[5];
  const bPad = paddingBottom ?? theme.spacing[8];

  if (scroll) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.bg }, style]} edges={edges}>
        <ScrollView
          contentContainerStyle={[
            { paddingHorizontal: hPad, paddingBottom: bPad },
            contentContainerStyle,
          ]}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: theme.colors.bg }, style]} edges={edges}>
      <View
        style={[
          { flex: 1, paddingHorizontal: hPad, paddingBottom: bPad },
          contentContainerStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
