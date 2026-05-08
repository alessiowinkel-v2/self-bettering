import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../primitives';

/**
 * The two prompt lines shown in the journal editor when the body is
 * empty. Fraunces italic at body size (16/22), tone tertiary. They
 * disappear once the user types — they are not the input's
 * placeholder, they're sibling Text nodes the screen conditionally
 * renders.
 */
export function JournalPrompts() {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[3] }}>
      <Text variant="bodyItalicFraunces" tone="tertiary">
        What did you avoid today, and why.
      </Text>
      <Text variant="bodyItalicFraunces" tone="tertiary">
        What happened today.
      </Text>
    </View>
  );
}
