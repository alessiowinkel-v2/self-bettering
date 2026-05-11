import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text, TextButton } from '../primitives';

type HabitsEmptyProps = {
  onAdd: () => void;
};

/**
 * Empty-state for the Habits tab when no habits exist in any state.
 * Uses TextButton, not FilledButton — the Today screen owns the
 * canonical first-time FilledButton entry; Habits List is a secondary
 * surface and gets the quieter text affordance.
 */
export function HabitsEmpty({ onAdd }: HabitsEmptyProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingVertical: theme.spacing[7],
        alignItems: 'center',
      }}
    >
      <Text variant="displayItalic" align="center">
        No habits yet.
      </Text>
      <View style={{ height: theme.spacing[3] }} />
      <TextButton label="Add one" onPress={onAdd} accessibilityLabel="Add a habit" />
    </View>
  );
}
