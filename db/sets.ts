import { getDB } from './db';
import { setId } from './ids';

/**
 * Set data access. A "set" is one logged row inside a workout — exercise
 * name, set number, kg, reps. Exercise name is stored on the row rather
 * than normalized into a separate table; the gym domain keeps churning
 * exercise names and a join table buys nothing yet.
 */

export type SetRow = {
  id: string;
  workoutId: string;
  exerciseName: string;
  setNumber: number;
  kg: number | null;
  reps: number | null;
  loggedAt: string;
};

type SetDBRow = {
  id: string;
  workout_id: string;
  exercise_name: string;
  set_number: number;
  kg: number | null;
  reps: number | null;
  logged_at: string;
};

function dbRowToSet(r: SetDBRow): SetRow {
  return {
    id: r.id,
    workoutId: r.workout_id,
    exerciseName: r.exercise_name,
    setNumber: r.set_number,
    kg: r.kg,
    reps: r.reps,
    loggedAt: r.logged_at,
  };
}

/**
 * Insert a set row for a workout. Idempotent on the logical tuple
 * (workout_id, exercise_name, set_number) — migration 0004 added a UNIQUE
 * constraint on that triple so a double-tap on the Log button can no
 * longer produce two rows for the same set.
 *
 * On constraint collision the function resolves with the SetRow it would
 * have inserted (same shape callers expect on the happy path) instead of
 * throwing. The first tap's row remains the source of truth in the DB;
 * the second tap is a no-op. Any non-UNIQUE error re-throws.
 *
 * expo-sqlite surfaces SQLite errors as `Error` instances whose `message`
 * contains `UNIQUE constraint failed`. The check is on the message
 * because expo-sqlite does not expose a numeric error code on the Error
 * object.
 */
export async function logSet(input: {
  workoutId: string;
  exerciseName: string;
  setNumber: number;
  kg: number | null;
  reps: number | null;
}): Promise<SetRow> {
  const db = await getDB();
  const id = setId(input.setNumber);
  const loggedAt = new Date().toISOString();
  try {
    await db.runAsync(
      `INSERT INTO sets (id, workout_id, exercise_name, set_number, kg, reps, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        input.workoutId,
        input.exerciseName,
        input.setNumber,
        input.kg,
        input.reps,
        loggedAt,
      ]
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message.includes('UNIQUE constraint failed')) {
      throw e;
    }
    // Duplicate logical tuple — the row already exists from a prior tap.
    // Fall through and return the would-be shape so callers see a
    // consistent SetRow on every invocation.
  }
  return {
    id,
    workoutId: input.workoutId,
    exerciseName: input.exerciseName,
    setNumber: input.setNumber,
    kg: input.kg,
    reps: input.reps,
    loggedAt,
  };
}

/**
 * All sets logged inside a workout, ordered by exercise name then set
 * number. Used by Active Workout on hydrate to rebuild the per-exercise
 * progress slices in one read.
 */
export async function getSetsForWorkout(
  workoutId: string
): Promise<ReadonlyArray<SetRow>> {
  const db = await getDB();
  const rows = await db.getAllAsync<SetDBRow>(
    `SELECT id, workout_id, exercise_name, set_number, kg, reps, logged_at
       FROM sets
      WHERE workout_id = ?
      ORDER BY exercise_name ASC, set_number ASC;`,
    [workoutId]
  );
  return rows.map(dbRowToSet);
}

/**
 * Sets from the most recent COMPLETED workout (other than the current
 * one) that contained this exercise. Empty array if there's no prior
 * record — Active Workout uses that to hide the "LAST" line and skip
 * the numeric-pad "last · X" pill on a first-ever exercise.
 *
 * Two-step lookup:
 *   1. Find max(w.completed_at) across completed workouts that contain
 *      a set with this exercise name, excluding the current workout.
 *   2. Pull all sets for that workout + exercise, ordered by set_number.
 *
 * Joined in a single statement so the round-trip stays cheap. Returns
 * sets in set_number order — the caller renders them comma-separated
 * for the "LAST 82.5kg × 6, 6, 5, 4" line.
 */
export async function getLastSetsForExerciseBeforeWorkout(input: {
  exerciseName: string;
  currentWorkoutId: string;
}): Promise<ReadonlyArray<SetRow>> {
  const db = await getDB();
  const rows = await db.getAllAsync<SetDBRow>(
    `SELECT s.id, s.workout_id, s.exercise_name, s.set_number,
            s.kg, s.reps, s.logged_at
       FROM sets s
       JOIN workouts w ON w.id = s.workout_id
      WHERE s.exercise_name = ?
        AND s.workout_id != ?
        AND w.completed_at IS NOT NULL
        AND w.completed_at = (
          SELECT MAX(w2.completed_at)
            FROM workouts w2
            JOIN sets s2 ON s2.workout_id = w2.id
           WHERE s2.exercise_name = ?
             AND w2.id != ?
             AND w2.completed_at IS NOT NULL
        )
      ORDER BY s.set_number ASC;`,
    [input.exerciseName, input.currentWorkoutId, input.exerciseName, input.currentWorkoutId]
  );
  return rows.map(dbRowToSet);
}
