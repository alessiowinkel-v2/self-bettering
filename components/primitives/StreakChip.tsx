import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

type StreakChipProps = {
  name: string;
  streak: number;
  /**
   * Active means the habit has been held today (or carries an unbroken
   * streak through today). Inactive chips render in muted gray.
   */
  active: boolean;
};

/**
 * Pill-shaped chip used in the Streaks row on Today and the streak
 * header on Habit Detail. Habit name on the left, streak number on the
 * right. Active chips lift the number into amber; inactive ones keep
 * both in muted text.
 */
export function StreakChip({ name, streak, active }: StreakChipProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        backgroundColor: theme.colors.surface,
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[2],
        borderRadius: theme.radii.pill,
      }}
    >
      <Text variant="caption" tone={active ? 'primary' : 'secondary'}>
        {name}
      </Text>
      <Text variant="caption" tone={active ? 'accent' : 'secondary'}>
        {streak}
      </Text>
    </View>
  );
}
