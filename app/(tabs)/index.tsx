import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, View } from 'react-native';
import { Screen, SectionHeader } from '../../components/primitives';
import {
  AllHeldCard,
  BackupReminderCard,
  EmptyToday,
  HabitCard,
  NoJournalYetCard,
  SettingsCog,
  StreaksRow,
  TodayHeader,
  TodayIsDone,
  type StreaksRowItem,
} from '../../components/today';
import { JournalPreviewCard } from '../../components/journal';
import { NextWorkoutCard } from '../../components/workout';
import { useTheme } from '../../theme';
import { useBackupReminderStore } from '../../state/backupReminderStore';
import {
  selectHasJournalToday,
  selectTodayShapeKind,
  useTodayStore,
} from '../../state/todayStore';
import { abbreviateHabitName } from '../../utils/abbreviateHabitName';
import { shouldShowReminder } from '../../utils/backupReminder';
import { todayIso } from '../../utils/dateFormat';
import { runExportFlow } from '../../utils/export';
import { haptics } from '../../utils/haptics';

/**
 * Today screen. Canonical vertical order from the design PDF:
 *   1. Title + date + greeting (always rendered)
 *   2. Body — varies by shape:
 *        'empty'         → "Add your first habit to begin." + filled CTA
 *        'today-is-done' → "Today is done." takeover + Streaks
 *        'default'       → Habit cards (or AllHeld) + Streaks +
 *                          Yesterday slot (JournalPreviewCard | NoJournalYetCard) +
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
        // displayStreak reflects today's status live so the card's
        // number ticks N → N+1 on Held (AnimatedStreakNumber animates
        // the transition) and resets to 0 on Slipped (no animation per
        // spec — the card collapses to SLIPPED anyway). The chips row
        // intentionally reads streakThroughYesterday so it stays put;
        // the chips are a glanceable summary, the card is the surface
        // where the commit happened.
        const displayStreak =
          status === 'held'
            ? streakThroughYesterday + 1
            : status === 'slipped'
              ? 0
              : streakThroughYesterday;
        return { habit, status, streakThroughYesterday, displayStreak };
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
      ? {
          template,
          previewLine: template.exercises
            .slice(0, 3)
            .map((e) => e.name)
            .join(', '),
        }
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

  // Cog routes to /settings. Absolute-positioned inside the Screen's
  // contentContainer so it tracks the top gutter under the safe-area
  // inset without redefining the screen's padding. Rendered alongside
  // each shape's body so the title row stays untouched.
  const cogElement = (
    <View
      style={{
        position: 'absolute',
        top: theme.spacing[3],
        right: 0,
        zIndex: 1,
      }}
    >
      <SettingsCog onPress={() => router.push('/settings')} />
    </View>
  );

  // Backup reminder card. Sits below the TodayHeader (not above) so the
  // "Today." title stays anchored just under the safe-area inset where
  // the cog sits — rendering the card above would push the title down
  // and decouple it from the cog's absolute position. foregroundTick is
  // a no-op subscription that re-renders this component on each
  // background→active transition, letting shouldShowReminder re-evaluate
  // with a fresh `new Date()` without relying on focus-effects alone.
  const lastExportedAt = useBackupReminderStore((s) => s.lastExportedAt);
  const lastSnoozedAt = useBackupReminderStore((s) => s.lastSnoozedAt);
  // foregroundTick is subscribed-but-unused: the re-render IS the
  // signal. Reading the value into a local keeps the subscription
  // legible (vs. an orphan expression statement) and feeds it into
  // useMemo's deps so the reminder visibility re-derives on each
  // background→active transition.
  const foregroundTick = useBackupReminderStore((s) => s.foregroundTick);
  const showBackupReminder = useMemo(
    () => shouldShowReminder(lastExportedAt, lastSnoozedAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastExportedAt, lastSnoozedAt, foregroundTick],
  );

  const onBackupExport = useCallback(async () => {
    try {
      await runExportFlow();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not export.', message);
    }
  }, []);

  const onBackupSnooze = useCallback(() => {
    haptics.light();
    useBackupReminderStore.getState().recordSnooze();
  }, []);

  const reminderElement = showBackupReminder ? (
    <View style={{ marginTop: theme.spacing[5] }}>
      <BackupReminderCard onExport={onBackupExport} onSnooze={onBackupSnooze} />
    </View>
  ) : null;

  if (shapeKind === 'empty') {
    return (
      <Screen>
        {cogElement}
        <TodayHeader />
        {reminderElement}
        <EmptyToday onAddHabit={() => {}} />
      </Screen>
    );
  }

  if (shapeKind === 'today-is-done') {
    return (
      <Screen>
        {cogElement}
        <TodayHeader />
        {reminderElement}
        <TodayIsDone />
        <SectionHeader>Streaks</SectionHeader>
        <StreaksRow items={streakItems} />
      </Screen>
    );
  }

  // 'default'
  return (
    <Screen>
      {cogElement}
      <TodayHeader />
      {reminderElement}

      <View style={{ marginTop: theme.spacing[5], gap: theme.spacing[3] }}>
        {allHeld ? (
          <AllHeldCard />
        ) : (
          habitsWithStatus.map((row) => (
            <HabitCard
              key={row.habit.id}
              name={row.habit.name}
              streak={row.displayStreak}
              status={row.status}
              onHeld={() => {
                haptics.light();
                void logHabit(row.habit.id, 'held');
              }}
              onSlipped={() => {
                haptics.light();
                void logHabit(row.habit.id, 'slipped');
              }}
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
          <JournalPreviewCard
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
            onStart={() =>
              router.push({
                pathname: '/workout',
                params: { templateId: nextWorkout.template.id },
              })
            }
          />
        </>
      ) : null}
    </Screen>
  );
}
