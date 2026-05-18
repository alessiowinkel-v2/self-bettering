import { Pressable, View } from 'react-native';
import type { SetRow } from '../../db/sets';
import { useTheme } from '../../theme';
import { Text } from '../primitives';
import { formatLastSetsLine, formatPrescription } from '../../utils/workout';

type ExerciseHeaderProps = {
  name: string;
  setCount: number;
  repRange: readonly [number, number];
  /**
   * Sets from the most recent prior completed workout for this
   * exercise. Empty array hides the LAST line entirely — first-ever
   * exercises (and recently-reset routines) sit without prior data
   * rather than rendering an empty "LAST" prefix.
   */
  lastSets: ReadonlyArray<Pick<SetRow, 'kg' | 'reps'>>;
  /**
   * Opens the swap-exercise picker. Wired to the "Swap." link beside
   * the name.
   */
  onSwap: () => void;
  /**
   * Opens this exercise's history. Wired to a tap on the name itself —
   * the name is a quiet tap target, not a signposted button.
   */
  onOpenHistory: () => void;
};

/**
 * Header block for the current exercise — PDF page 15.
 *
 *   Bench press        Swap.    ← Fraunces display + swap-exercise link
 *   4 × 5–8                      ← Fraunces italic subtitle, tone-secondary
 *   LAST  82.5kg × 6, 6, 5, 4    ← label "LAST" + body summary, both tone-secondary
 *
 * The exercise name is itself a tap target — tapping it opens Exercise
 * History via `onOpenHistory`. There is no underline, chevron, or button
 * chrome: the affordance is discoverable, not signposted, matching the
 * design's other plain-text actions. The only feedback is a press dim.
 *
 * The "Swap." link to the right of the name opens the swap-exercise
 * picker via `onSwap` — the affordance is current-exercise only, which
 * is why it lives here and not in PreviousExerciseRow. It is a quiet
 * Fraunces-italic text affordance, matching Lumen's other secondary
 * actions ("+ tag", "Skip", "Save workout") rather than an icon.
 *
 * The LAST line is the sole hide-condition: no prior sets → hide.
 * Everything else renders unconditionally.
 */
export function ExerciseHeader({
  name,
  setCount,
  repRange,
  lastSets,
  onSwap,
  onOpenHistory,
}: ExerciseHeaderProps) {
  const theme = useTheme();
  const lastLine = formatLastSetsLine(lastSets);

  return (
    <View>
      {/* Name + swap link. flex-start so the link aligns to the first
          line of a name that wraps; the Pressable is one display
          line-height tall with the "Swap." text centered in it. The
          name Pressable flex-shrinks so a long name wraps rather than
          shoving the link off-screen. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Pressable
          onPress={onOpenHistory}
          accessibilityRole="button"
          accessibilityLabel={`View ${name} history`}
          style={({ pressed }) => [
            { flexShrink: 1 },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text variant="display">{name}</Text>
        </Pressable>
        <Pressable
          onPress={onSwap}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Swap ${name} for another exercise`}
          style={({ pressed }) => [
            {
              height: theme.type.display.lineHeight,
              justifyContent: 'center',
              paddingLeft: theme.spacing[3],
            },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text variant="bodyItalicFraunces" tone="secondary">
            Swap.
          </Text>
        </Pressable>
      </View>
      <Text
        variant="bodyItalicFraunces"
        tone="secondary"
        style={{ marginTop: theme.spacing[1] }}
      >
        {formatPrescription(setCount, repRange)}
      </Text>
      {lastLine ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: theme.spacing[3],
            marginTop: theme.spacing[4],
          }}
        >
          <Text variant="label" tone="secondary">
            LAST
          </Text>
          <Text variant="body" tone="secondary">
            {lastLine}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
