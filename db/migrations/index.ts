/**
 * Static migration manifest. Every migration is imported here in order
 * and stamped with its version + name. The migrate runner reads this list
 * and applies anything not already recorded in the `_migrations` table.
 *
 * Adding a migration:
 *   1. Create db/migrations/NNNN_name.ts that default-exports the SQL.
 *   2. Append a record to MIGRATIONS below. Keep version monotonic.
 *
 * Filename prefix is zero-padded so lexicographic sort matches numeric
 * sort, but order in this array is what the runner trusts.
 */

import migration0001 from './0001_init';
import migration0002 from './0002_workout_template_rotation_order';
import migration0003 from './0003_habits_sort_order';
import migration0004 from './0004_sets_unique';
import migration0005 from './0005_habits_reminder_time';

export type Migration = {
  version: number;
  name: string;
  sql: string;
};

export const MIGRATIONS: ReadonlyArray<Migration> = [
  { version: 1, name: '0001_init', sql: migration0001 },
  {
    version: 2,
    name: '0002_workout_template_rotation_order',
    sql: migration0002,
  },
  { version: 3, name: '0003_habits_sort_order', sql: migration0003 },
  { version: 4, name: '0004_sets_unique', sql: migration0004 },
  { version: 5, name: '0005_habits_reminder_time', sql: migration0005 },
];
