import { useMemo } from 'react';
import { View } from 'react-native';
import { Screen, SectionHeader } from '../../components/primitives';
import {
  AllHeldCard,
  HabitCard,
  NextWorkoutCard,
  StreaksRow,
  TodayHeader,
  YesterdayCard,
  type StreaksRowItem,
} from '../../components/today';
import { useTheme } from '../../theme';
import { useTodayStore } from '../../state/todayStore';

/**
 * Today screen. Canonical vertical order from the design PDF:
 *   1. Title + date + greeting
 *   2. Habit cards (or "All held today." takeover when every habit is held)
 *   3. Streaks chip row
 *   4. Yesterday peek card
 *   5. Next workout card
 *
 * Phase 1c: mock data only. Tapping Held / Slipped writes to the in-memory
 * store and survives navigation. Tapping the Yesterday card or Start on the
 * Next workout card no-ops for now — the routes wire up in 1d / Phase 2.
 */
export default function TodayScreen() {
  const theme = useTheme();

  // Select reference-stable slices. Derivation happens in useMemo below so the
  // store's snapshot stays cached — selectors that returned freshly mapped
  // arrays on every read triggered useSyncExternalStore's infinite-loop guard.
  const habits = useTodayStore((s) => s.habits);
  const todayLogs = useTodayStore((s) => s.todayLogs);
  const streaksThroughYesterday = useTodayStore((s) => s.streaksThroughYesterday);
  const yesterdayJournal = useTodayStore((s) => s.yesterdayJournal);
  const workoutTemplates = useTodayStore((s) => s.workoutTemplates);
  const nextWorkoutTemplateId = useTodayStore((s) => s.nextWorkoutTemplateId);
  const setHabitStatus = useTodayStore((s) => s.setHabitStatus);

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
        const base = streaksThroughYesterday[habit.id] ?? 0;
        const displayStreak =
          status === 'held' ? base + 1 : status === 'slipped' ? 0 : base;
        return { habit, status, streakThroughYesterday: base, displayStreak };
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
        name: row.habit.name,
        streak: row.displayStreak,
        active:
          row.status === 'held' || (row.status === null && row.streakThroughYesterday > 0),
      })),
    [habitsWithStatus],
  );

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
              displayStreak={row.displayStreak}
              status={row.status}
              onHeld={() => setHabitStatus(row.habit.id, 'held')}
              onSlipped={() => setHabitStatus(row.habit.id, 'slipped')}
            />
          ))
        )}
      </View>

      <SectionHeader>Streaks</SectionHeader>
      <StreaksRow items={streakItems} />

      <SectionHeader>Yesterday</SectionHeader>
      <YesterdayCard entry={yesterdayJournal} onPress={() => {}} />

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
