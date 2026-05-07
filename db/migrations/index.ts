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
];
