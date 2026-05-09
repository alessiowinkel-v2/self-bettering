import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../primitives';

type RoutineRowProps = {
  name: string;
  /**
   * Subtitle line, e.g. "Last · today · 5 exercises" or
   * "Last · never · 5 exercises". Composed by the screen so the row
   * stays formatting-agnostic.
   */
  subtitle: string;
  /** When true, the leading amber dot renders; otherwise the gutter is reserved blank. */
  isNextUp: boolean;
  /** Hide the trailing divider on the last row. */
  isLast: boolean;
  onPress: () => void;
};

/**
 * Routine row on Gym Home. Every row reserves a fixed-width gutter on
 * the left for the "next-up" dot — the dot itself toggles visibility
 * via `isNextUp`, but the gutter is always present so routine names
 * align vertically regardless of which row carries the highlight.
 * Same convention as iOS Settings rows and Mail's flagged-message
 * indicator.
 */

const NEXT_UP_DOT_SIZE = 6;
const NEXT_UP_GUTTER_WIDTH = 14;

export function RoutineRow({
  name,
  subtitle,
  isNextUp,
  isLast,
  onPress,
}: RoutineRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <View
        style={{
          paddingVertical: theme.spacing[4],
          minHeight: theme.touchTarget.minHeight,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: NEXT_UP_GUTTER_WIDTH,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isNextUp ? (
            <View
              style={{
                width: NEXT_UP_DOT_SIZE,
                height: NEXT_UP_DOT_SIZE,
                borderRadius: NEXT_UP_DOT_SIZE / 2,
                backgroundColor: theme.colors.accent,
              }}
            />
          ) : null}
        </View>
        <View style={{ flex: 1, gap: theme.spacing[1] }}>
          <Text variant="body">{name}</Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
      {!isLast ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.colors.divider,
            // Match the gutter so the divider lines up under the name,
            // not under the next-up dot column.
            marginLeft: NEXT_UP_GUTTER_WIDTH,
          }}
        />
      ) : null}
    </Pressable>
  );
}
