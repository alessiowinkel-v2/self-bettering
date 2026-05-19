/**
 * Migration 0006 — drop workout template rotation order.
 *
 * The "Up next" rotation was removed: every workout is now startable
 * directly from its detail screen, with no app-picked next template.
 * The rotation_order column added in 0002 has no remaining readers, so
 * it is dropped.
 *
 * Forward-only. SQLite (Expo SDK 54) supports native DROP COLUMN, so
 * this is a single ALTER with no table rebuild.
 */
const sql = `
ALTER TABLE workout_templates DROP COLUMN rotation_order;
`;

export default sql;
