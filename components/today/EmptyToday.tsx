import { View } from 'react-native';
import { useTheme } from '../../theme';
import { FilledButton, Text } from '../primitives';

type EmptyTodayProps = {
  onAddHabit: () => void;
};

/**
 * First-time empty state for Today. Shown when no habits exist yet.
 *
 * One of the two valid uses of FilledButton — first-time empty-state CTAs
 * (per the design system's filled-button rule). The italic Fraunces line
 * sits above the button with generous breathing room.
 */
export function EmptyToday({ onAddHabit }: EmptyTodayProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingVertical: theme.spacing[7],
        alignItems: 'center',
      }}
    >
      <Text variant="displayItalic" align="center">
        Add your first habit to begin.
      </Text>
      <View style={{ height: theme.spacing[5] }} />
      <FilledButton
        label="Add a habit"
        onPress={onAddHabit}
        accessibilityLabel="Add your first habit"
      />
    </View>
  );
}
