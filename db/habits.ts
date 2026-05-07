import type { Habit } from '../state/types';
import { getDB } from './db';
import { habitId } from './ids';

/**
 * Habits data access. Domain shape is defined in state/types.ts; this
 * module is the only place SQL touches habit rows.
 */

type HabitRow = {
  id: string;
  name: string;
  created_on: string;
  paused_at: string | null;
  deleted_at: string | null;
};

function rowToHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    createdOn: row.created_on,
  };
}

/** Active habits = not paused, not deleted. Ordered by creation. */
export async function getActiveHabits(): Promise<ReadonlyArray<Habit>> {
  const db = await getDB();
  const rows = await db.getAllAsync<HabitRow>(
    `SELECT id, name, created_on, paused_at, deleted_at
       FROM habits
      WHERE paused_at IS NULL AND deleted_at IS NULL
      ORDER BY created_on ASC, id ASC;`
  );
  return rows.map(rowToHabit);
}

export async function getHabitById(id: string): Promise<Habit | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<HabitRow>(
    `SELECT id, name, created_on, paused_at, deleted_at
       FROM habits
      WHERE id = ?;`,
    [id]
  );
  return row ? rowToHabit(row) : null;
}

export async function createHabit(input: {
  name: string;
  createdOn: string;
}): Promise<Habit> {
  const db = await getDB();
  const id = habitId(input.name);
  await db.runAsync(
    `INSERT INTO habits (id, name, created_on, paused_at, deleted_at)
     VALUES (?, ?, ?, NULL, NULL);`,
    [id, input.name, input.createdOn]
  );
  return { id, name: input.name, createdOn: input.createdOn };
}

/**
 * Insert a habit with a caller-chosen id. Used by the dev seeder so the
 * mock-data ids (h-nicotine, h-walk, h-read) survive into the DB and the
 * existing Today screen keeps rendering against them.
 */
export async function insertHabitWithId(habit: Habit): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO habits (id, name, created_on, paused_at, deleted_at)
     VALUES (?, ?, ?, NULL, NULL);`,
    [habit.id, habit.name, habit.createdOn]
  );
}
