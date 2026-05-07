import { todayIso, yesterdayIso } from '../utils/dateFormat';
import type {
  Habit,
  HabitLog,
  JournalEntry,
  WorkoutTemplate,
} from './types';

/**
 * Seed data for Phase 1c. The shapes match what the SQLite data-access
 * layer will return in Phase 2, so the screens consuming these never
 * change when persistence lands.
 *
 * Logs are seeded for yesterday only. Today's logs start empty so the
 * Held/Slipped affordances render on first load (default seed).
 */

export const seedHabits: ReadonlyArray<Habit> = [
  { id: 'h-nicotine', name: 'No nicotine', createdOn: '2026-04-12' },
  { id: 'h-walk', name: 'Walk before noon', createdOn: '2026-04-15' },
  { id: 'h-read', name: 'Read 20 minutes', createdOn: '2026-05-04' },
];

/**
 * Mock streak counts coming into today. Phase-1 mock only: Phase 2 will
 * derive current streak as a pure function over `habit_logs`, not as a
 * denormalized lookup. Pre-computed here so the cards have the right
 * amber number on first load.
 */
export const mockStreaksThroughYesterday: Readonly<Record<string, number>> = {
  'h-nicotine': 24,
  'h-walk': 11,
  'h-read': 3,
};

/**
 * Yesterday's logs. Used to render the Yesterday peek card and to seed
 * the streak counts above. All three were held — that's the canonical
 * "Wednesday, May 6" frame from the design PDF.
 */
export function seedYesterdayLogs(now: Date = new Date()): ReadonlyArray<HabitLog> {
  const date = yesterdayIso(now);
  return [
    { habitId: 'h-nicotine', date, status: 'held' },
    { habitId: 'h-walk', date, status: 'held' },
    { habitId: 'h-read', date, status: 'held' },
  ];
}

/**
 * Yesterday's journal entry. Mood 4, two short tags, two-line body.
 * Matches the Yesterday-card peek on the evening Today frame.
 */
export function seedYesterdayJournal(now: Date = new Date()): JournalEntry {
  return {
    date: yesterdayIso(now),
    mood: 4,
    tags: ['evening', 'walk'],
    body: 'Long walk after dinner. Quiet head for once.',
  };
}

export const seedWorkoutTemplates: ReadonlyArray<WorkoutTemplate> = [
  {
    id: 'wt-push-a',
    name: 'Push A',
    exercises: ['Bench press', 'Incline DB press', 'Triceps pushdown'],
  },
  {
    id: 'wt-pull-a',
    name: 'Pull A',
    exercises: ['Deadlift', 'Pull-up', 'Barbell row'],
  },
];

/**
 * The next routine in the rotation. Today shows this as the bottom card
 * with a text "Start" affordance (per the known-issue note — never filled).
 */
export const seedNextWorkoutTemplateId = 'wt-push-a';

/* --------------------------------- Seed sets ------------------------------- */

/**
 * Named seed set. Each option corresponds to a specific Today shape so the
 * /design dev menu can swap the entire store slice and preview the screen
 * without changing the phone clock or hand-rolling state.
 */
export type SeedName = 'default' | 'first-time' | 'today-is-done';

/**
 * The full slice of state the Today store holds. Returned by `seedFor` so
 * the store can rebuild itself wholesale when the dev menu picks a new seed.
 */
export type TodaySeed = {
  habits: ReadonlyArray<Habit>;
  todayLogs: ReadonlyArray<HabitLog>;
  yesterdayLogs: ReadonlyArray<HabitLog>;
  yesterdayJournal: JournalEntry | null;
  todayJournal: JournalEntry | null;
  mockStreaksThroughYesterday: Readonly<Record<string, number>>;
  workoutTemplates: ReadonlyArray<WorkoutTemplate>;
  nextWorkoutTemplateId: string | null;
  completedWorkoutDate: string | null;
  referenceDate: string;
};

/**
 * Build the full Today-store slice for a given named seed. Pure factory —
 * no I/O, no module-level state. The store calls this on init and again
 * whenever the dev menu picks a different seed.
 */
export function seedFor(name: SeedName, now: Date = new Date()): TodaySeed {
  const referenceDate = todayIso(now);

  if (name === 'first-time') {
    return {
      habits: [],
      todayLogs: [],
      yesterdayLogs: [],
      yesterdayJournal: null,
      todayJournal: null,
      mockStreaksThroughYesterday: {},
      workoutTemplates: [],
      nextWorkoutTemplateId: null,
      completedWorkoutDate: null,
      referenceDate,
    };
  }

  if (name === 'today-is-done') {
    // Same three habits as default, but every habit is held today, the
    // journal has an entry for today, and the next workout has been done.
    // nextWorkoutTemplateId is cleared defensively so the "Next workout"
    // card can't render alongside the takeover.
    const todayLogs: ReadonlyArray<HabitLog> = seedHabits.map((h) => ({
      habitId: h.id,
      date: referenceDate,
      status: 'held',
    }));
    const todayJournal: JournalEntry = {
      date: referenceDate,
      mood: 4,
      tags: ['evening'],
      body: 'Quiet day. Held everything.',
    };
    return {
      habits: seedHabits,
      todayLogs,
      yesterdayLogs: seedYesterdayLogs(now),
      yesterdayJournal: seedYesterdayJournal(now),
      todayJournal,
      mockStreaksThroughYesterday: mockStreaksThroughYesterday,
      workoutTemplates: seedWorkoutTemplates,
      nextWorkoutTemplateId: null,
      completedWorkoutDate: referenceDate,
      referenceDate,
    };
  }

  // 'default' — current behavior. Habits exist, nothing logged today yet,
  // yesterday's journal populated, Push A queued, no workout completed.
  return {
    habits: seedHabits,
    todayLogs: [],
    yesterdayLogs: seedYesterdayLogs(now),
    yesterdayJournal: seedYesterdayJournal(now),
    todayJournal: null,
    mockStreaksThroughYesterday: mockStreaksThroughYesterday,
    workoutTemplates: seedWorkoutTemplates,
    nextWorkoutTemplateId: seedNextWorkoutTemplateId,
    completedWorkoutDate: null,
    referenceDate,
  };
}
