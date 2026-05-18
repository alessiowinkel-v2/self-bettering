import { Minus, Plus } from 'lucide-react-native';
import { View } from 'react-native';
// Pressable from gesture-handler, NOT react-native: this stepper renders
// inside gesture-handler <Pressable> rows (the routine editor's
// long-press-to-reorder rows). A plain RN Pressable nested there never
// receives the tap — the gesture-handler parent claims the touch.
import { Pressable } from 'react-native-gesture-handler';
import { useTheme } from '../../theme';
import { Text } from './Text';

/**
 * A `−` / value / `+` stepper. The value itself is passed pre-formatted
 * as a string so the same control serves an integer count ("3") and a
 * duration ("1:30" / "Default"). Used by the routine editor's set-count
 * and per-exercise rest controls and by the Settings default-rest row,
 * so the three stay visually identical.
 *
 * Stateless: the caller owns the value and clamps in its handlers; the
 * stepper only reports intent via onDecrement / onIncrement and dims a
 * button when the caller says the bound is reached.
 */

type StepperButtonProps = {
  icon: 'plus' | 'minus';
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
};

function StepperButton({
  icon,
  onPress,
  disabled,
  accessibilityLabel,
}: StepperButtonProps) {
  const theme = useTheme();
  const Icon = icon === 'plus' ? Plus : Minus;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          width: 32,
          height: 32,
          borderRadius: theme.radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface,
        },
        pressed && !disabled && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Icon size={16} color={theme.colors.textPrimary} strokeWidth={1.75} />
    </Pressable>
  );
}

export type StepperProps = {
  /** The value, already formatted for display (e.g. "3" or "1:30"). */
  display: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
  /** Trailing caption, e.g. "sets". Omit for none. */
  label?: string;
  decrementAccessibilityLabel: string;
  incrementAccessibilityLabel: string;
  /** Min width of the value slot so the row doesn't jitter as it changes. */
  valueMinWidth?: number;
};

export function Stepper({
  display,
  onDecrement,
  onIncrement,
  decrementDisabled = false,
  incrementDisabled = false,
  label,
  decrementAccessibilityLabel,
  incrementAccessibilityLabel,
  valueMinWidth = 16,
}: StepperProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
      }}
    >
      <StepperButton
        icon="minus"
        onPress={onDecrement}
        disabled={decrementDisabled}
        accessibilityLabel={decrementAccessibilityLabel}
      />
      <Text
        variant="bodyMedium"
        style={{
          minWidth: valueMinWidth,
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
        }}
      >
        {display}
      </Text>
      <StepperButton
        icon="plus"
        onPress={onIncrement}
        disabled={incrementDisabled}
        accessibilityLabel={incrementAccessibilityLabel}
      />
      {label ? (
        <Text
          variant="caption"
          tone="tertiary"
          style={{ marginLeft: theme.spacing[1] }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
