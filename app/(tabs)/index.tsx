import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Screen, SectionHeader } from '../../components/primitives';
import {
  AllHeldCard,
  EmptyToday,
  HabitCard,
  NoJournalYetCard,
  StreaksRow,
  TodayHeader,
  TodayIsDone,
  YesterdayCard,
  type StreaksRowItem,
} from '../../components/today';
import { NextWorkoutCard } from '../../components/workout';
import { useTheme } from '../../theme';
import {
  selectHasJournalToday,
  selectTodayShapeKind,
  useTodayStore,
} from '../../state/todayStore';
import { abbreviateHabitName } from '../../utils/abbreviateHabitName';
import { todayIso } from '../../utils/dateFormat';

/**
 * Today screen. Canonical vertical order from the design PDF:
 *   1. Title + date + greeting (always rendered)
 *   2. Body — varies by shape:
 *        'empty'         → "Add your first habit to begin." + filled CTA
 *        'today-is-done' → "Today is done." takeover + Streaks
 *        'default'       → Habit cards (or AllHeld) + Streaks +
 *                          Yesterday slot (YesterdayCard | NoJournalYetCard) +
 *                          Next workout (when queued)
 *
 * Architecture note: derived values (habitsWithStatus, allHeld, nextWorkout)
 * are computed inline via useMemo from primitive store fields. Selectors
 * that returned freshly-built arrays/objects triggered useSyncExternalStore's
 * Object.is equality guard and looped infinitely. Subscribing to primitives
 * and deriving in render is the correct pattern for this store; the minor
 * duplication beats the equality bug.
 *
 * Phase 2b: Held / Slipped writes go through the DB via the store's
 * logHabit action; the store is a hydration cache populated on boot.
 * The streak chip number is the streak as of end-of-yesterday — today's
 * hold or slip does not change it. Visual feedback for today's status is
 * the card collapsing to "HELD" or "SLIPPED", not the number moving.
 */
export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();

  // Refresh today's and yesterday's journal slices on focus so the
  // Yesterday card and No-journal-yet card pick up edits made in the
  // editor — including the unmount-flush path where save resolves
  // after the editor screen has popped. Targeted: this action does
  // NOT re-read habits, logs, streaks, or workouts.
  //
  // The first focus after boot re-reads the same two journal rows
  // hydrate() already loaded into the store. Two redundant SQLite
  // reads on first paint of Today is the price of keeping this
  // unconditional — gating on a "dirty since last focus" flag would
  // entangle the editor and the store. Cheap at single-user scale.
  //
  // Race: if the user navigates back from the editor before the
  // editor's debounced save lands, the focus effect fires
  // immediately and reads stale rows; the editor's unmount-flush
  // then writes the actual data, but no second focus event fires
  // until the next interaction. Today's Yesterday/NoJournalYet card
  // can briefly show the pre-edit state. Any subsequent focus or
  // navigation triggers the next read. Accepted for simplicity.
  useFocusEffect(
    useCallback(() => {
      void useTodayStore.getState().refreshJournalSlice();
    }, []),
  );

  const onOpenHabit = useCallback(
    (habitId: string) => {
      router.push(`/habit/${habitId}`);
    },
    [router]
  );

  // Shape decides the body layout. Two primitive selectors — a single
  // object-returning selector loops under Zustand's Object.is equality.
  const shapeKind = useTodayStore(selectTodayShapeKind);
  const hasJournalToday = useTodayStore(selectHasJournalToday);

  // Select reference-stable slices. Derivation happens in useMemo below so the
  // store's snapshot stays cached — selectors that returned freshly mapped
  // arrays on every read triggered useSyncExternalStore's infinite-loop guard.
  const habits = useTodayStore((s) => s.habits);
  const todayLogs = useTodayStore((s) => s.todayLogs);
  const streaksThroughYesterday = useTodayStore((s) => s.streaksThroughYesterday);
  const yesterdayJournal = useTodayStore((s) => s.yesterdayJournal);
  const workoutTemplates = useTodayStore((s) => s.workoutTemplates);
  const nextWorkoutTemplateId = useTodayStore((s) => s.nextWorkoutTemplateId);
  const logHabit = useTodayStore((s) => s.logHabit);

  // Build an O(1) status lookup once per logs/habits change. The store's
  // canonical shape is HabitLog[] (mirrors the Phase 2 schema); the map
  // is a render-time derivation, not state.
  const todayStatus = useMemo(() => {
    const m = new Map<string, 'held' | 'slipped'>();
    for (const l of todayLogs) m.set(l.habitId, l.status);
    return m;
  }, [todayLogs]);

  const habitsWithStatus = useMemo(
    () =>
      habits.map((habit) => {
        const status = todayStatus.get(habit.id) ?? null;
        const streakThroughYesterday = streaksThroughYesterday[habit.id] ?? 0;
        return { habit, status, streakThroughYesterday };
      }),
    [habits, todayStatus, streaksThroughYesterday],
  );

  const allHeld = useMemo(
    () => habits.length > 0 && habits.every((h) => todayStatus.get(h.id) === 'held'),
    [habits, todayStatus],
  );

  const nextWorkout = useMemo(() => {
    const template = workoutTemplates.find((t) => t.id === nextWorkoutTemplateId);
    return template
      ? { template, previewLine: template.exercises.slice(0, 3).join(', ') }
      : null;
  }, [workoutTemplates, nextWorkoutTemplateId]);

  const streakItems: ReadonlyArray<StreaksRowItem> = useMemo(
    () =>
      habitsWithStatus.map((row) => ({
        habitId: row.habit.id,
        name: abbreviateHabitName(row.habit.name),
        streak: row.streakThroughYesterday,
        active:
          row.status === 'held' || (row.status === null && row.streakThroughYesterday > 0),
      })),
    [habitsWithStatus],
  );

  if (shapeKind === 'empty') {
    return (
      <Screen>
        <TodayHeader />
        <EmptyToday onAddHabit={() => {}} />
      </Screen>
    );
  }

  if (shapeKind === 'today-is-done') {
    return (
      <Screen>
        <TodayHeader />
        <TodayIsDone />
        <SectionHeader>Streaks</SectionHeader>
        <StreaksRow items={streakItems} />
      </Screen>
    );
  }

  // 'default'
  return (
    <Screen>
      <TodayHeader />

      <View style={{ marginTop: theme.spacing[5], gap: theme.spacing[3] }}>
        {allHeld ? (
          <AllHeldCard />
        ) : (
          habitsWithStatus.map((row) => (
            <HabitCard
              key={row.habit.id}
              name={row.habit.name}
              streak={row.streakThroughYesterday}
              status={row.status}
              onHeld={() => logHabit(row.habit.id, 'held')}
              onSlipped={() => logHabit(row.habit.id, 'slipped')}
              onPress={() => onOpenHabit(row.habit.id)}
            />
          ))
        )}
      </View>

      <SectionHeader>Streaks</SectionHeader>
      <StreaksRow items={streakItems} />

      {yesterdayJournal !== null ? (
        <>
          <SectionHeader>Yesterday</SectionHeader>
          <YesterdayCard
            entry={yesterdayJournal}
            onPress={() => router.push(`/journal/${yesterdayJournal.date}`)}
          />
        </>
      ) : !hasJournalToday ? (
        <NoJournalYetCard onWrite={() => router.push(`/journal/${todayIso()}`)} />
      ) : null}

      {nextWorkout ? (
        <>
          <SectionHeader>Next workout</SectionHeader>
          <NextWorkoutCard
            name={nextWorkout.template.name}
            previewLine={nextWorkout.previewLine}
            onStart={() => {}}
          />
        </>
      ) : null}
    </Screen>
  );
}
