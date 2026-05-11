import {
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

type TextButtonTone = 'accent' | 'primary' | 'secondary' | 'destructive';

type TextButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * Color tone for the label. Defaults to 'accent' (amber).
   * 'destructive' resolves to theme.colors.destructive (phase 3e wired
   * the token). Reserve destructive for actions that negate data ("Clear
   * all data.", "Turn off.") — not for daily/repeat actions, those stay
   * accent or secondary.
   */
  tone?: TextButtonTone;
  /**
   * Optional explicit accessibility label. Defaults to the visible label.
   */
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * TextButton is the canonical day-to-day affordance — Held/Slipped, Start,
 * Save, Skip, "+ Add habit". Text-only, no fill, no border. Daily and
 * repeat actions must use this, not FilledButton.
 */
export function TextButton({
  label,
  onPress,
  tone = 'accent',
  accessibilityLabel,
  disabled = false,
  style,
}: TextButtonProps) {
  const theme = useTheme();

  const textTone =
    tone === 'destructive'
      ? 'destructive'
      : tone === 'accent'
        ? 'accent'
        : tone === 'secondary'
          ? 'secondary'
          : 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [
        {
          minHeight: theme.touchTarget.minHeight,
          justifyContent: 'center',
          paddingVertical: theme.spacing[2],
        },
        pressed && { opacity: 0.6 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text variant="bodyMedium" tone={textTone}>
        {label}
      </Text>
    </Pressable>
  );
}

type FilledButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * FilledButton — RESERVED USE.
 *
 * Per the design system's filled-button rule, filled amber buttons are
 * only valid in two places:
 *   1. First-time empty-state CTAs (e.g. "Add a habit" on the empty Today)
 *   2. The "Save workout" action at the end of Active Workout
 *
 * Daily, repetitive actions (Held/Slipped, Start, Log, Save journal) must
 * use TextButton instead. If you reach for FilledButton outside the two
 * cases above, you are almost certainly wrong — re-read design-system.md.
 */
export function FilledButton({
  label,
  onPress,
  accessibilityLabel,
  disabled = false,
  style,
}: FilledButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        {
          minHeight: theme.touchTarget.minHeight,
          backgroundColor: theme.colors.accent,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing[5],
          paddingVertical: theme.spacing[3],
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <View>
        <Text variant="bodyMedium" tone="primary" style={{ color: theme.colors.bg }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
