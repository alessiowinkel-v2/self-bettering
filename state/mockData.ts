import { yesterdayIso } from '../utils/dateFormat';
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
 * Held/Slipped affordances render on first load.
 */

export const seedHabits: ReadonlyArray<Habit> = [
  { id: 'h-nicotine', name: 'No nicotine', createdOn: '2026-04-12' },
  { id: 'h-walk', name: 'Walk before noon', createdOn: '2026-04-15' },
  { id: 'h-read', name: 'Read 20 minutes', createdOn: '2026-05-04' },
];

/**
 * Streak counts coming into today. The streak math will live in a pure
 * util in Phase 2 once we have a real log history. For Phase 1c we
 * pre-compute the "current streak through yesterday" so the cards have
 * the right amber number.
 */
export const seedStreaksThroughYesterday: Readonly<Record<string, number>> = {
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
