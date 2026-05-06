import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type DividerProps = {
  /**
   * Inset from the leading edge in spacing-token units. Defaults to 0
   * (full-bleed). Use spacing[4] for indented dividers inside cards.
   */
  inset?: number;
  /**
   * Vertical margin in spacing-token units. Defaults to 0 — most consumers
   * place the divider directly between rows.
   */
  marginVertical?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Divider is a single hairline rule in the theme's divider tone. Used
 * between list rows and section seams. Keep it quiet — never thicker than
 * StyleSheet.hairlineWidth.
 */
export function Divider({ inset = 0, marginVertical = 0, style }: DividerProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.divider,
          marginLeft: inset,
          marginVertical,
        },
        style,
      ]}
    />
  );
}
