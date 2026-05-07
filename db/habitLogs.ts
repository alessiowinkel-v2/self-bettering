import type { HabitLog, HabitStatus } from '../state/types';
import { getDB } from './db';
import { habitLogId } from './ids';

/**
 * Habit log data access. One row per (habit_id, date). Streak math reads
 * straight from these rows — there is no denormalized streak column.
 */

type HabitLogRow = {
  habit_id: string;
  date: string;
  status: HabitStatus;
};

function rowToLog(row: HabitLogRow): HabitLog {
  return {
    habitId: row.habit_id,
    date: row.date,
    status: row.status,
  };
}

export async function getLogsForDate(date: string): Promise<ReadonlyArray<HabitLog>> {
  const db = await getDB();
  const rows = await db.getAllAsync<HabitLogRow>(
    `SELECT habit_id, date, status
       FROM habit_logs
      WHERE date = ?;`,
    [date]
  );
  return rows.map(rowToLog);
}

/**
 * Upsert a log. The UNIQUE(habit_id, date) constraint makes ON CONFLICT
 * trivial — a second tap on Held/Slipped overwrites the first.
 */
export async function logHabit(input: {
  habitId: string;
  date: string;
  status: HabitStatus;
}): Promise<void> {
  const db = await getDB();
  const id = habitLogId(input.habitId);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO habit_logs (id, habit_id, date, status, logged_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(habit_id, date) DO UPDATE SET
       status = excluded.status,
       logged_at = excluded.logged_at;`,
    [id, input.habitId, input.date, input.status, now]
  );
}

/**
 * Current streak for a habit, walking backwards from `throughDate`. A
 * `held` log increments the streak; anything else (a `slipped` log OR a
 * day with no log) breaks it. The walk stops as soon as the streak breaks
 * or the date precedes the habit's creation.
 *
 * The function fetches the habit's `createdOn` and `paused_at` itself
 * rather than taking them as input — keeps callers from threading stale
 * dates if a habit is reset or paused, and keeps the signature minimal
 * at the call site.
 *
 * Paused-clamp: when paused_at is non-null, the effective end of the walk
 * is min(pausedDate, throughDate). The intent is that pausing freezes the
 * streak — days after the pause are neither held nor slipped, they are
 * "off the books", so they must not be treated as gaps that would zero
 * the streak. Active habits (paused_at IS NULL) are unaffected: the
 * effective end stays equal to throughDate.
 */
export async function getStreakForHabit(input: {
  habitId: string;
  throughDate: string;
}): Promise<number> {
  const db = await getDB();
  const habitRow = await db.getFirstAsync<{
    created_on: string;
    paused_at: string | null;
  }>(
    `SELECT created_on, paused_at FROM habits WHERE id = ?;`,
    [input.habitId]
  );
  if (!habitRow) return 0;
  const createdOn = habitRow.created_on;

  // If the habit is paused, freeze the walk at the pause date. Slicing
  // the ISO timestamp's date portion is safe because paused_at is always
  // written via toISOString() and the local-time pause day is what we
  // want to anchor to (matching how throughDate is also a local-time
  // YYYY-MM-DD).
  const pausedDate = habitRow.paused_at
    ? habitRow.paused_at.slice(0, 10)
    : null;
  const effectiveThroughDate =
    pausedDate !== null && pausedDate < input.throughDate
      ? pausedDate
      : input.throughDate;

  const rows = await db.getAllAsync<{ date: string; status: HabitStatus }>(
    `SELECT date, status
       FROM habit_logs
      WHERE habit_id = ?
        AND date <= ?
        AND date >= ?
      ORDER BY date DESC;`,
    [input.habitId, effectiveThroughDate, createdOn]
  );

  // Index logs by date for O(1) lookup as we walk backwards day by day.
  const byDate = new Map<string, HabitStatus>();
  for (const r of rows) byDate.set(r.date, r.status);

  let streak = 0;
  let cursor = effectiveThroughDate;
  while (cursor >= createdOn) {
    const status = byDate.get(cursor);
    if (status === 'held') {
      streak += 1;
    } else {
      // Slip OR gap breaks the streak.
      break;
    }
    cursor = previousIsoDate(cursor);
  }
  return streak;
}

/**
 * ISO-only date math (no Date object). Avoids timezone pitfalls — the
 * input is "YYYY-MM-DD" in local time and the output is the day before.
 */
function previousIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
