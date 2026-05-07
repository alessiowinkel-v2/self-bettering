import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Card, Text, TextButton } from '../primitives';
import type { HabitStatus } from '../../state/types';

type HabitCardProps = {
  name: string;
  /** Streak as of end of yesterday. */
  streak: number;
  /** null = not yet logged today (expanded). 'held' | 'slipped' = collapsed. */
  status: HabitStatus | null;
  onHeld: () => void;
  onSlipped: () => void;
};

/**
 * Habit card on Today. Two states:
 *
 *   Expanded — name on the left, streak in amber on the right, twin
 *     Held / Slipped text buttons below. Daily action so never filled.
 *
 *   Collapsed — same Card surface with reduced internal vertical padding
 *     so the rhythm of three card-shaped slots holds steady mid-tap. Right
 *     side is "HELD" or "SLIPPED" in small-caps amber/muted.
 */
export function HabitCard({ name, streak, status, onHeld, onSlipped }: HabitCardProps) {
  const theme = useTheme();
  const collapsed = status !== null;

  // Reduced vertical padding when collapsed so the three-card rhythm reads
  // steady. The horizontal padding stays put.
  const padding = collapsed ? theme.spacing[3] : theme.spacing[4];

  return (
    <Card padding={padding}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing[3],
        }}
      >
        <Text variant="body" style={{ flexShrink: 1 }}>
          {name}
        </Text>
        {collapsed ? (
          <Text
            variant="label"
            tone={status === 'held' ? 'accent' : 'secondary'}
          >
            {status === 'held' ? 'HELD' : 'SLIPPED'}
          </Text>
        ) : (
          <Text variant="streakAccent" tone="accent">
            {streak}
          </Text>
        )}
      </View>

      {collapsed ? null : (
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing[6],
            marginTop: theme.spacing[2],
          }}
        >
          <TextButton label="Held" onPress={onHeld} accessibilityLabel={`Mark ${name} held`} />
          <TextButton
            label="Slipped"
            tone="secondary"
            onPress={onSlipped}
            accessibilityLabel={`Mark ${name} slipped`}
          />
        </View>
      )}
    </Card>
  );
}
