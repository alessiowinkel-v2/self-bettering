/**
 * Migration 0001 — initial schema.
 *
 * Tables:
 *   habits              — one row per habit. Soft-delete via deleted_at.
 *   habit_logs          — one row per habit per day. UNIQUE(habit_id, date).
 *   journal_entries     — one row per day. UNIQUE(date) acts as the natural key.
 *   workout_templates   — exercises as JSON (genuinely free-form for v1).
 *   workouts            — a session. completed_at IS NULL means in-progress.
 *   sets                — set rows belonging to a workout.
 *
 * Schema deviations from knowledge/claude-code-prompt.md:
 *   - habits has no `description` column. The design pass never references
 *     a habit description; deferred until Habit Detail picks up notes.
 *   - habits.created_on is a date (YYYY-MM-DD), while journal_entries
 *     and other tables use *_at timestamps. The asymmetry is intentional:
 *     habits are date-keyed for streak math, so the column carries the
 *     calendar day a habit began — not the timestamp it was inserted.
 *
 * Index strategy:
 *   - UNIQUE constraints already create a backing index — never duplicate.
 *   - Only add explicit indexes for query patterns the app actually uses.
 */
const sql = `
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_on TEXT NOT NULL,
  paused_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('held', 'slipped')),
  logged_at TEXT NOT NULL,
  UNIQUE(habit_id, date)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL UNIQUE,
  mood INTEGER,
  tags TEXT NOT NULL DEFAULT '[]',
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  exercises TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE RESTRICT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workouts_completed_at
  ON workouts(completed_at);

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  kg REAL,
  reps INTEGER,
  logged_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sets_workout_id
  ON sets(workout_id);
`;

export default sql;
