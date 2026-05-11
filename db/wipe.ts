import { getDB } from './db';

/**
 * Wipe every domain row from disk. Leaves `_migrations` intact so
 * schema state survives — the user gets an empty app, not an
 * unmigrated one. Mirrors the FK-respecting order used by the
 * dev-only seedDev: children before parents so ON DELETE RESTRICT
 * on workouts.template_id doesn't fire mid-wipe.
 *
 * Wrapped in a single transaction so a partial wipe can never leave
 * the DB in a half-cleared state.
 *
 * Side-effects upstream: callers should re-hydrate every store after
 * this resolves — useTodayStore, useHabitsListStore, useGymHomeStore
 * all cache rows that no longer exist.
 */
export async function wipeAllData(): Promise<void> {
  const db = await getDB();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM sets;
      DELETE FROM workouts;
      DELETE FROM workout_templates;
      DELETE FROM journal_entries;
      DELETE FROM habit_logs;
      DELETE FROM habits;
    `);
  });
}
