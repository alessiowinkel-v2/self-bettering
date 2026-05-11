import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Delete } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Text, TextButton } from '../primitives';
import { formatKg } from '../../utils/workout';

export type NumericPadMode = 'kg' | 'reps';

type NumericPadProps = {
  /** Pre-fills the display when the pad opens. null = empty. */
  initialValue: number | null;
  mode: NumericPadMode;
  /**
   * Most-recent prior value for this field. Renders the "last · 82.5"
   * pill at the top-right of the pad. null = hide pill (first-ever
   * exercise).
   */
  lastValue: number | null;
  /** Tap pad's Log to commit the entered value back to the row. */
  onLog: (value: number) => void;
};

/**
 * Custom in-app numeric pad — PDF page 17. Covers the lower half of
 * the screen. Three-column digit grid plus a Log column on the right.
 *
 * Decimal key is dimmed and unresponsive in 'reps' mode (sets.reps
 * is INTEGER in the schema). It still occupies its grid slot so the
 * pad layout doesn't reflow — visual stability over key density.
 *
 * Dismissal: the parent screen renders a transparent backdrop above
 * the pad and intercepts taps there. The pad itself has no close
 * button — PDF page 17 shows none. Tap-outside-to-dismiss is the
 * canonical path; pad's Log commits the value and the parent
 * dismisses on the callback.
 *
 * Display strategy: the pad maintains its own string buffer (not a
 * number) so leading zeros, lone decimals, and partial entries
 * survive intermediate keystrokes. We parse to a number only when
 * Log fires.
 */
export function NumericPad({
  initialValue,
  mode,
  lastValue,
  onLog,
}: NumericPadProps) {
  const theme = useTheme();
  // Seed the buffer with the formatted value if there is one. Empty
  // string keeps "" so the user can type fresh without backspacing
  // through the placeholder — but if they leave it empty and tap Log,
  // we treat that as "use the displayed value as-is" (which equals
  // the initial value) so single-tap-to-confirm still works.
  const [buffer, setBuffer] = useState<string>(() => {
    if (initialValue === null) return '';
    return mode === 'kg'
      ? (formatKg(initialValue) ?? '')
      : initialValue.toString();
  });

  const appendDigit = useCallback((d: string) => {
    setBuffer((b) => {
      // Prevent leading-zero garbage: typing "0" then "5" becomes "5",
      // not "05". Leading single "0" only sticks if the next key is "."
      if (b === '0' && d !== '.') return d;
      return b + d;
    });
  }, []);

  const appendDecimal = useCallback(() => {
    if (mode === 'reps') return;
    setBuffer((b) => {
      if (b.includes('.')) return b;
      if (b.length === 0) return '0.';
      return b + '.';
    });
  }, [mode]);

  const backspace = useCallback(() => {
    setBuffer((b) => b.slice(0, -1));
  }, []);

  const commit = useCallback(() => {
    // Empty buffer + non-null initial → commit the initial value
    // (single-tap-confirm path). Empty buffer + null initial → no-op.
    if (buffer.length === 0) {
      if (initialValue !== null) onLog(initialValue);
      return;
    }
    const parsed = mode === 'kg' ? parseFloat(buffer) : parseInt(buffer, 10);
    if (Number.isNaN(parsed)) return;
    onLog(parsed);
  }, [buffer, initialValue, mode, onLog]);

  const decimalDisabled = mode === 'reps';

  const displayValue = buffer.length > 0 ? buffer : ((initialValue !== null
    ? (mode === 'kg' ? formatKg(initialValue) : initialValue.toString())
    : ''));

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[4],
        paddingBottom: theme.spacing[6],
      }}
    >
      {/* Top row: big display + last pill */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing[4],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing[2] }}>
          <Text variant="display">{displayValue || ' '}</Text>
          <Text variant="caption" tone="tertiary">
            {mode === 'kg' ? 'kg' : 'reps'}
          </Text>
        </View>
        {lastValue !== null ? (
          <View
            style={{
              backgroundColor: theme.colors.surfaceElev,
              borderRadius: theme.radii.pill,
              paddingHorizontal: theme.spacing[3],
              paddingVertical: theme.spacing[1],
            }}
          >
            <Text variant="caption" tone="secondary">
              last · {mode === 'kg' ? formatKg(lastValue) : lastValue.toString()}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Grid: 4 rows × 4 cols. Right column carries the Log button on
          row 1; rows 2–4 of the right column are empty. */}
      <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
        {/* Digits column block — 3 cols × 4 rows */}
        <View style={{ flex: 3, gap: theme.spacing[2] }}>
          <PadRow>
            <KeyButton label="1" onPress={() => appendDigit('1')} />
            <KeyButton label="2" onPress={() => appendDigit('2')} />
            <KeyButton label="3" onPress={() => appendDigit('3')} />
          </PadRow>
          <PadRow>
            <KeyButton label="4" onPress={() => appendDigit('4')} />
            <KeyButton label="5" onPress={() => appendDigit('5')} />
            <KeyButton label="6" onPress={() => appendDigit('6')} />
          </PadRow>
          <PadRow>
            <KeyButton label="7" onPress={() => appendDigit('7')} />
            <KeyButton label="8" onPress={() => appendDigit('8')} />
            <KeyButton label="9" onPress={() => appendDigit('9')} />
          </PadRow>
          <PadRow>
            <KeyButton
              label="."
              onPress={appendDecimal}
              disabled={decimalDisabled}
            />
            <KeyButton label="0" onPress={() => appendDigit('0')} />
            <KeyButton label="" onPress={backspace} icon="backspace" />
          </PadRow>
        </View>
        {/* Log column — 1 col × 4 rows, but Log only fills the top row.
            Text-amber Log (TextButton tone='accent') matches the
            Held/Slipped pattern: daily/repeat actions never use
            FilledButton. The filled-button rule reserves filled amber
            for first-time empty-state CTAs only. The Log key here is
            visually weighted via the column's wider footprint and the
            amber tone, not via a fill. */}
        <View
          style={{
            flex: 1,
            minHeight: 56,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextButton
            label="Log"
            onPress={commit}
            accessibilityLabel={`Log ${mode}`}
          />
        </View>
      </View>
    </View>
  );
}

function PadRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>{children}</View>
  );
}

type KeyButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: 'backspace';
};

function KeyButton({ label, onPress, disabled, icon }: KeyButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={icon === 'backspace' ? 'Backspace' : label}
      style={({ pressed }) => [
        {
          flex: 1,
          minHeight: 56,
          backgroundColor: theme.colors.surfaceElev,
          borderRadius: theme.radii.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && !disabled && { opacity: 0.7 },
        disabled && { opacity: 0.3 },
      ]}
    >
      {icon === 'backspace' ? (
        <Delete size={20} color={theme.colors.textPrimary} strokeWidth={1.5} />
      ) : (
        <Text variant="bodyMedium">{label}</Text>
      )}
    </Pressable>
  );
}
