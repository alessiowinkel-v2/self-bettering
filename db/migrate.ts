import { getDB } from './db';
import { MIGRATIONS } from './migrations';

/**
 * Forward-only migration runner. Compares the manifest in
 * db/migrations/index.ts against the `_migrations` table and applies any
 * missing version in order. Each migration runs inside a transaction so a
 * mid-migration crash leaves the table empty rather than half-applied.
 *
 * Idempotent: calling runMigrations twice in a row is a no-op on the
 * second call.
 */

type AppliedRow = { version: number };

export async function runMigrations(): Promise<void> {
  const db = await getDB();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = await db.getAllAsync<AppliedRow>(
    'SELECT version FROM _migrations ORDER BY version ASC;'
  );
  const applied = new Set(appliedRows.map((r) => r.version));

  // Defensive sort. The manifest is ordered, but a bad insert shouldn't
  // silently apply migrations out of order.
  const ordered = [...MIGRATIONS].sort((a, b) => a.version - b.version);

  for (const m of ordered) {
    if (applied.has(m.version)) continue;

    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.runAsync(
        'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?);',
        [m.version, m.name, new Date().toISOString()]
      );
    });
  }
}
