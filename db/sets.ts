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
