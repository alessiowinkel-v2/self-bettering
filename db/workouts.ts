import type { WorkoutTemplate } from '../state/types';
import { getDB } from './db';
import { workoutId } from './ids';

/**
 * A routine plus the date it was most recently completed (or null if
 * never completed). Drives the Gym Home routine list — Last · today.,
 * Last · 3 days ago., never done.
 */
export type WorkoutTemplateWithLast = {
  template: WorkoutTemplate;
  lastCompletedDate: string | null;
};

/**
 * Workout + template data access.
 *
 * Workouts store `started_at` and `completed_at` as ISO timestamps.
 * In-progress workouts have `completed_at IS NULL` and are excluded from
 * "most recent completed" queries — matters for the Today screen which
 * only ever wants the last finished session.
 */

type WorkoutTemplateRow = {
  id: string;
  name: string;
  exercises: string;
};

function rowToTemplate(row: WorkoutTemplateRow): WorkoutTemplate {
  let exercises: ReadonlyArray<string> = [];
  try {
    const parsed: unknown = JSON.parse(row.exercises);
    if (Array.isArray(parsed)) {
      exercises = parsed.filter((e): e is string => typeof e === 'string');
    }
  } catch {
    exercises = [];
  }
  return { id: row.id, name: row.name, exercises };
}

export async function getWorkoutTemplates(): Promise<ReadonlyArray<WorkoutTemplate>> {
  const db = await getDB();
  const rows = await db.getAllAsync<WorkoutTemplateRow>(
    `SELECT id, name, exercises
       FROM workout_templates
      ORDER BY name ASC;`
  );
  return rows.map(rowToTemplate);
}

/**
 * Next routine in the rotation. Phase 3's Active Workout will replace
 * this with real least-recently-completed semantics; this column is
 * the Phase 2b stand-in.
 */
export async function getNextWorkoutTemplate(): Promise<WorkoutTemplate | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<WorkoutTemplateRow>(
    `SELECT id, name, exercises
       FROM workout_templates
      ORDER BY rotation_order ASC, name ASC
      LIMIT 1;`
  );
  return row ? rowToTemplate(row) : null;
}

// PHASE-3: rotation_order param needed when called from
// non-test code paths.
export async function insertWorkoutTemplate(
  template: WorkoutTemplate
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO workout_templates (id, name, exercises) VALUES (?, ?, ?);`,
    [template.id, template.name, JSON.stringify(template.exercises)]
  );
}

/**
 * Date of the most recent completed workout across all templates, as
 * YYYY-MM-DD. Used by the Today hydrate to set `completedWorkoutDate`
 * when the latest completion happened today.
 */
export async function getMostRecentCompletedWorkoutDate(): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ completed_at: string }>(
    `SELECT completed_at
       FROM workouts
      WHERE completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 1;`
  );
  return row ? row.completed_at.slice(0, 10) : null;
}

export async function startWorkout(input: {
  templateId: string;
  startedAt?: string;
}): Promise<{ id: string; startedAt: string }> {
  const db = await getDB();
  const id = workoutId();
  const startedAt = input.startedAt ?? new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workouts (id, template_id, started_at, completed_at, duration_seconds)
     VALUES (?, ?, ?, NULL, NULL);`,
    [id, input.templateId, startedAt]
  );
  return { id, startedAt };
}

export async function completeWorkout(input: {
  id: string;
  completedAt?: string;
  durationSeconds: number;
}): Promise<void> {
  const db = await getDB();
  const completedAt = input.completedAt ?? new Date().toISOString();
  await db.runAsync(
    `UPDATE workouts
        SET completed_at = ?,
            duration_seconds = ?
      WHERE id = ?;`,
    [completedAt, input.durationSeconds, input.id]
  );
}

/**
 * Returns every routine paired with the date it was most recently
 * completed. LEFT JOIN preserves never-completed templates as
 * `lastCompletedDate: null`. Correlated MAX (per-template) is the
 * cleanest single-pass shape — versus a GROUP BY subquery, this lets
 * the outer query keep the natural template ordering and avoids
 * shuffling join keys around.
 *
 * Ordering: rotation_order ASC, name ASC. Same key as
 * getNextWorkoutTemplate so the "Up next" highlight on Gym Home and
 * the routine list stay in sync.
 */
export async function getWorkoutTemplatesWithLastCompleted(): Promise<
  ReadonlyArray<WorkoutTemplateWithLast>
> {
  const db = await getDB();
  const rows = await db.getAllAsync<
    WorkoutTemplateRow & { last_completed_at: string | null }
  >(
    `SELECT t.id,
            t.name,
            t.exercises,
            (SELECT MAX(w.completed_at)
               FROM workouts w
              WHERE w.template_id = t.id
                AND w.completed_at IS NOT NULL) AS last_completed_at
       FROM workout_templates t
      ORDER BY t.rotation_order ASC, t.name ASC;`
  );
  return rows.map((row) => ({
    template: rowToTemplate(row),
    lastCompletedDate:
      row.last_completed_at !== null ? row.last_completed_at.slice(0, 10) : null,
  }));
}

/**
 * Distinct ISO dates (YYYY-MM-DD) on which any workout was completed
 * within [startDate, endDate], inclusive. Drives the Gym Home week
 * strip — one filled dot per day with at least one completion.
 *
 * Both bounds are calendar dates, but `completed_at` is an ISO
 * timestamp. We compare against `startDate` and `endDate || 'T23:59:59.999'`
 * so a same-day completion at any time falls within the range.
 */
export async function getCompletedWorkoutDatesInRange(input: {
  startDate: string;
  endDate: string;
}): Promise<ReadonlyArray<string>> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT DISTINCT substr(completed_at, 1, 10) AS date
       FROM workouts
      WHERE completed_at IS NOT NULL
        AND substr(completed_at, 1, 10) BETWEEN ? AND ?
      ORDER BY date ASC;`,
    [input.startDate, input.endDate]
  );
  return rows.map((r) => r.date);
}
