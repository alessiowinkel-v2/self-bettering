import type { WorkoutTemplate } from '../state/types';
import { getDB } from './db';
import { workoutId } from './ids';

/**
 * A routine plus the date it was most recently completed (or null if
 * never completed). Powers the Gym Home routine list, rendered as
 * "Last · today · 5 exercises.", "Last · 3 days ago · 5 exercises.",
 * or "Last · never · 5 exercises." — relative-date phrase stays
 * lowercase inside the structural "Last ·" frame.
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
 * completed. Correlated MAX (per-template) preserves never-completed
 * templates as `lastCompletedDate: null` — LEFT-JOIN-equivalent
 * semantics. Versus a GROUP BY subquery, this lets the outer query
 * keep the natural template ordering and avoids shuffling join keys
 * around.
 *
 * Ordering: rotation_order ASC, name ASC. Same ORDER BY key as
 * getNextWorkoutTemplate, so Today's next-up (which still calls
 * getNextWorkoutTemplate) and Gym Home's next-up (which derives from
 * templates[0]) agree by construction.
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
 * Both bounds are calendar dates. We slice the YYYY-MM-DD prefix off
 * `completed_at` via substr(..., 1, 10) and compare lexicographically;
 * BETWEEN on the date prefix handles inclusive bounds correctly without
 * any time-suffix gymnastics.
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
