import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  JournalPreviewCard,
  MonthHeader,
} from '../../components/journal';
import { NoJournalYetCard } from '../../components/today';
import { Screen, Text } from '../../components/primitives';
import { getAllJournalEntries } from '../../db/journal';
import { useTheme } from '../../theme';
import { todayIso } from '../../utils/dateFormat';
import { groupEntriesByMonth } from '../../utils/journalList';
import type { JournalEntry } from '../../state/types';

/**
 * Journal tab — today's entry pinned at the top, then every past
 * entry newest-first, grouped by month.
 *
 * The "Today" slot always renders: a JournalPreviewCard once today's
 * entry exists, or a "Write today." prompt card before it does.
 * `todayIso()` is read at render time and the list re-hydrates on
 * every focus, so the slot rolls over to the new day on its own — no
 * stored date to go stale.
 *
 * State is screen-local, not store-backed. Two reasons:
 *   1. No cross-screen mutations write journal entries other than the
 *      editor itself, and the editor's save-time `refreshJournalSlice`
 *      already covers the Today surface. Journal re-hydrates on every
 *      focus, the same shape habits and gym use for the same reason.
 *   2. The list is a read-only projection — no writes happen here, so
 *      a shared cache buys nothing.
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

  const today = todayIso();
  const todayEntry = useMemo(
    () => entries.find((e) => e.date === today) ?? null,
    [entries, today],
  );
  // History excludes today so the pinned Today card is not duplicated
  // in the month groups below.
  const groups = useMemo(
    () => groupEntriesByMonth(entries.filter((e) => e.date !== today)),
    [entries, today],
  );

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

  return (
    <Screen>
      {Title}

      <Text
        variant="label"
        tone="secondary"
        style={{ marginBottom: theme.spacing[3] }}
      >
        TODAY
      </Text>
      {todayEntry !== null ? (
        <JournalPreviewCard
          entry={todayEntry}
          onPress={() => router.push(`/journal/${today}`)}
        />
      ) : (
        <NoJournalYetCard
          label="Write today."
          onWrite={() => router.push(`/journal/${today}`)}
        />
      )}

      {groups.map((group) => (
        <View key={`${group.year}-${group.monthIndex}`}>
          <MonthHeader label={group.label} />
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
