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
 * "Up next" card — used on Today (under Yesterday) and Gym Home (as
 * the screen's lead block). Routine name on top, exercise preview line
 * below, "Start ›" affordance on the right. Text-only Start, never
 * filled — daily/repeat actions never get filled amber per the design
 * system rule. The chevron carries the navigation signal into the
 * Active Workout flow.
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
