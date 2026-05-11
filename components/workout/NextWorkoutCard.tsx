import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Card, Text, TextButton } from '../primitives';

/**
 * "next" mode renders the routine sitting up next in the rotation —
 * "Push A" + exercise preview + "Start ›". Used on Today and Gym Home.
 *
 * "in-progress" mode replaces the same slot when an orphan workout
 * exists for the user to resume — surfaces an eyebrow ("IN PROGRESS · 18
 * MIN"), the routine name, the current exercise + set position, and a
 * "Resume" affordance that drops the user back where they left off.
 *
 * Only Gym Home renders the in-progress mode in this pass; Today's
 * Next workout peek stays on "next" by design (asymmetry is intentional
 * — Today's slot is a glance, Gym Home is the resume surface).
 */
type NextWorkoutCardProps =
  | {
      mode?: 'next';
      /** Routine name, e.g. "Push A". */
      name: string;
      /** Comma-joined preview of the first few exercises. */
      previewLine: string;
      onStart: () => void;
    }
  | {
      mode: 'in-progress';
      /** Routine name, e.g. "Push A". */
      name: string;
      /** Current exercise the user was on when they abandoned. */
      currentExerciseName: string;
      /** 1-indexed set number to resume at. */
      currentSetNumber: number;
      /**
       * Total prescribed sets for the current exercise. When omitted,
       * the status line renders "set N" without an "of M" suffix.
       */
      totalSetsForExercise?: number;
      /** Minutes since the workout started. Rendered as "{N} MIN". */
      elapsedMinutes: number;
      onResume: () => void;
    };

export function NextWorkoutCard(props: NextWorkoutCardProps) {
  const theme = useTheme();

  if (props.mode === 'in-progress') {
    const {
      name,
      currentExerciseName,
      currentSetNumber,
      totalSetsForExercise,
      elapsedMinutes,
      onResume,
    } = props;
    const eyebrow =
      elapsedMinutes > 0
        ? `IN PROGRESS · ${elapsedMinutes} MIN`
        : 'IN PROGRESS';
    const setPhrase =
      typeof totalSetsForExercise === 'number'
        ? `set ${currentSetNumber} of ${totalSetsForExercise}.`
        : `set ${currentSetNumber}.`;
    return (
      <Card>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing[3],
          }}
        >
          <View style={{ flexShrink: 1, gap: theme.spacing[1] }}>
            <Text variant="label" tone="secondary">
              {eyebrow}
            </Text>
            <Text variant="bodyMedium">{name}</Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {currentExerciseName} · {setPhrase}
            </Text>
          </View>
          <TextButton
            label="Resume"
            onPress={onResume}
            accessibilityLabel={`Resume ${name}`}
          />
        </View>
      </Card>
    );
  }

  const { name, previewLine, onStart } = props;
  return (
    <Card>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing[3],
        }}
      >
        <View style={{ flexShrink: 1, gap: theme.spacing[1] }}>
          <Text variant="bodyMedium">{name}</Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {previewLine}
          </Text>
        </View>
        <TextButton
          label="Start ›"
          onPress={onStart}
          accessibilityLabel={`Start ${name}`}
        />
      </View>
    </Card>
  );
}
