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
