import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../primitives';
import { formatKg } from '../../utils/workout';
import type { LoggedSet } from '../../state/activeWorkoutStore';

type PreviousExerciseRowProps = {
  name: string;
  sets: ReadonlyArray<LoggedSet>;
};

/**
 * Dim summary row for an already-completed exercise inside the current
 * workout — PDF page 15 ("Incline DB press   20kg · 8, 8, 7") and page 18
 * (four such rows stacked above "Triceps pushdown"). Purely informational,
 * not tappable.
 *
 * Renders nothing when the exercise has zero logged sets. In the normal
 * flow this shouldn't happen — the screen only renders previous-exercise
 * rows for exercises that ran to completion — but the guard keeps the
 * row trivially safe for any future caller.
 */
export function PreviousExerciseRow({ name, sets }: PreviousExerciseRowProps) {
  const theme = useTheme();
  if (sets.length === 0) return null;
  const firstKg = sets[0].kg;
  const kgStr = formatKg(firstKg);
  const repsStr = sets.map((s) => s.reps.toString()).join(', ');
  const summary = kgStr ? `${kgStr}kg · ${repsStr}` : repsStr;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: theme.spacing[4],
        paddingVertical: theme.spacing[3],
      }}
    >
      <Text variant="body" tone="tertiary">
        {name}
      </Text>
      <Text variant="caption" tone="tertiary">
        {summary}
      </Text>
    </View>
  );
}
