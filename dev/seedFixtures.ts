import { todayIso, yesterdayIso } from '../utils/dateFormat';
import type {
  Habit,
  HabitLog,
  JournalEntry,
  WorkoutTemplate,
} from '../state/types';

/**
 * Seed fixtures for dev mode. Inputs to db/seedDev, which wipes the
 * domain tables and re-inserts these rows. The shapes match the
 * domain types in state/types.ts.
 */

export const seedHabits: ReadonlyArray<Habit> = [
  { id: 'h-nicotine', name: 'No nicotine', createdOn: '2026-04-12' },
  { id: 'h-walk', name: 'Walk before noon', createdOn: '2026-04-15' },
  { id: 'h-read', name: 'Read 20 minutes', createdOn: '2026-05-04' },
];

/**
 * Target current-streak values per habit. The seeder backfills enough
 * held logs to make `getStreakForHabit({ throughDate: yesterday })`
 * return these numbers. Not a runtime denormalization — purely seed
 * targets.
 */
export const targetStreaks: Readonly<Record<string, number>> = {
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

/**
 * Fixture-local extension of WorkoutTemplate. `rotationOrder` is a
 * seed-only concern that maps to the workout_templates.rotation_order
 * column. It does not bleed into the domain shape consumed by screens.
 */
type SeedWorkoutTemplate = WorkoutTemplate & { rotationOrder: number };

export const seedWorkoutTemplates: ReadonlyArray<SeedWorkoutTemplate> = [
  {
    id: 'wt-push-a',
    name: 'Push A',
    exercises: ['Bench press', 'Incline DB press', 'Triceps pushdown'],
    rotationOrder: 1,
  },
  {
    id: 'wt-pull-a',
    name: 'Pull A',
    exercises: ['Deadlift', 'Pull-up', 'Barbell row'],
    rotationOrder: 2,
  },
  {
    id: 'wt-legs-a',
    name: 'Legs A',
    exercises: ['Back squat', 'Romanian deadlift', 'Calf raise'],
    rotationOrder: 3,
  },
  {
    id: 'wt-push-b',
    name: 'Push B',
    exercises: ['Overhead press', 'Lateral raise', 'Dumbbell flye'],
    rotationOrder: 4,
  },
];

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
  targetStreaks: Readonly<Record<string, number>>;
  workoutTemplates: ReadonlyArray<SeedWorkoutTemplate>;
  completedWorkoutDate: string | null;
};

/**
 * Build the full Today-store slice for a given named seed. Pure factory —
 * no I/O, no module-level state. The store calls this on init and again
 * whenever the dev menu picks a different seed.
 */
export function seedFor(name: SeedName, now: Date = new Date()): TodaySeed {
  if (name === 'first-time') {
    return {
      habits: [],
      todayLogs: [],
      yesterdayLogs: [],
      yesterdayJournal: null,
      todayJournal: null,
      targetStreaks: {},
      workoutTemplates: [],
      completedWorkoutDate: null,
    };
  }

  if (name === 'today-is-done') {
    // Same three habits as default, but every habit is held today, the
    // journal has an entry for today, and the next workout has been done.
    const today = todayIso(now);
    const todayLogs: ReadonlyArray<HabitLog> = seedHabits.map((h) => ({
      habitId: h.id,
      date: today,
      status: 'held',
    }));
    const todayJournal: JournalEntry = {
      date: today,
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
      targetStreaks: targetStreaks,
      workoutTemplates: seedWorkoutTemplates,
      completedWorkoutDate: today,
    };
  }

  // 'default' — current behavior. Habits exist, nothing logged today yet,
  // yesterday's journal populated, no workout completed.
  return {
    habits: seedHabits,
    todayLogs: [],
    yesterdayLogs: seedYesterdayLogs(now),
    yesterdayJournal: seedYesterdayJournal(now),
    todayJournal: null,
    targetStreaks: targetStreaks,
    workoutTemplates: seedWorkoutTemplates,
    completedWorkoutDate: null,
  };
}
