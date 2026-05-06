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

export type WorkoutTemplate = {
  id: string;
  /** Display name, e.g. "Push A". */
  name: string;
  /** Ordered exercise names, used by the "Next workout" preview line. */
  exercises: ReadonlyArray<string>;
};

export type Workout = {
  id: string;
  templateId: string;
  /** ISO date (YYYY-MM-DD) the workout was completed. */
  date: string;
  durationMinutes: number;
};
