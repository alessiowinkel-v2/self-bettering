import type { ReactNode } from 'react';
import {
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';

type CardSurface = 'surface' | 'surfaceElev';

type CardBaseProps = {
  children: ReactNode;
  /**
   * Surface token to paint behind the card. Defaults to 'surface'.
   * Use 'surfaceElev' for inputs or active rows that should sit one step
   * above their container.
   */
  surface?: CardSurface;
  /**
   * Internal padding in spacing-token units. Defaults to spacing[4] (16).
   */
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

type CardStaticProps = CardBaseProps & {
  onPress?: never;
  accessibilityLabel?: never;
};

type CardPressableProps = CardBaseProps & {
  onPress: () => void;
  accessibilityLabel: string;
};

export type CardProps = CardStaticProps | CardPressableProps;

/**
 * Card is the rounded-corner surface used for habit rows, the Yesterday
 * card, the Next workout card, and similar containers. Borderless by spec
 * — the surface tone alone separates it from the background.
 *
 * Pass onPress + accessibilityLabel together to make the card tappable.
 * Both are required when either is present.
 */
export function Card(props: CardProps) {
  const theme = useTheme();
  const surface = props.surface ?? 'surface';
  const padding = props.padding ?? theme.spacing[4];

  const containerStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: theme.colors[surface],
      borderRadius: theme.radii.lg,
      padding,
    },
    props.style,
  ];

  if (props.onPress) {
    return (
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        style={({ pressed }) => [containerStyle, pressed && { opacity: 0.85 }]}
      >
        {props.children}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{props.children}</View>;
}
