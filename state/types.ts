/**
 * Shared types for Lumen's domain. The mock store and (later) the SQLite
 * data-access layer return these exact shapes — keeping them in one place
 * means screens don't need to change when persistence lands in Phase 2.
 */

export type HabitStatus = 'held' | 'slipped';

export type Habit = {
  id: string;
  name: string;
  /**
   * ISO date (YYYY-MM-DD) the habit was created on. Used to gate the
   * "Day one." treatment on Habit Detail and to bound streak math.
   */
  createdOn: string;
};

export type HabitLog = {
  habitId: string;
  /** ISO date (YYYY-MM-DD). One log per habit per day. */
  date: string;
  status: HabitStatus;
};

export type Mood = 1 | 2 | 3 | 4 | 5;

export type JournalEntry = {
  /** ISO date (YYYY-MM-DD). One entry per day. */
  date: string;
  mood: Mood | null;
  tags: ReadonlyArray<string>;
  body: string;
};

/**
 * One exercise inside a routine template. The template defines the
 * prescription (how many sets at what rep range); the actual sets logged
 * during a workout live in the `sets` table.
 *
 * `repRange` is `[min, max]` inclusive — `[5, 8]` renders as "5–8" in
 * the Active Workout subtitle ("4 × 5–8"). Set min === max for a fixed
 * target (e.g. `[10, 10]` → "10").
 *
 * Stored as JSON inside `workout_templates.exercises`. Phase 3f swapped
 * this from `ReadonlyArray<string>` to the richer object; no migration
 * was required because the column was already JSON-typed.
 */
export type WorkoutTemplateExercise = {
  name: string;
  /** Number of prescribed sets, e.g. 4 for "4 × 5–8". */
  setCount: number;
  /** [min, max] inclusive rep range. */
  repRange: readonly [number, number];
};

export type WorkoutTemplate = {
  id: string;
  /** Display name, e.g. "Push A". */
  name: string;
  /** Ordered exercises in this routine. */
  exercises: ReadonlyArray<WorkoutTemplateExercise>;
};
