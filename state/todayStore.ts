import { create } from 'zustand';
import {
  getLogsForDate,
  getStreakForHabit,
  logHabit as dbLogHabit,
} from '../db/habitLogs';
import { getActiveHabits } from '../db/habits';
import { getJournalEntryForDate } from '../db/journal';
import {
  getMostRecentCompletedWorkoutDate,
  getNextWorkoutTemplate,
  getWorkoutTemplates,
} from '../db/workouts';
import { todayIso, yesterdayIso } from '../utils/dateFormat';
import type {
  Habit,
  HabitLog,
  HabitStatus,
  JournalEntry,
  WorkoutTemplate,
} from './types';

/**
 * Today store — a hydration cache over the SQLite layer.
 *
 * The DB is the source of truth. On boot, `hydrate()` reads the rows the
 * Today screen needs and populates this slice in one pass; selectors then
 * read from memory so render is cheap. Mutations write through to the DB
 * first, then mirror the change into memory.
 *
 * todayLogs is an array of HabitLog rows so the in-memory shape mirrors
 * the `habit_logs` table. Selectors derive an O(1) lookup map when needed;
 * the canonical state stays normalized.
 *
 * Derived data (habitsWithStatus, allHeld, nextWorkout) is computed
 * inline in screens via useMemo. Returning freshly-built objects from
 * selectors triggers useSyncExternalStore's equality guard (Object.is
 * fails on every read, infinite-loop), so this store exposes primitive
 * fields only and lets consumers derive in render.
 */

type TodayStoreState = {
  habits: ReadonlyArray<Habit>;
  /** Today's logs as rows. Mirrors the `habit_logs` table shape. */
  todayLogs: ReadonlyArray<HabitLog>;
  /** Yesterday's logs. Read on hydrate so the Yesterday card can render. */
  yesterdayLogs: ReadonlyArray<HabitLog>;
  /** Null when there's no entry yet — first-time state or a fresh day. */
  yesterdayJournal: JournalEntry | null;
  /** Null when today's journal hasn't been written yet. */
  todayJournal: JournalEntry | null;
  /**
   * Current streak per active habit, evaluated at end-of-yesterday. Filled
   * by hydrate from `getStreakForHabit({ throughDate: yesterday })`. Today's
   * Held/Slipped taps do not change yesterday's value, so this map is not
   * recomputed on logHabit.
   */
  streaksThroughYesterday: Readonly<Record<string, number>>;
  workoutTemplates: ReadonlyArray<WorkoutTemplate>;
  nextWorkoutTemplateId: string | null;
  /** ISO date today's workout was completed, or null if not yet done. */
  completedWorkoutDate: string | null;
  /**
   * Reference date the store was hydrated against. Selectors read this
   * instead of re-reading the system clock on every call. Overwritten on
   * every hydrate; the initial value just keeps types honest before first
   * hydrate.
   */
  referenceDate: string;

  logHabit: (habitId: string, status: HabitStatus) => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useTodayStore = create<TodayStoreState>((set) => ({
  habits: [],
  todayLogs: [],
  yesterdayLogs: [],
  todayJournal: null,
  yesterdayJournal: null,
  streaksThroughYesterday: {},
  workoutTemplates: [],
  nextWorkoutTemplateId: null,
  completedWorkoutDate: null,
  referenceDate: todayIso(),

  // Single-writer assumption: the user is the only writer
  // and double-taps under ~10ms are not realistic. If a
  // future phase introduces concurrent mutations (background
  // sync, multi-touch gestures), revisit for in-flight
  // guards.
  logHabit: async (habitId, status) => {
    const date = useTodayStore.getState().referenceDate;
    await dbLogHabit({ habitId, date, status });
    set((s) => {
      const without = s.todayLogs.filter((l) => l.habitId !== habitId);
      return { todayLogs: [...without, { habitId, date, status }] };
    });
  },

  hydrate: async () => {
    const now = new Date();
    const today = todayIso(now);
    const yesterday = yesterdayIso(now);

    const [
      habits,
      todayLogs,
      yesterdayLogs,
      todayJournal,
      yesterdayJournal,
      workoutTemplates,
      mostRecentCompletedDate,
      nextTemplate,
    ] = await Promise.all([
      getActiveHabits(),
      getLogsForDate(today),
      getLogsForDate(yesterday),
      getJournalEntryForDate(today),
      getJournalEntryForDate(yesterday),
      getWorkoutTemplates(),
      getMostRecentCompletedWorkoutDate(),
      getNextWorkoutTemplate(),
    ]);

    // Streak map: per-active-habit, as of end-of-yesterday. Promise.all
    // because the JS overhead per habit grows with habit count even though
    // expo-sqlite serializes the actual queries under the hood.
    const streakValues = await Promise.all(
      habits.map((h) =>
        getStreakForHabit({ habitId: h.id, throughDate: yesterday })
      )
    );
    const streaksThroughYesterday: Record<string, number> = {};
    habits.forEach((h, i) => {
      streaksThroughYesterday[h.id] = streakValues[i];
    });

    const completedWorkoutDate =
      mostRecentCompletedDate === today ? today : null;
    const nextWorkoutTemplateId =
      completedWorkoutDate !== null ? null : nextTemplate?.id ?? null;

    set({
      habits,
      todayLogs,
      yesterdayLogs,
      todayJournal,
      yesterdayJournal,
      workoutTemplates,
      nextWorkoutTemplateId,
      completedWorkoutDate,
      streaksThroughYesterday,
      referenceDate: today,
    });
  },
}));

/* --------------------------------- Selectors ------------------------------- */

/**
 * High-level shape Today should render.
 *   'empty'         — no habits at all (first-time state). Show only the
 *                     "Add a habit" CTA.
 *   'today-is-done' — every habit held, today's journal written, today's
 *                     workout complete. Show the takeover line + Streaks.
 *   'default'       — the normal three-cards-or-AllHeld layout.
 *
 * Returns a primitive string so each subscription is reference-stable
 * under Zustand's default Object.is equality. Object-returning selectors
 * trigger an infinite re-render in useSyncExternalStore.
 */
export type TodayShapeKind = 'empty' | 'today-is-done' | 'default';

export function selectTodayShapeKind(s: TodayStoreState): TodayShapeKind {
  if (s.habits.length === 0) return 'empty';

  // Builds a fresh Map per snapshot read. Cheap at current scale (single-digit
  // habits, single-digit logs); revisit if log volume grows or many components
  // subscribe to this selector.
  const byId = new Map<string, HabitStatus>();
  for (const l of s.todayLogs) byId.set(l.habitId, l.status);
  const allHeld = s.habits.every((h) => byId.get(h.id) === 'held');
  const workoutDoneToday = s.completedWorkoutDate === s.referenceDate;

  if (allHeld && selectHasJournalToday(s) && workoutDoneToday) {
    return 'today-is-done';
  }
  return 'default';
}

export function selectHasJournalToday(s: TodayStoreState): boolean {
  return s.todayJournal !== null && s.todayJournal.date === s.referenceDate;
}
