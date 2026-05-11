/**
 * Migration 0004 — sets uniqueness.
 *
 * Adds UNIQUE(workout_id, exercise_name, set_number) to the sets table so
 * a double-tap on the Log button can no longer produce two rows for the
 * same logical set. The set's primary key (`id`) is a ts36-derived string
 * that differs between the two inserts even though the logical tuple is
 * the same — hence the need for a logical UNIQUE on top of the surrogate
 * key.
 *
 * SQLite cannot ALTER TABLE ADD CONSTRAINT, so this follows the standard
 * rename → recreate → copy → drop dance:
 *   1. Rename the existing sets table to sets_old.
 *   2. Create the new sets table with the UNIQUE constraint.
 *   3. Copy rows from sets_old into sets via INSERT OR IGNORE so any
 *      pre-existing duplicate tuples are silently dropped rather than
 *      failing the migration. The earliest row (by SQLite's rowid order
 *      under SELECT *) wins — acceptable here because all known
 *      duplicates come from the double-tap bug and the rows are
 *      semantically equivalent.
 *   4. Drop sets_old.
 *   5. Recreate the idx_sets_workout_id index that 0001_init defined —
 *      it does not survive the rename and the read path in
 *      getSetsForWorkout depends on it.
 *
 * Forward-only. The migration runner has no rollback path, so the down
 * SQL is preserved here as a comment for future-reader intent — not as
 * something the runner can apply.
 *
 * Rollback (manual, only if needed):
 *   ALTER TABLE sets RENAME TO sets_new;
 *   CREATE TABLE sets (
 *     id TEXT PRIMARY KEY NOT NULL,
 *     workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
 *     exercise_name TEXT NOT NULL,
 *     set_number INTEGER NOT NULL,
 *     kg REAL,
 *     reps INTEGER,
 *     logged_at TEXT NOT NULL
 *   );
 *   INSERT INTO sets SELECT * FROM sets_new;
 *   DROP TABLE sets_new;
 *   CREATE INDEX idx_sets_workout_id ON sets(workout_id);
 */
const sql = `
ALTER TABLE sets RENAME TO sets_old;

CREATE TABLE sets (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  kg REAL,
  reps INTEGER,
  logged_at TEXT NOT NULL,
  UNIQUE(workout_id, exercise_name, set_number)
);

INSERT OR IGNORE INTO sets (id, workout_id, exercise_name, set_number, kg, reps, logged_at)
  SELECT id, workout_id, exercise_name, set_number, kg, reps, logged_at
    FROM sets_old;

DROP TABLE sets_old;

CREATE INDEX IF NOT EXISTS idx_sets_workout_id
  ON sets(workout_id);
`;

export default sql;
