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

/**
 * Active habits = not paused, not deleted. Ordered by the explicit
 * sort_order column (manual reorder from Habits List), with created_on
 * and id as deterministic tie-breakers for rows that share an order.
 */
export async function getActiveHabits(): Promise<ReadonlyArray<Habit>> {
  const db = await getDB();
  const rows = await db.getAllAsync<HabitRow>(
    `SELECT id, name, created_on, paused_at, deleted_at
       FROM habits
      WHERE paused_at IS NULL AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_on ASC, id ASC;`
  );
  return rows.map(rowToHabit);
}

/** Paused habits — soft-paused via paused_at, still visible on Habits List. */
export async function getPausedHabits(): Promise<ReadonlyArray<Habit>> {
  const db = await getDB();
  const rows = await db.getAllAsync<HabitRow>(
    `SELECT id, name, created_on, paused_at, deleted_at
       FROM habits
      WHERE paused_at IS NOT NULL AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_on ASC, id ASC;`
  );
  return rows.map(rowToHabit);
}

/** Archived habits — soft-deleted via deleted_at. */
export async function getArchivedHabits(): Promise<ReadonlyArray<Habit>> {
  const db = await getDB();
  const rows = await db.getAllAsync<HabitRow>(
    `SELECT id, name, created_on, paused_at, deleted_at
       FROM habits
      WHERE deleted_at IS NOT NULL
      ORDER BY sort_order ASC, created_on ASC, id ASC;`
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

// MAX(sort_order) scoped to active habits. When resume is added in
// Phase 3b, resumeHabit must recompute sort_order against the current
// active set to avoid collisions.
export async function createHabit(input: {
  name: string;
  createdOn: string;
}): Promise<Habit> {
  const db = await getDB();
  const id = habitId(input.name);
  // sort_order is computed in-statement so a new habit lands at the bottom
  // of the active list atomically. COALESCE handles the empty-table case
  // by defaulting the previous max to 0.
  await db.runAsync(
    `INSERT INTO habits (id, name, created_on, paused_at, deleted_at, sort_order)
     VALUES (
       ?, ?, ?, NULL, NULL,
       COALESCE((SELECT MAX(sort_order) FROM habits WHERE deleted_at IS NULL AND paused_at IS NULL), 0) + 1
     );`,
    [id, input.name, input.createdOn]
  );
  return { id, name: input.name, createdOn: input.createdOn };
}

/** Mark a habit paused. The timestamp doubles as the "paused since" date. */
export async function pauseHabit(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE habits SET paused_at = ? WHERE id = ?;`,
    [new Date().toISOString(), id]
  );
}

/** Soft-archive a habit. The row stays for history but drops out of active. */
export async function archiveHabit(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE habits SET deleted_at = ? WHERE id = ?;`,
    [new Date().toISOString(), id]
  );
}

/**
 * Bulk-rewrite sort_order for the supplied habits so each id takes its
 * index in the array. Wrapped in a transaction so a partial reorder can
 * never leave the table in a half-applied state.
 */
export async function reorderHabits(
  orderedIds: ReadonlyArray<string>
): Promise<void> {
  const db = await getDB();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await db.runAsync(
        `UPDATE habits SET sort_order = ? WHERE id = ?;`,
        [i, orderedIds[i]]
      );
    }
  });
}
