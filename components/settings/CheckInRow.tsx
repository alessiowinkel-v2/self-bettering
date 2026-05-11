import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useMemo, useState } from 'react';
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
 * One reminder row on Settings. Right slot shows either the current
 * "HH:mm" or a muted "Off" caption — tapping the row expands an inline
 * time picker below.
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
 *
 * Phase 4 will own actual notification scheduling against these values;
 * Phase 3e is configuration-only.
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

  // Picker seed: parse "HH:mm" into a Date at today's date. Falls back
  // to 08:00 when the row is currently off so the spinner doesn't open
  // at midnight (jarring for a "morning check-in"). The Date here is a
  // throwaway carrier — only its hour/minute matter, and onChange
  // re-encodes back to "HH:mm".
  const seedDate = useMemo(() => {
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
  }, [value]);

  const handlePickerChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      if (!date) return;
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
        value={seedDate}
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
            label="Turn off."
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
      onPress={() => setExpanded((p) => !p)}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
