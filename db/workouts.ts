import type { WorkoutTemplate } from '../state/types';
import { getDB } from './db';
import { workoutId } from './ids';

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
