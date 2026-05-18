import { StyleSheet, View } from 'react-native';
import { Text } from '../primitives';
import { useTheme } from '../../theme';

/**
 * The "PR" pill — a small hairline-outlined chip with Fraunces italic
 * "PR" in accent. Renders inline beside a session's top-set weight when
 * that session set a top-set record.
 *
 * No "Personal Record" copy anywhere — the pill alone carries it, per
 * the Exercise History voice rules.
 */
export function PrPill() {
  const theme = useTheme();
  return (
    <View
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.accent,
        borderRadius: theme.radii.pill,
        paddingHorizontal: theme.spacing[2],
        paddingVertical: 1,
      }}
    >
      <Text
        variant="bodyItalicFraunces"
        tone="accent"
        style={{ fontSize: 11, lineHeight: 15 }}
      >
        PR
      </Text>
    </View>
  );
}
