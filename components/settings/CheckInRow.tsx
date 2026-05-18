import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { ListRow, Text, TextButton } from '../primitives';
import { useTheme } from '../../theme';

type CheckInRowProps = {
  /** Zero-based row index within the parent ListGroup. */
  index: number;
  title: string;
  /** "HH:mm" or null when off. */
  value: string | null;
  onChange: (next: string | null) => void;
  accessibilityLabel: string;
};

/**
 * Parse a "HH:mm" value into a Date the spinner can seed from. Falls
 * back to 08:00 when off, so the picker doesn't open at midnight
 * (jarring for a "morning check-in"). The Date is a throwaway carrier
 * — only its hour/minute matter; onChange re-encodes back to "HH:mm".
 */
function seedFrom(value: string | null): Date {
  const d = new Date();
  if (value !== null) {
    const [h, m] = value.split(':').map((n) => Number.parseInt(n, 10));
    if (Number.isFinite(h) && Number.isFinite(m)) {
      d.setHours(h, m, 0, 0);
      return d;
    }
  }
  d.setHours(8, 0, 0, 0);
  return d;
}

/**
 * A reminder row. Right slot shows either the current "HH:mm" or a
 * muted "Off" caption — tapping the row expands an inline time picker
 * below. Used by Settings (the two app-wide check-ins) and by Habit
 * Detail (a single habit's daily reminder); it is a generic time-or-off
 * row and holds no notification logic of its own — the caller's
 * onChange owns scheduling.
 *
 * Picker ownership: the spinner is driven by local `pickerDate` state,
 * NOT by the `value` prop. It is seeded from `value` each time the row
 * expands and thereafter only moves from the user's own scrolling.
 * Feeding the controlled `value` prop back on every onChange tick made
 * the native spinner re-seed mid-scroll and snap — so the parent's
 * `value` is an output of this row, never an input to the live picker.
 *
 * Off-UX (Phase 3e Note C):
 *   - Currently off (null): tap to expand picker. The first time value
 *     entered turns the reminder on. The picker itself is the enabler;
 *     there is no "On" toggle anywhere.
 *   - Currently on (HH:mm): tap to expand picker showing the current
 *     value. Inside the expanded slot, a right-aligned "Turn off."
 *     TextButton (tone="secondary") clears the value and collapses
 *     the row.
 *
 * "Off" lives only as a display value on the row's right slot — never
 * as a TextButton at the same level as the time. The expansion
 * picker carries the negation control.
 */
export function CheckInRow({
  index,
  title,
  value,
  onChange,
  accessibilityLabel,
}: CheckInRowProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  // The spinner's live value. Seeded on expand (below), then owned by
  // the user — parent re-renders never touch it.
  const [pickerDate, setPickerDate] = useState<Date>(() => seedFrom(value));

  const handlePickerChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (!date) return;
      setPickerDate(date);
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      onChange(`${hh}:${mm}`);
    },
    [onChange],
  );

  const turnOff = useCallback(() => {
    onChange(null);
    setExpanded(false);
  }, [onChange]);

  // Re-seed the spinner from the current value on each expand so a
  // reopened row reflects the latest stored time.
  const onToggle = useCallback(() => {
    if (!expanded) setPickerDate(seedFrom(value));
    setExpanded((p) => !p);
  }, [expanded, value]);

  const right = (
    <Text variant="body" tone="secondary">
      {value === null ? 'Off' : value}
    </Text>
  );

  // iOS inline spinner is the canonical UX for this app (single-platform
  // via Expo Go on the owner's iPhone).
  const below = expanded ? (
    <View>
      <DateTimePicker
        value={pickerDate}
        mode="time"
        is24Hour
        display="spinner"
        onChange={handlePickerChange}
        themeVariant={theme.mode}
        accentColor={theme.colors.accent}
      />
      {value !== null ? (
        <View style={{ alignItems: 'flex-end' }}>
          <TextButton
            label="Turn off"
            onPress={turnOff}
            tone="secondary"
            accessibilityLabel={`Turn off ${title.toLowerCase()}`}
          />
        </View>
      ) : null}
    </View>
  ) : undefined;

  return (
    <ListRow
      index={index}
      left={<Text variant="body">{title}</Text>}
      right={right}
      below={below}
      onPress={onToggle}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
