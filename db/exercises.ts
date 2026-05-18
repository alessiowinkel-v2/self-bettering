import type { ExerciseSetRow } from '../utils/exerciseHistory';
import { getDB } from './db';

/**
 * Exercise queries derived from the sets log.
 *
 * Lumen has no `exercises` table — exercise names live as strings on
 * sets rows (see migration 0001 + db/sets.ts). The "exercise catalog"
 * is therefore an emergent set: distinct exercise_name values across
 * every completed workout. These helpers materialize that catalog for
 * the Exercise Picker so the user can pick something they've logged
 * before without retyping it.
 *
 * Both queries restrict to completed workouts (w.completed_at IS NOT
 * NULL). In-progress sets aren't part of the catalog yet — they
 * naturally join in once the workout completes.
 */

export type CatalogExercise = {
  name: string;
  /** ISO timestamp of the most recent completed workout containing this exercise. */
  lastUsedAt: string;
};

/**
 * Up to `limit` exercises sorted by most-recently-used. Drives the
 * "Recent" section of the picker.
 */
export async function getRecentExercises(
  limit: number = 6
): Promise<ReadonlyArray<CatalogExercise>> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    name: string;
    last_used_at: string;
  }>(
    `SELECT s.exercise_name AS name,
            MAX(w.completed_at) AS last_used_at
       FROM sets s
       JOIN workouts w ON w.id = s.workout_id
      WHERE w.completed_at IS NOT NULL
      GROUP BY s.exercise_name
      ORDER BY last_used_at DESC
      LIMIT ?;`,
    [limit]
  );
  return rows.map((r) => ({ name: r.name, lastUsedAt: r.last_used_at }));
}

/**
 * Every distinct exercise the user has ever logged, sorted by
 * most-recently-used. Drives the "All" section of the picker — and the
 * first-use empty-state detection (length === 0 means the user has
 * never logged a set).
 */
export async function getAllExercises(): Promise<
  ReadonlyArray<CatalogExercise>
> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    name: string;
    last_used_at: string;
  }>(
    `SELECT s.exercise_name AS name,
            MAX(w.completed_at) AS last_used_at
       FROM sets s
       JOIN workouts w ON w.id = s.workout_id
      WHERE w.completed_at IS NOT NULL
      GROUP BY s.exercise_name
      ORDER BY last_used_at DESC;`
  );
  return rows.map((r) => ({ name: r.name, lastUsedAt: r.last_used_at }));
}

/**
 * Every set ever logged for one exercise name, joined to its parent
 * workout and routine. Drives the Exercise History screen — the route's
 * pure derivation layer (utils/exerciseHistory.ts) reshapes this flat
 * list into sessions, top sets, chart points, PRs, and rest gaps.
 *
 * Unlike the catalog queries above, this is NOT restricted to completed
 * workouts: a set logged moments ago in an active workout is a
 * legitimate (in-progress) session and must appear. There is no
 * `completed_at` filter.
 *
 * The template join is a LEFT JOIN so a set row never drops if its
 * workout's template is somehow unresolved — `templateName` resolves to
 * null instead, which the screen renders as a defined fallback. The FK
 * (workouts.template_id NOT NULL + ON DELETE RESTRICT) means it should
 * always resolve in practice; the LEFT JOIN is belt-and-braces so a
 * missing template can never silently swallow set history.
 *
 * Rows come back newest workout first, then ascending set number — the
 * derivation layer re-sorts anyway, but this order keeps the raw result
 * readable.
 */
export async function getSessionRowsForExercise(
  exerciseName: string
): Promise<ReadonlyArray<ExerciseSetRow>> {
  const db = await getDB();
  const rows = await db.getAllAsync<{
    workout_id: string;
    started_at: string;
    template_name: string | null;
    set_number: number;
    kg: number | null;
    reps: number | null;
    logged_at: string;
  }>(
    `SELECT w.id AS workout_id,
            w.started_at AS started_at,
            t.name AS template_name,
            s.set_number AS set_number,
            s.kg AS kg,
            s.reps AS reps,
            s.logged_at AS logged_at
       FROM sets s
       JOIN workouts w ON w.id = s.workout_id
       LEFT JOIN workout_templates t ON t.id = w.template_id
      WHERE s.exercise_name = ?
      ORDER BY w.started_at DESC, s.set_number ASC;`,
    [exerciseName]
  );
  return rows.map((r) => ({
    workoutId: r.workout_id,
    startedAt: r.started_at,
    templateName: r.template_name,
    setNumber: r.set_number,
    kg: r.kg,
    reps: r.reps,
    loggedAt: r.logged_at,
  }));
}
