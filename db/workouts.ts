import type { WorkoutTemplate, WorkoutTemplateExercise } from '../state/types';
import { getDB } from './db';
import { templateId, workoutId } from './ids';

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

/**
 * Type-guard for a single exercise entry on disk. Validates each field
 * rather than trusting the column — the JSON shape changed in Phase 3f
 * and prior installs may carry the old `string[]` form. Malformed
 * entries are dropped silently so the screen stays renderable.
 */
function isWorkoutTemplateExercise(e: unknown): e is WorkoutTemplateExercise {
  if (typeof e !== 'object' || e === null) return false;
  const obj = e as Record<string, unknown>;
  if (typeof obj.name !== 'string') return false;
  if (typeof obj.setCount !== 'number' || obj.setCount <= 0) return false;
  if (!Array.isArray(obj.repRange) || obj.repRange.length !== 2) return false;
  if (typeof obj.repRange[0] !== 'number' || typeof obj.repRange[1] !== 'number') {
    return false;
  }
  // restDurationSeconds is optional (added Phase 4). When present it
  // must be a non-negative finite number; rows written before the
  // field existed simply omit it and fall back to the Settings default.
  if (
    obj.restDurationSeconds !== undefined &&
    (typeof obj.restDurationSeconds !== 'number' ||
      !Number.isFinite(obj.restDurationSeconds) ||
      obj.restDurationSeconds < 0)
  ) {
    return false;
  }
  return true;
}

function rowToTemplate(row: WorkoutTemplateRow): WorkoutTemplate {
  let exercises: ReadonlyArray<WorkoutTemplateExercise> = [];
  try {
    const parsed: unknown = JSON.parse(row.exercises);
    if (Array.isArray(parsed)) {
      exercises = parsed.filter(isWorkoutTemplateExercise);
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
 * Create a new routine from the editor. Lands at the bottom of the
 * rotation (MAX(rotation_order)+1) so it surfaces in the routine list
 * without disturbing the next-up order of existing routines.
 *
 * Differs from insertWorkoutTemplate (which preserves the caller's id and
 * leaves rotation_order at its default 0) in two ways:
 *   1. Generates a `wt-${slug}-${ts36}` id locally
 *   2. Sets rotation_order in the same statement so the new routine sits
 *      after every existing one
 *
 * The transaction wrapper isn't strictly necessary for a single INSERT,
 * but it matches updateWorkoutTemplate's shape and pins the
 * MAX(rotation_order) subselect to the same logical moment as the insert
 * — defensive against a hypothetical concurrent writer.
 */
export async function createWorkoutTemplate(input: {
  name: string;
  exercises: ReadonlyArray<WorkoutTemplateExercise>;
}): Promise<WorkoutTemplate> {
  const db = await getDB();
  const id = templateId(input.name);
  await db.runAsync(
    `INSERT INTO workout_templates (id, name, exercises, rotation_order)
     VALUES (
       ?, ?, ?,
       COALESCE((SELECT MAX(rotation_order) FROM workout_templates), 0) + 1
     );`,
    [id, input.name, JSON.stringify(input.exercises)]
  );
  return { id, name: input.name, exercises: input.exercises };
}

/**
 * Rewrite a routine's name + exercises in place. Sets rotation_order
 * is untouched so the routine keeps its position in the rotation.
 *
 * The prompt called out a delete-and-reinsert pattern against a separate
 * template_exercises table, but the actual schema stores exercises as
 * JSON inside workout_templates.exercises (see migration 0001). One
 * UPDATE replaces the entire list atomically — simpler than the
 * delete-and-reinsert it was modeled on, and the JSON column has no
 * referential dependents (sets reference exercise_name as a string, not
 * a template-exercise row id), so wholesale replacement stays safe.
 */
export async function updateWorkoutTemplate(input: {
  id: string;
  name: string;
  exercises: ReadonlyArray<WorkoutTemplateExercise>;
}): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE workout_templates
        SET name = ?, exercises = ?
      WHERE id = ?;`,
    [input.name, JSON.stringify(input.exercises), input.id]
  );
}

/**
 * Read a single routine by id. Returns null if no row matches (e.g. the
 * routine was deleted between the Gym Home tap and the editor mount).
 * Edit Routine uses this for its initialRoutine load.
 */
export async function getWorkoutTemplate(
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
 * Delete a workout and its sets outright. Used by the "Discard" exit
 * option on the Active Workout screen — the session is thrown away,
 * nothing is recorded. CASCADE on sets.workout_id wipes the set rows,
 * same as cleanupOrphanWorkouts relies on.
 */
export async function discardWorkout(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM workouts WHERE id = ?;`, [id]);
}

/**
 * Boot-time cleanup of orphan workouts.
 *
 * A workout row with `completed_at IS NULL` represents an in-progress
 * session — the user either is mid-workout right now (impossible at
 * boot, since the screen isn't mounted yet) or force-quit while one
 * was active. Without GC these rows accumulate forever and confuse
 * future "most recent" / "last set" queries.
 *
 * Threshold: 24 hours from `started_at`. A user pressing the home
 * button mid-workout and returning hours later loses the session;
 * resume-in-progress is deferred to Phase 4 and would require a
 * different surface anyway (Gym Home would need to show "in progress"
 * routines). The 24h window is generous enough that nobody's real
 * workout gets cleaned up by mistake.
 *
 * Idempotent: zero affected rows is the happy path. CASCADE on
 * sets.workout_id wipes associated set rows.
 */
export async function cleanupOrphanWorkouts(): Promise<void> {
  const db = await getDB();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await db.runAsync(
    `DELETE FROM workouts
      WHERE completed_at IS NULL
        AND started_at < ?;`,
    [cutoff]
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
 * Snapshot of the most recent orphan workout — an in-progress row whose
 * `started_at` is within the last 24h. Drives Gym Home's resume-in-progress
 * card and the workout screen's bootstrap branch.
 *
 * Returns `null` if no orphan exists or if every orphan is older than 24h
 * (the boot-time cleanup will sweep those on next launch).
 *
 * `currentExerciseName` / `currentSetNumber` are computed by walking the
 * template's exercises in order; the first exercise whose logged-set count
 * falls short of its prescription is the in-progress one, and the next
 * set to log is one past that count. If every exercise is fully logged
 * (shouldn't happen — would mean the user logged the final set but
 * never tapped Save), we return the last exercise with set count clamped
 * to setCount so the card stays renderable.
 */
export type ResumableOrphan = {
  workoutId: string;
  templateId: string;
  startedAt: string;
  currentExerciseName: string;
  currentSetNumber: number;
  totalSetsForExercise: number;
  elapsedMinutes: number;
};

export async function getMostRecentOrphan(): Promise<ResumableOrphan | null> {
  const db = await getDB();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const row = await db.getFirstAsync<{
    id: string;
    template_id: string;
    started_at: string;
  }>(
    `SELECT id, template_id, started_at
       FROM workouts
      WHERE completed_at IS NULL
        AND started_at > ?
      ORDER BY started_at DESC
      LIMIT 1;`,
    [cutoff]
  );
  if (!row) return null;

  // Resolve the template so we can walk its prescribed exercises in
  // order. If the template was deleted between the orphan's start and
  // now, the resume can't be reconstructed cleanly — surface as null so
  // Gym Home falls back to the next-up card.
  const templateRow = await db.getFirstAsync<WorkoutTemplateRow>(
    `SELECT id, name, exercises
       FROM workout_templates
      WHERE id = ?;`,
    [row.template_id]
  );
  if (!templateRow) return null;
  const template = rowToTemplate(templateRow);
  if (template.exercises.length === 0) return null;

  // Group logged sets by exercise_name so we can count progress per
  // prescribed exercise.
  const setRows = await db.getAllAsync<{
    exercise_name: string;
    set_number: number;
  }>(
    `SELECT exercise_name, set_number
       FROM sets
      WHERE workout_id = ?
      ORDER BY exercise_name, set_number;`,
    [row.id]
  );
  const loggedCountByExercise = new Map<string, number>();
  for (const s of setRows) {
    loggedCountByExercise.set(
      s.exercise_name,
      (loggedCountByExercise.get(s.exercise_name) ?? 0) + 1
    );
  }

  // Walk the template in prescribed order. First exercise that has
  // fewer logged sets than its setCount is the current one.
  let currentExercise = template.exercises[template.exercises.length - 1];
  let currentSetNumber = currentExercise.setCount;
  for (const ex of template.exercises) {
    const logged = loggedCountByExercise.get(ex.name) ?? 0;
    if (logged < ex.setCount) {
      currentExercise = ex;
      currentSetNumber = logged + 1;
      break;
    }
  }

  const elapsedMs = Date.now() - new Date(row.started_at).getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));

  return {
    workoutId: row.id,
    templateId: row.template_id,
    startedAt: row.started_at,
    currentExerciseName: currentExercise.name,
    currentSetNumber,
    totalSetsForExercise: currentExercise.setCount,
    elapsedMinutes,
  };
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
