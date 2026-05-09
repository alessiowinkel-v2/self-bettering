import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Card, Text, TextButton } from '../primitives';

type NextWorkoutCardProps = {
  /** Routine name, e.g. "Push A". */
  name: string;
  /** Comma-joined preview of the first few exercises. */
  previewLine: string;
  onStart: () => void;
};

/**
 * Gym Home's "Up next" card. Routine name on top, exercise preview
 * line below, "Start" affordance on the right. Text-only Start —
 * daily/repeat actions never get filled amber per the design system.
 *
 * Kept screen-local rather than shared with Today's NextWorkoutCard:
 * the two surfaces position the card differently (Today: under the
 * Yesterday slot; Gym: as the screen's lead block) and may diverge
 * further in later phases. Sharing now would lock in convergence
 * that hasn't been validated.
 */
export function NextWorkoutCard({ name, previewLine, onStart }: NextWorkoutCardProps) {
  const theme = useTheme();
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
