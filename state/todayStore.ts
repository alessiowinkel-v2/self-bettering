import { create } from 'zustand';
import { seedFor, type SeedName } from './mockData';
import type {
  Habit,
  HabitLog,
  HabitStatus,
  JournalEntry,
  WorkoutTemplate,
} from './types';

/**
 * Today store — Phase 1c, in-memory only.
 *
 * Holds habits, today's logs, yesterday's logs, the yesterday journal
 * entry, today's journal (if any), workout templates, and a flag for
 * whether today's workout is complete. State persists across navigation
 * but not across cold start — that's Phase 2's job (SQLite).
 *
 * todayLogs is an array of HabitLog rows so the in-memory shape mirrors
 * the Phase 2 `habit_logs` table. Selectors derive an O(1) lookup map
 * when needed; the canonical state stays normalized.
 *
 * Derived data (habitsWithStatus, allHeld, nextWorkout) is computed
 * inline in screens via useMemo. Returning freshly-built objects from
 * selectors triggers useSyncExternalStore's equality guard (Object.is
 * fails on every read, infinite-loop), so this store exposes primitive
 * fields only and lets consumers derive in render.
 */

type TodayStoreState = {
  habits: ReadonlyArray<Habit>;
  /** Today's logs as rows. Mirrors the Phase 2 `habit_logs` table shape. */
  todayLogs: ReadonlyArray<HabitLog>;
  // kept for Phase 2 streak math
  yesterdayLogs: ReadonlyArray<HabitLog>;
  /** Null when there's no entry yet — first-time seed or a fresh day. */
  yesterdayJournal: JournalEntry | null;
  /** Null when today's journal hasn't been written yet. */
  todayJournal: JournalEntry | null;
  // PHASE-2: delete; replace with pure streak math over habit_logs.
  // Pre-computed current streak through yesterday, keyed by habit id.
  // Phase 2 derives current streak as a pure function over the habit_logs
  // table, not as denormalized state.
  mockStreaksThroughYesterday: Readonly<Record<string, number>>;
  workoutTemplates: ReadonlyArray<WorkoutTemplate>;
  nextWorkoutTemplateId: string | null;
  /** ISO date today's workout was completed, or null if not yet done. */
  completedWorkoutDate: string | null;
  /**
   * Reference date the store was seeded with. Used by selectors that need
   * to know "today" without re-reading the system clock on every call.
   */
  referenceDate: string;

  setHabitStatus: (habitId: string, status: HabitStatus) => void;
};

function buildInitialState(
  name: SeedName = 'default',
  now: Date = new Date(),
): Omit<TodayStoreState, 'setHabitStatus'> {
  return seedFor(name, now);
}

export const useTodayStore = create<TodayStoreState>((set) => ({
  ...buildInitialState(),
  setHabitStatus: (habitId, status) =>
    set((s) => {
      const date = s.referenceDate;
      const without = s.todayLogs.filter((l) => l.habitId !== habitId);
      return { todayLogs: [...without, { habitId, date, status }] };
    }),
}));

/* --------------------------------- Selectors ------------------------------- */

/**
 * High-level shape Today should render.
 *   'empty'         — no habits at all (first-time seed). Show only the
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
  const journalForToday =
    s.todayJournal !== null && s.todayJournal.date === s.referenceDate;
  const workoutDoneToday = s.completedWorkoutDate === s.referenceDate;

  if (allHeld && journalForToday && workoutDoneToday) return 'today-is-done';
  return 'default';
}

export function selectHasJournalToday(s: TodayStoreState): boolean {
  return s.todayJournal !== null && s.todayJournal.date === s.referenceDate;
}
