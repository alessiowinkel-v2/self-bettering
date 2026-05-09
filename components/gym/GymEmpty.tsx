import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text, TextButton } from '../primitives';

type GymEmptyProps = {
  onAdd: () => void;
};

/**
 * Empty-state for the Gym tab when no routines exist. Uses
 * TextButton, not FilledButton — the Today screen owns the canonical
 * first-time FilledButton entry; Gym Home is a secondary surface and
 * gets the quieter text affordance. Mirrors HabitsEmpty.
 */
export function GymEmpty({ onAdd }: GymEmptyProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingVertical: theme.spacing[7],
        alignItems: 'center',
      }}
    >
      <Text variant="displayItalic" align="center">
        No routines yet.
      </Text>
      <View style={{ height: theme.spacing[3] }} />
      <TextButton label="Add one." onPress={onAdd} accessibilityLabel="Add a routine" />
    </View>
  );
}
