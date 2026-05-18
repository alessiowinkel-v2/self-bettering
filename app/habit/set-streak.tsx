import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  FilledButton,
  Screen,
  Text,
  TextButton,
} from '../../components/primitives';
import { useHabitsListStore } from '../../state/habitsListStore';
import { useTheme } from '../../theme';
import { toIsoDate } from '../../utils/dateFormat';

/**
 * Set-streak modal. Presented from Habit Detail via the "Set streak"
 * action. The user picks the date a real-world streak began; the store
 * action moves the habit's created_on back and backfills held logs so
 * the streak renders correctly on Today, Habits List, and Habit Detail.
 *
 * Voice: the title "Streak start." is a statement (period). "Set streak"
 * is an action label (no period). The picker is capped at today — a
 * streak cannot have started in the future.
 */
export default function SetStreakModal() {
  const theme = useTheme();
  const router = useRouter();
  // expo-router hands the habit id through as a query param; narrow it
  // exactly as habit/[id].tsx does before it reaches the data layer.
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : null;

  const [selected, setSelected] = useState(() => new Date());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable max bound so the picker prop keeps a single reference.
  const maxDate = useMemo(() => new Date(), []);

  function handlePickerChange(_event: DateTimePickerEvent, date?: Date) {
    if (!date) return;
    setSelected(date);
    if (error !== null) setError(null);
  }

  async function submit() {
    if (id === null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await useHabitsListStore
        .getState()
        .setStreakStart(id, toIsoDate(selected));
      router.back();
    } catch (e) {
      // Voice-aligned fixed copy. Raw error to console for debug.
      // eslint-disable-next-line no-console
      console.warn('[set-streak] failed:', e);
      setError('Could not set streak.');
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing[3],
          }}
        >
          <Text variant="display">Streak start.</Text>
          <TextButton
            label="Cancel"
            tone="secondary"
            onPress={() => router.back()}
            accessibilityLabel="Cancel"
          />
        </View>

        <Text
          variant="body"
          tone="secondary"
          style={{ marginTop: theme.spacing[6] }}
        >
          When did this streak start?
        </Text>

        <View style={{ marginTop: theme.spacing[2] }}>
          <DateTimePicker
            value={selected}
            mode="date"
            display="spinner"
            maximumDate={maxDate}
            onChange={handlePickerChange}
            themeVariant={theme.mode}
            accentColor={theme.colors.accent}
          />
        </View>

        {error !== null ? (
          <Text
            variant="caption"
            tone="tertiary"
            style={{ marginTop: theme.spacing[2] }}
          >
            {error}
          </Text>
        ) : null}

        <View style={{ marginTop: 'auto', paddingBottom: theme.spacing[6] }}>
          <FilledButton
            label="Set streak"
            onPress={submit}
            disabled={submitting || id === null}
            accessibilityLabel="Set streak"
          />
        </View>
      </View>
    </Screen>
  );
}
