import { View } from 'react-native';
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
};

/**
 * Header block for the current exercise — PDF page 15.
 *
 *   Bench press                  ← Fraunces display
 *   4 × 5–8                      ← Fraunces italic subtitle, tone-secondary
 *   LAST  82.5kg × 6, 6, 5, 4    ← label "LAST" + body summary, both tone-secondary
 *
 * The LAST line is the sole hide-condition: no prior sets → hide.
 * Everything else renders unconditionally.
 */
export function ExerciseHeader({
  name,
  setCount,
  repRange,
  lastSets,
}: ExerciseHeaderProps) {
  const theme = useTheme();
  const lastLine = formatLastSetsLine(lastSets);

  return (
    <View>
      <Text variant="display">{name}</Text>
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
