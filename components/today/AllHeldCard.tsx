import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../primitives';

/**
 * "All held today." takeover line that replaces the three habit cards in
 * the evening Today state when every habit is held. Italic Fraunces,
 * centered, generous vertical breathing room. No surface — sits directly
 * on the screen background.
 */
export function AllHeldCard() {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingVertical: theme.spacing[6],
        alignItems: 'center',
      }}
    >
      <Text variant="displayItalic" align="center">
        All held today.
      </Text>
    </View>
  );
}
