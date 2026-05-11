import { Pressable, View } from 'react-native';
import { Text } from '../primitives';
import { useTheme } from '../../theme';
import type { ThemeOverride } from '../../theme';

type ThemeChoiceProps = {
  current: ThemeOverride;
  onChange: (next: ThemeOverride) => void;
};

const OPTIONS: ReadonlyArray<{ value: ThemeOverride; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

/**
 * Three-option theme selector. Always-visible row of three tappable
 * labels rather than an expanding picker — the choice space is small
 * enough that hiding the alternatives behind a tap reads as friction.
 *
 * Selected option is amber-tone; the others are tone="secondary" and
 * read as muted alternatives. No fill, no border — keeps with the
 * filled-button rule (theme selection is a settings affordance, not a
 * canonical primary action).
 */
export function ThemeChoice({ current, onChange }: ThemeChoiceProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing[5],
        alignItems: 'center',
      }}
    >
      {OPTIONS.map((opt) => {
        const isSelected = current === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityLabel={`Theme: ${opt.label}`}
            accessibilityState={{ selected: isSelected }}
            hitSlop={8}
          >
            <Text
              variant="bodyMedium"
              tone={isSelected ? 'accent' : 'secondary'}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
