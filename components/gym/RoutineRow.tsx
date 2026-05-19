import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../primitives';

type RoutineRowProps = {
  name: string;
  /**
   * Subtitle line, e.g. "Last · today · 5 exercises." or
   * "Last · never · 5 exercises." — composed by the screen so the
   * row stays formatting-agnostic.
   */
  subtitle: string;
  /** Hide the trailing divider on the last row. */
  isLast: boolean;
  onPress: () => void;
};

/**
 * Workout row on the Gym tab. Tapping opens the workout's detail
 * screen, where the user starts or edits it.
 */
export function RoutineRow({ name, subtitle, isLast, onPress }: RoutineRowProps) {
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
          justifyContent: 'center',
          gap: theme.spacing[1],
        }}
      >
        <Text variant="body">{name}</Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {!isLast ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.colors.divider,
          }}
        />
      ) : null}
    </Pressable>
  );
}
