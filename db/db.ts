import * as SQLite from 'expo-sqlite';

/**
 * Singleton SQLite handle. Lazily opened on first call. Concurrent first
 * callers share the same in-flight promise so the database is opened
 * exactly once per process.
 *
 * The handle survives Fast Refresh. Resetting it requires a full app
 * reload — by design, since SQLite handles are not safe to recreate on
 * the fly while statements are mid-flight.
 *
 * dbPromise is sticky on rejection. If openDatabaseAsync rejects (rare —
 * usually disk/permissions issues), every subsequent getDB() reuses the
 * rejected promise. The "Try again." affordance on BootErrorScreen will
 * not recover this class of failure; force-quit and relaunch is the
 * recovery path. Migration failures DO recover via retry because
 * runMigrations re-enters the unapplied loop on each call.
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const DB_NAME = 'lumen.db';

export function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      // Foreign keys are off by default in SQLite. Turn them on for every
      // handle so ON DELETE CASCADE actually fires.
      await db.execAsync('PRAGMA foreign_keys = ON;');
      return db;
    });
  }
  return dbPromise;
}
