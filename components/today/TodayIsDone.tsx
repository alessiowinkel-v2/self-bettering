import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../primitives';

/**
 * "Today is done." takeover line. Replaces the habit cards (and the
 * Yesterday + Next workout slots) when every habit is held, today's
 * journal is written, and today's workout is complete.
 *
 * Mirrors AllHeldCard exactly — italic Fraunces, centered, generous
 * vertical breathing room. No surface — sits directly on the screen
 * background.
 */
export function TodayIsDone() {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingVertical: theme.spacing[6],
        alignItems: 'center',
      }}
    >
      <Text variant="displayItalic" align="center">
        Today is done.
      </Text>
    </View>
  );
}
