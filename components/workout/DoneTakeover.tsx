import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text, TextButton } from '../primitives';
import { formatDurationMinutes } from '../../utils/workout';

type DoneTakeoverProps = {
  durationSeconds: number;
  onSave: () => void;
};

/**
 * Full-screen end-of-workout takeover — PDF page 19.
 *
 *                          Done. 47 minutes.
 *
 *                            Save workout
 *
 * Centered Fraunces italic, amber TextButton below. No stats, no
 * celebration, no back chevron. The only exit is Save.
 *
 * "Save workout" is intentionally a TextButton, not a FilledButton —
 * design-system.md mentions "Save workout link" in the filled-button
 * rule, but the PDF renders it as a quiet amber link. The "link" in
 * the design system wording was doing real work.
 *
 * Minute formatting: 1 minute (not "1 minutes"). Workouts under 60s
 * round up to "1 minute" — "0 minutes" reads as a bug.
 */
export function DoneTakeover({ durationSeconds, onSave }: DoneTakeoverProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing[5],
      }}
    >
      <Text variant="displayItalic" align="center">
        Done. {formatDurationMinutes(durationSeconds)}.
      </Text>
      <View style={{ marginTop: theme.spacing[5] }}>
        <TextButton
          label="Save workout"
          onPress={onSave}
          accessibilityLabel="Save workout"
        />
      </View>
    </View>
  );
}
