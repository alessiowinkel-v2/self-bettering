import type { Workout, WorkoutTemplate } from '../state/types';
import { getDB } from './db';
import { workoutId } from './ids';

/**
 * Workout + template data access.
 *
 * Workouts store `started_at` and `completed_at` as ISO timestamps. The
 * domain `Workout.date` is derived from `completed_at` (YYYY-MM-DD).
 * In-progress workouts have `completed_at IS NULL` and are excluded from
 * "most recent completed" queries — matters for the Today screen which
 * only ever wants the last finished session.
 */

type WorkoutRow = {
  id: string;
  template_id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
};

type WorkoutTemplateRow = {
  id: string;
  name: string;
  exercises: string;
};

function rowToWorkout(row: WorkoutRow): Workout {
  // completed_at is non-null because every caller filters on it. Take the
  // date portion only — the time of day is not in the domain shape.
  const completed = row.completed_at ?? row.started_at;
  return {
    id: row.id,
    templateId: row.template_id,
    date: completed.slice(0, 10),
    durationMinutes: Math.round((row.duration_seconds ?? 0) / 60),
  };
}

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

export async function getWorkoutTemplateById(
  id: string
): Promise<WorkoutTemplate | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<WorkoutTemplateRow>(
    `SELECT id, name, exercises
       FROM workout_templates
      WHERE id = ?;`,
    [id]
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
 * Most recent completed workout for a given template. In-progress sessions
 * (completed_at IS NULL) are excluded — Today's "Next workout" card shows
 * the last finished session for that template's cycle.
 */
export async function getMostRecentCompletedWorkout(
  templateId: string
): Promise<Workout | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<WorkoutRow>(
    `SELECT id, template_id, started_at, completed_at, duration_seconds
       FROM workouts
      WHERE template_id = ?
        AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 1;`,
    [templateId]
  );
  return row ? rowToWorkout(row) : null;
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
 * Insert a fully-formed completed workout with a caller-supplied id.
 * Used by the dev seeder; production code should pair startWorkout +
 * completeWorkout instead.
 */
export async function insertCompletedWorkout(input: {
  id: string;
  templateId: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
}): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO workouts (id, template_id, started_at, completed_at, duration_seconds)
     VALUES (?, ?, ?, ?, ?);`,
    [
      input.id,
      input.templateId,
      input.startedAt,
      input.completedAt,
      input.durationSeconds,
    ]
  );
}
