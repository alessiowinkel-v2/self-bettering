import { Settings } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useTheme } from '../../theme';

type SettingsCogProps = {
  onPress: () => void;
};

/**
 * Cog icon top-right of Today. Routes to /settings. Sits absolutely
 * positioned inside Today's content container so it tracks the top
 * gutter without redefining the screen's safe-area inset.
 *
 * Lucide's Settings glyph is imported individually (per project
 * convention) so the bundler tree-shakes the rest of the icon set.
 * Stroke width 1.5 reads quieter than the default 2, in line with
 * the design system's "amber means something — everything else
 * stays neutral" rule.
 */
export function SettingsCog({ onPress }: SettingsCogProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      hitSlop={12}
      style={({ pressed }) => [
        {
          padding: theme.spacing[2],
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Settings
        size={22}
        color={theme.colors.textSecondary}
        strokeWidth={1.5}
      />
    </Pressable>
  );
}
