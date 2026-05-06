import { create } from 'zustand';
import { todayIso } from '../utils/dateFormat';
import {
  seedHabits,
  seedNextWorkoutTemplateId,
  seedStreaksThroughYesterday,
  seedWorkoutTemplates,
  seedYesterdayJournal,
  seedYesterdayLogs,
} from './mockData';
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
 * entry, and workout templates. State persists across navigation but not
 * across cold start — that's Phase 2's job (SQLite).
 *
 * todayLogs is an array of HabitLog rows so the in-memory shape mirrors
 * the Phase 2 `habit_logs` table. Selectors derive an O(1) lookup map
 * when needed; the canonical state stays normalized.
 *
 * Actions are intentionally narrow: setHabitStatus is the only mutator
 * the Today screen needs.
 */

type TodayStoreState = {
  habits: ReadonlyArray<Habit>;
  /** Today's logs as rows. Mirrors the Phase 2 `habit_logs` table shape. */
  todayLogs: ReadonlyArray<HabitLog>;
  yesterdayLogs: ReadonlyArray<HabitLog>;
  yesterdayJournal: JournalEntry;
  streaksThroughYesterday: Readonly<Record<string, number>>;
  workoutTemplates: ReadonlyArray<WorkoutTemplate>;
  nextWorkoutTemplateId: string;
  /**
   * Reference date the store was seeded with. Used by selectors that need
   * to know "today" without re-reading the system clock on every call.
   */
  referenceDate: string;

  setHabitStatus: (habitId: string, status: HabitStatus) => void;
  resetHabitStatus: (habitId: string) => void;
};

function buildInitialState(now: Date = new Date()): Omit<
  TodayStoreState,
  'setHabitStatus' | 'resetHabitStatus'
> {
  return {
    habits: seedHabits,
    todayLogs: [],
    yesterdayLogs: seedYesterdayLogs(now),
    yesterdayJournal: seedYesterdayJournal(now),
    streaksThroughYesterday: seedStreaksThroughYesterday,
    workoutTemplates: seedWorkoutTemplates,
    nextWorkoutTemplateId: seedNextWorkoutTemplateId,
    referenceDate: todayIso(now),
  };
}

export const useTodayStore = create<TodayStoreState>((set) => ({
  ...buildInitialState(),
  setHabitStatus: (habitId, status) =>
    set((s) => {
      const date = s.referenceDate;
      const without = s.todayLogs.filter((l) => l.habitId !== habitId);
      return { todayLogs: [...without, { habitId, date, status }] };
    }),
  resetHabitStatus: (habitId) =>
    set((s) => ({
      todayLogs: s.todayLogs.filter((l) => l.habitId !== habitId),
    })),
}));

/* --------------------------------- Selectors ------------------------------- */

/**
 * Build an O(1) lookup map of habitId -> status from the row array.
 * Kept internal to selectors — consumers see status fields, not the map.
 */
function indexLogs(logs: ReadonlyArray<HabitLog>): Map<string, HabitStatus> {
  const m = new Map<string, HabitStatus>();
  for (const l of logs) m.set(l.habitId, l.status);
  return m;
}

export type HabitWithStatus = {
  habit: Habit;
  status: HabitStatus | null;
  /** Streak coming into today (from yesterday). The card adds 1 visually if held today. */
  streakThroughYesterday: number;
  /**
   * Streak as it should display on the card today. If today is held, this is
   * streakThroughYesterday + 1. If slipped, 0. If not yet logged, the
   * yesterday count carries through.
   */
  displayStreak: number;
};

export function selectHabitsWithStatus(s: TodayStoreState): ReadonlyArray<HabitWithStatus> {
  const byId = indexLogs(s.todayLogs);
  return s.habits.map((habit) => {
    const status = byId.get(habit.id) ?? null;
    const base = s.streaksThroughYesterday[habit.id] ?? 0;
    const displayStreak = status === 'held' ? base + 1 : status === 'slipped' ? 0 : base;
    return { habit, status, streakThroughYesterday: base, displayStreak };
  });
}

export function selectAllHeld(s: TodayStoreState): boolean {
  if (s.habits.length === 0) return false;
  const byId = indexLogs(s.todayLogs);
  return s.habits.every((h) => byId.get(h.id) === 'held');
}

export function selectAnyLogged(s: TodayStoreState): boolean {
  return s.todayLogs.length > 0;
}

export type NextWorkoutSummary = {
  template: WorkoutTemplate;
  /** Comma-joined first three exercises for the preview line. */
  previewLine: string;
};

export function selectNextWorkout(s: TodayStoreState): NextWorkoutSummary | null {
  const template = s.workoutTemplates.find((t) => t.id === s.nextWorkoutTemplateId);
  if (!template) return null;
  return {
    template,
    previewLine: template.exercises.slice(0, 3).join(', '),
  };
}
