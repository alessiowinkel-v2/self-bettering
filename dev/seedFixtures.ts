import { todayIso, yesterdayIso } from '../utils/dateFormat';
import type {
  Habit,
  HabitLog,
  JournalEntry,
  WorkoutTemplate,
} from '../state/types';

/**
 * A single set value seeded into a "prior" completed workout for a
 * template. Drives the Active Workout "LAST 82.5kg × 6, 6, 5, 4" line
 * and the numeric pad's "last · 82.5" pill on first run-through in
 * dev. Stored per-exercise so each prescription can carry its own
 * load-and-rep shape.
 */
export type SeedPriorSet = { kg: number; reps: number };

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
 *
 * `priorSets` holds a synthetic prior-workout's sets per exercise, keyed
 * by exercise name. seedDev writes them into a completed workout dated
 * a few days back so the Active Workout screen's "LAST 82.5kg × 6, 6, 5, 4"
 * line populates from day one. Without this, every exercise in dev
 * mode would render as a first-ever session until the user logs a
 * real workout — the screen's most-loaded state would only be
 * reachable after running through the full flow once.
 */
type SeedWorkoutTemplate = WorkoutTemplate & {
  rotationOrder: number;
  priorSets: Readonly<Record<string, ReadonlyArray<SeedPriorSet>>>;
};

export const seedWorkoutTemplates: ReadonlyArray<SeedWorkoutTemplate> = [
  {
    id: 'wt-push-a',
    name: 'Push A',
    exercises: [
      { name: 'Bench press', setCount: 4, repRange: [5, 8] },
      { name: 'Incline DB press', setCount: 3, repRange: [8, 10] },
      { name: 'Triceps pushdown', setCount: 3, repRange: [10, 12] },
    ],
    rotationOrder: 1,
    priorSets: {
      // Mirrors PDF page 15's "LAST 82.5kg × 6, 6, 5, 4" Bench press
      // example so the design frame can be reproduced on first run.
      'Bench press': [
        { kg: 82.5, reps: 6 },
        { kg: 82.5, reps: 6 },
        { kg: 82.5, reps: 5 },
        { kg: 82.5, reps: 4 },
      ],
      'Incline DB press': [
        { kg: 20, reps: 8 },
        { kg: 20, reps: 8 },
        { kg: 20, reps: 7 },
      ],
      'Triceps pushdown': [
        { kg: 35, reps: 12 },
        { kg: 35, reps: 11 },
        { kg: 35, reps: 10 },
      ],
    },
  },
  {
    id: 'wt-pull-a',
    name: 'Pull A',
    exercises: [
      { name: 'Deadlift', setCount: 3, repRange: [3, 5] },
      { name: 'Pull-up', setCount: 4, repRange: [6, 10] },
      { name: 'Barbell row', setCount: 3, repRange: [8, 10] },
    ],
    rotationOrder: 2,
    priorSets: {
      'Deadlift': [
        { kg: 140, reps: 5 },
        { kg: 140, reps: 4 },
        { kg: 140, reps: 3 },
      ],
      'Pull-up': [
        { kg: 0, reps: 10 },
        { kg: 0, reps: 8 },
        { kg: 0, reps: 7 },
        { kg: 0, reps: 6 },
      ],
      'Barbell row': [
        { kg: 70, reps: 10 },
        { kg: 70, reps: 9 },
        { kg: 70, reps: 8 },
      ],
    },
  },
  {
    id: 'wt-legs-a',
    name: 'Legs A',
    exercises: [
      { name: 'Back squat', setCount: 4, repRange: [5, 8] },
      { name: 'Romanian deadlift', setCount: 3, repRange: [8, 10] },
      { name: 'Calf raise', setCount: 3, repRange: [10, 15] },
    ],
    rotationOrder: 3,
    priorSets: {
      'Back squat': [
        { kg: 110, reps: 8 },
        { kg: 110, reps: 7 },
        { kg: 110, reps: 6 },
        { kg: 110, reps: 5 },
      ],
      'Romanian deadlift': [
        { kg: 90, reps: 10 },
        { kg: 90, reps: 9 },
        { kg: 90, reps: 8 },
      ],
      'Calf raise': [
        { kg: 60, reps: 15 },
        { kg: 60, reps: 13 },
        { kg: 60, reps: 12 },
      ],
    },
  },
  {
    id: 'wt-push-b',
    name: 'Push B',
    exercises: [
      { name: 'Overhead press', setCount: 4, repRange: [5, 8] },
      { name: 'Lateral raise', setCount: 3, repRange: [10, 12] },
      { name: 'Dumbbell flye', setCount: 3, repRange: [10, 12] },
    ],
    rotationOrder: 4,
    priorSets: {
      'Overhead press': [
        { kg: 50, reps: 8 },
        { kg: 50, reps: 7 },
        { kg: 50, reps: 6 },
        { kg: 50, reps: 5 },
      ],
      'Lateral raise': [
        { kg: 8, reps: 12 },
        { kg: 8, reps: 11 },
        { kg: 8, reps: 10 },
      ],
      'Dumbbell flye': [
        { kg: 12, reps: 12 },
        { kg: 12, reps: 11 },
        { kg: 12, reps: 10 },
      ],
    },
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
