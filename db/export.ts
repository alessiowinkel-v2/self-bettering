import { getDB } from './db';

/**
 * Builds the JSON payload Settings → "Export to JSON." writes to disk.
 *
 * Shape: one camelCase field per domain table, plus a top-level
 * `schemaVersion` carrying the highest applied `_migrations.version`.
 * Phase 4 Import will validate that schemaVersion matches the bundle's
 * latest migration before applying; out of scope here is HOW Import
 * handles mismatches — only that Export writes the field.
 *
 * SELECT * deliberately included: the Export is a faithful dump of
 * what's on disk, not a curated subset. Every column ships, including
 * lifecycle audit fields (paused_at, deleted_at, created_at,
 * updated_at). If a future schema adds columns, they appear in the
 * dump automatically — schemaVersion is the contract for Import to
 * decide what to do with them.
 *
 * Tags and exercises stay as JSON-encoded strings (mirrors the
 * column type). Import will JSON.parse them; no need to double-decode
 * here only to re-encode at write time.
 */

export type ExportPayload = {
  schemaVersion: number;
  exportedAt: string;
  habits: ReadonlyArray<Record<string, unknown>>;
  habitLogs: ReadonlyArray<Record<string, unknown>>;
  journalEntries: ReadonlyArray<Record<string, unknown>>;
  workoutTemplates: ReadonlyArray<Record<string, unknown>>;
  workouts: ReadonlyArray<Record<string, unknown>>;
  sets: ReadonlyArray<Record<string, unknown>>;
};

export async function buildExportPayload(): Promise<ExportPayload> {
  const db = await getDB();

  // schemaVersion = MAX(_migrations.version). _migrations is created
  // by runMigrations before any other table, so it always exists by
  // the time Export runs — defaulting to 0 keeps the contract honest
  // for a hypothetical empty table.
  const versionRow = await db.getFirstAsync<{ v: number | null }>(
    `SELECT MAX(version) AS v FROM _migrations;`
  );
  const schemaVersion = versionRow?.v ?? 0;

  const [
    habits,
    habitLogs,
    journalEntries,
    workoutTemplates,
    workouts,
    sets,
  ] = await Promise.all([
    db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM habits ORDER BY created_on ASC, id ASC;`
    ),
    db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM habit_logs ORDER BY date ASC, habit_id ASC;`
    ),
    db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM journal_entries ORDER BY date ASC;`
    ),
    db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM workout_templates ORDER BY id ASC;`
    ),
    db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM workouts ORDER BY started_at ASC, id ASC;`
    ),
    db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM sets ORDER BY workout_id ASC, set_number ASC;`
    ),
  ]);

  return {
    schemaVersion,
    exportedAt: new Date().toISOString(),
    habits,
    habitLogs,
    journalEntries,
    workoutTemplates,
    workouts,
    sets,
  };
}
