import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  JournalPreviewCard,
  MonthHeader,
} from '../../components/journal';
import {
  Screen,
  Text,
  TextButton,
} from '../../components/primitives';
import { getAllJournalEntries } from '../../db/journal';
import { useTheme } from '../../theme';
import { todayIso } from '../../utils/dateFormat';
import { groupEntriesByMonth } from '../../utils/journalList';
import type { JournalEntry } from '../../state/types';

/**
 * Journal tab — every entry on disk, newest-first, grouped by month.
 *
 * State is screen-local, not store-backed. Two reasons:
 *   1. No cross-screen mutations write journal entries other than the
 *      editor itself, and the editor's save-time `refreshJournalSlice`
 *      already covers the Today surface. Journal List re-hydrates on
 *      every focus, which is the same shape habits uses for the same
 *      reason.
 *   2. The list is a read-only projection — no writes happen here, so
 *      a shared cache buys nothing.
 *
 * Empty state: "No entries yet." with a TextButton "Write something."
 * that routes to today's editor. The button is a quiet text affordance,
 * not a FilledButton — Journal List has no singular primary action
 * (entries pile up over time; the daily write happens via Today).
 *
 * Header omits a "+ Add entry today" link by design: today's entry is
 * always reachable from Today's NoJournalYetCard. Surfacing the same
 * affordance twice would just add noise.
 */
export default function JournalScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [entries, setEntries] = useState<ReadonlyArray<JournalEntry>>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate on every focus. The editor's save runs out of band (debounced),
  // so the only safe time to read the canonical list is "the user just
  // navigated here." Mirrors the habits and gym home patterns.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const rows = await getAllJournalEntries();
          if (cancelled) return;
          setEntries(rows);
          setIsHydrated(true);
        } catch (e) {
          // Silent on failure — a stale list is acceptable. Warn-log so
          // the failure surfaces during dev rather than vanishing.
          // eslint-disable-next-line no-console
          console.warn('[journal-list] hydrate failed:', e);
          if (cancelled) return;
          setIsHydrated(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const groups = useMemo(() => groupEntriesByMonth(entries), [entries]);

  const Title = (
    <View style={{ marginTop: theme.spacing[3], marginBottom: theme.spacing[5] }}>
      <Text variant="display">Journal.</Text>
    </View>
  );

  // Loading: render only the title so the page does not flash an empty
  // state during the first hydrate. Mirrors Habits and Gym.
  if (!isHydrated) {
    return <Screen>{Title}</Screen>;
  }

  if (entries.length === 0) {
    return (
      <Screen>
        {Title}
        <View
          style={{
            marginTop: theme.spacing[7],
            alignItems: 'center',
          }}
        >
          <Text variant="displayItalic" tone="secondary" align="center">
            No entries yet.
          </Text>
          <View style={{ marginTop: theme.spacing[4] }}>
            <TextButton
              label="Write"
              onPress={() => router.push(`/journal/${todayIso()}`)}
              accessibilityLabel="Write today's journal entry"
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {Title}
      {groups.map((group, groupIndex) => (
        <View key={`${group.year}-${group.monthIndex}`}>
          <MonthHeader
            label={group.label}
            marginTop={groupIndex === 0 ? 0 : undefined}
          />
          <View style={{ gap: theme.spacing[3] }}>
            {group.entries.map((entry) => (
              <JournalPreviewCard
                key={entry.date}
                entry={entry}
                onPress={() => router.push(`/journal/${entry.date}`)}
              />
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}
