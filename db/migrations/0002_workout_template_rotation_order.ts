/**
 * Migration 0002 — workout template rotation order.
 *
 * Adds an explicit ordering column to workout_templates so the Today
 * screen's "Next workout" card can pick the right routine instead of
 * falling back to alphabetical order. Phase 3's Active Workout will
 * replace this with real least-recently-completed semantics; this
 * column is the Phase 2b stand-in.
 *
 * Forward-only. Existing rows take the DEFAULT 0 and tie-break on name.
 */
const sql = `
ALTER TABLE workout_templates
  ADD COLUMN rotation_order INTEGER NOT NULL DEFAULT 0;
`;

export default sql;
