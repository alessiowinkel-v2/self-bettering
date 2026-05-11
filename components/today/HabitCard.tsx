import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Card, Text, TextButton } from '../primitives';
import type { HabitStatus } from '../../state/types';
import { AnimatedStreakNumber } from './AnimatedStreakNumber';

type HabitCardProps = {
  name: string;
  /**
   * Streak as currently displayed. Includes today's status:
   *   - null (not yet logged): streak-through-yesterday
   *   - 'held':                streak-through-yesterday + 1
   *   - 'slipped':             0
   * Derived in the parent (Today). When the value changes from N to N+1
   * the inner AnimatedStreakNumber fires the amber pulse.
   */
  streak: number;
  /** null = not yet logged today (expanded). 'held' | 'slipped' = collapsed. */
  status: HabitStatus | null;
  onHeld: () => void;
  onSlipped: () => void;
  /**
   * Optional surface tap. Routes to Habit Detail on Today. The inner
   * Held/Slipped TextButtons are Pressables themselves and become the
   * gesture responder when tapped, so the card-level onPress fires only
   * for the outer surface — no double-fire.
   */
  onPress?: () => void;
};

// Null → non-null transitions hold the expanded view for this many ms
// before swapping to the collapsed form. Chosen to land just past the
// pulse peak inside AnimatedStreakNumber (Phase 2 midpoint at ~210ms
// of a 320ms total), so the user sees the new streak number pulse
// before the card folds. Without this delay, status would change in
// the same render that introduces the new streak value, the streak
// Text would unmount immediately, and the animation would never fire.
const COLLAPSE_DELAY_MS = 240;

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
export function HabitCard({
  name,
  streak,
  status,
  onHeld,
  onSlipped,
  onPress,
}: HabitCardProps) {
  const theme = useTheme();

  // delayedStatus lags behind the prop status so the null → non-null
  // path holds the expanded form long enough for the streak-number
  // animation to play. Other transitions apply immediately:
  //   - same value: no-op
  //   - to null (external reset / store re-hydrate): immediate so the
  //     row matches the source of truth without a stale collapsed state
  //   - non-null → non-null (user changed mind from held to slipped or
  //     vice versa within a single window): immediate to avoid flicking
  //     between two collapsed forms
  const [delayedStatus, setDelayedStatus] = useState<HabitStatus | null>(status);

  useEffect(() => {
    if (status === delayedStatus) return;
    if (status === null || delayedStatus !== null) {
      setDelayedStatus(status);
      return;
    }
    const t = setTimeout(() => setDelayedStatus(status), COLLAPSE_DELAY_MS);
    return () => clearTimeout(t);
  }, [status, delayedStatus]);

  const collapsed = delayedStatus !== null;

  // Reduced vertical padding when collapsed so the three-card rhythm reads
  // steady. The horizontal padding stays put.
  const padding = collapsed ? theme.spacing[3] : theme.spacing[4];

  const body = (
    <>
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
            tone={delayedStatus === 'held' ? 'accent' : 'secondary'}
          >
            {delayedStatus === 'held' ? 'HELD' : 'SLIPPED'}
          </Text>
        ) : (
          <AnimatedStreakNumber streak={streak} />
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
    </>
  );

  if (onPress) {
    return (
      <Card
        padding={padding}
        onPress={onPress}
        accessibilityLabel={`Open ${name}`}
      >
        {body}
      </Card>
    );
  }

  return <Card padding={padding}>{body}</Card>;
}
