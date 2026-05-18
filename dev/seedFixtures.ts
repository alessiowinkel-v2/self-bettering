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
      // Bench press is intentionally absent here. Its prior-workout data
      // is owned in full by `exerciseHistoryFixtures` below — a 23-session
      // history that the per-template priorSets block would otherwise
      // double-count by one. Active Workout's "LAST" line for Bench press
      // still resolves: the most recent of those 23 seeded workouts is
      // its prior session.
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
      // Overhead press and Lateral raise are intentionally absent here.
      // Their prior-workout data is owned in full by
      // `exerciseHistoryFixtures` below (12 and 4 sessions). Leaving them
      // in this map would double-count each by one session.
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

/* ----------------------------- Exercise history --------------------------- */

/**
 * A single seeded set within one exercise-history session. `restAfter`
 * is the gap, in seconds, between this set's `logged_at` and the next
 * set's — the last set of a session ignores its `restAfter` since it
 * has no successor (Exercise History renders that as an em-dash).
 */
export type SeedHistorySet = {
  kg: number | null;
  reps: number | null;
  /** Seconds until the next set is logged. Ignored for the final set. */
  restAfter: number;
};

/**
 * One completed workout in an exercise's history. `daysAgo` is the
 * whole-day offset back from `now`; the session is dated to that
 * calendar day. Every offset here is kept large enough that the session
 * lands before the current Mon–Sun week — see `exerciseHistoryFixtures`.
 */
export type SeedHistorySession = {
  daysAgo: number;
  sets: ReadonlyArray<SeedHistorySet>;
};

/**
 * A run of exercise-history sessions, bound to the template the workout
 * belongs to. The template id must be a real `workout_templates` row —
 * `workouts.template_id` is NOT NULL with ON DELETE RESTRICT — and its
 * name is what the Exercise History breadcrumb shows.
 */
export type SeedExerciseHistory = {
  exerciseName: string;
  templateId: string;
  sessions: ReadonlyArray<SeedHistorySession>;
};

/**
 * Build a rising-weight history. `weights[i]` is the working load of
 * session i (oldest first); each session is `setCount` sets at that
 * load with reps drawn from `repPattern` (cycled). Sessions are spaced
 * `spacingDays` apart and the newest lands `endDaysAgo` back, so the
 * whole run sits before the current week.
 *
 * Rest gaps stagger 75–120s between sets via a fixed, varied cycle —
 * deterministic so the seed is reproducible across runs.
 */
function buildHistory(input: {
  weights: ReadonlyArray<number>;
  setCount: number;
  repPattern: ReadonlyArray<number>;
  spacingDays: number;
  endDaysAgo: number;
}): ReadonlyArray<SeedHistorySession> {
  const { weights, setCount, repPattern, spacingDays, endDaysAgo } = input;
  // Varied rest cycle, all within the 75–120s band the spec asks for.
  const restCycle = [82, 97, 110, 88, 119, 76, 104, 93];
  const sessions: SeedHistorySession[] = [];
  const lastIndex = weights.length - 1;

  for (let i = 0; i < weights.length; i += 1) {
    const daysAgo = endDaysAgo + (lastIndex - i) * spacingDays;
    const sets: SeedHistorySet[] = [];
    for (let s = 0; s < setCount; s += 1) {
      // Cycle reps and rests with offsets so different sessions don't
      // all share the same shape.
      const reps = repPattern[(i + s) % repPattern.length];
      const restAfter = restCycle[(i * setCount + s) % restCycle.length];
      sets.push({ kg: weights[i], reps, restAfter });
    }
    sessions.push({ daysAgo, sets });
  }
  return sessions;
}

/**
 * Exercise-history seed for the 'default' and 'today-is-done' seeds.
 * Each entry produces one completed workout per session, with that
 * exercise's sets only — sessions are never mixed, so the per-exercise
 * session counts read back exactly (Bench 23, Overhead 12, Lateral 4).
 *
 * Why these shapes drive the Exercise History states:
 *  - Bench press, 23 sessions, weighted sets at exactly 5 and 8 reps →
 *    chart (>= 2) + 5/8-rep PR row (>= 10 sessions, both rep counts hit).
 *  - Overhead press, 12 sessions, same rep coverage → chart + PR row.
 *  - Lateral raise, 4 sessions, flat weights → chart only; the PR row is
 *    gated off by the 4 < 10 session count, and no session after the
 *    first beats session 1's top set so no PR pills appear past it.
 *  - Front squat: deliberately absent — the route's empty state.
 *  - Deadlift: untouched here; its single priorSets session is the
 *    "First session." state.
 *
 * Bench press reps include explicit 5s and 8s in the pattern; Overhead
 * press likewise. Lateral raise stays in the 10–12 band — its PR row is
 * count-gated regardless.
 */
export const exerciseHistoryFixtures: ReadonlyArray<SeedExerciseHistory> = [
  {
    // 23 sessions, ~3 months. Spacing 3 days, newest 9 days ago →
    // oldest = 9 + 22 * 3 = 75 days ago. Weights climb 60 → 82.5 with
    // two plateaus and a couple of dips so PR pills scatter realistically
    // rather than landing on every row.
    exerciseName: 'Bench press',
    templateId: 'wt-push-a',
    sessions: buildHistory({
      weights: [
        60, 60, 62.5, 65, 65, 67.5, 65, 67.5, 70, 72.5, 72.5, 70, 75,
        75, 77.5, 80, 77.5, 80, 80, 82.5, 80, 82.5, 82.5,
      ],
      setCount: 4,
      repPattern: [8, 7, 6, 5],
      spacingDays: 3,
      endDaysAgo: 9,
    }),
  },
  {
    // 12 sessions. Spacing 4 days, newest 12 days ago → oldest =
    // 12 + 11 * 4 = 56 days ago. Rising 35 → 52.5 with one plateau and
    // one dip.
    exerciseName: 'Overhead press',
    templateId: 'wt-push-b',
    sessions: buildHistory({
      weights: [35, 37.5, 37.5, 40, 42.5, 40, 45, 47.5, 47.5, 50, 47.5, 52.5],
      setCount: 4,
      repPattern: [8, 7, 6, 5],
      spacingDays: 4,
      endDaysAgo: 12,
    }),
  },
  {
    // 4 sessions, flat weights. Session 1's top set (10kg) is never
    // exceeded, so no PR pills appear after the first session. PR row is
    // off anyway: 4 < 10 sessions.
    exerciseName: 'Lateral raise',
    templateId: 'wt-push-b',
    sessions: buildHistory({
      weights: [10, 10, 10, 10],
      setCount: 3,
      repPattern: [12, 11, 10],
      spacingDays: 5,
      endDaysAgo: 14,
    }),
  },
];
