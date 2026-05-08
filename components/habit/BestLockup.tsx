import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../primitives';

/**
 * "BEST 47" lockup. Small-caps "BEST" in fg-secondary, Fraunces number
 * in fg-primary, sitting on a single baseline-aligned line. The design
 * uses the same compose anywhere a "best" record is shown.
 */

type BestLockupProps = {
  best: number;
};

export function BestLockup({ best }: BestLockupProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: theme.spacing[2],
      }}
    >
      <Text variant="label" tone="secondary">
        BEST
      </Text>
      <Text variant="streakAccent" tone="primary">
        {best}
      </Text>
    </View>
  );
}
