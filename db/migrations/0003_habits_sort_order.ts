/**
 * Migration 0003 — habits sort order.
 *
 * Adds an explicit ordering column to habits so the Habits List screen can
 * support manual reorder (long-press drag) without needing a separate
 * pivot table. The column is also read by getActiveHabits/getPausedHabits/
 * getArchivedHabits as the primary ORDER BY, with created_on ASC and id
 * ASC as tie-breakers.
 *
 * Forward-only. Existing rows take the DEFAULT 0 and tie-break on
 * created_on ASC. After applying this migration to a DB with existing
 * habits, run `seedDev()` to populate proper values — the seed fixtures
 * insert sort_order via the standard createHabit path going forward, and
 * a fresh reseed gives every row a distinct ordering.
 */
const sql = `
ALTER TABLE habits
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
`;

export default sql;
