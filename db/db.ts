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
 * Sticky-rejection: if openDatabaseAsync ever rejects, dbPromise stays
 * holding the rejected promise for the rest of the process. Every
 * subsequent getDB() reuses it without retry. That's intentional — the
 * MigrationErrorScreen surfaces the failure to the user and there is no
 * recovery path short of a full app reload anyway.
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
