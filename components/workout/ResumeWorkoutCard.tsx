import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Card, Text, TextButton } from '../primitives';

/**
 * Resume card for the Gym tab. Renders when an orphan workout exists —
 * a workout the user started and left mid-session. Surfaces an eyebrow
 * ("IN PROGRESS · 18 MIN"), the workout name, the current exercise +
 * set position, and a "Resume" affordance that drops the user back
 * where they left off.
 */
type ResumeWorkoutCardProps = {
  /** Workout name, e.g. "Push A". */
  name: string;
  /** Current exercise the user was on when they abandoned. */
  currentExerciseName: string;
  /** 1-indexed set number to resume at. */
  currentSetNumber: number;
  /**
   * Total prescribed sets for the current exercise. When omitted, the
   * status line renders "set N" without an "of M" suffix.
   */
  totalSetsForExercise?: number;
  /** Minutes since the workout started. Rendered as "{N} MIN". */
  elapsedMinutes: number;
  onResume: () => void;
};

export function ResumeWorkoutCard({
  name,
  currentExerciseName,
  currentSetNumber,
  totalSetsForExercise,
  elapsedMinutes,
  onResume,
}: ResumeWorkoutCardProps) {
  const theme = useTheme();

  const eyebrow =
    elapsedMinutes > 0 ? `IN PROGRESS · ${elapsedMinutes} MIN` : 'IN PROGRESS';
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
