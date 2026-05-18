import type { HabitLog, HabitStatus } from '../state/types';
import { shiftIsoDate } from '../utils/dateFormat';
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
 * Logs for a habit in [startDate, endDate] inclusive, ordered ASC. The
 * range is bounded — there is intentionally no unbounded variant to avoid
 * pulling a habit's entire history into memory by accident. Heatmap90
 * and the THIS WEEK row both have a fixed window, so the bound fits.
 */
export async function getLogsForHabitInRange(input: {
  habitId: string;
  startDate: string;
  endDate: string;
}): Promise<ReadonlyArray<HabitLog>> {
  const db = await getDB();
  const rows = await db.getAllAsync<HabitLogRow>(
    `SELECT habit_id, date, status
       FROM habit_logs
      WHERE habit_id = ?
        AND date >= ?
        AND date <= ?
      ORDER BY date ASC;`,
    [input.habitId, input.startDate, input.endDate]
  );
  return rows.map(rowToLog);
}

/**
 * Most recent slip date for a habit on or before throughDate, or null
 * if the habit has never slipped. Used by the "Since {date}." line on
 * Habit Detail to anchor the date to the start of the current run
 * (day after the last slip), falling back to createdOn when never
 * slipped.
 */
export async function getMostRecentSlipDate(input: {
  habitId: string;
  throughDate: string;
}): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ date: string }>(
    `SELECT date
       FROM habit_logs
      WHERE habit_id = ?
        AND status = 'slipped'
        AND date <= ?
      ORDER BY date DESC
      LIMIT 1;`,
    [input.habitId, input.throughDate]
  );
  return row?.date ?? null;
}

/**
 * Longest held streak ever for a habit, on or before throughDate. Walks
 * the held logs in date order and tracks the longest run of
 * day-over-day held days. Single SQL fetch + O(n) JS reduce. At habit
 * scale (one row/day, max a few thousand) this is trivially cheap.
 *
 * Definition of "consecutive": held logs whose dates are exactly one
 * day apart. A slip OR a missing day breaks the run.
 */
export async function getBestStreak(input: {
  habitId: string;
  throughDate: string;
}): Promise<number> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT date
       FROM habit_logs
      WHERE habit_id = ?
        AND status = 'held'
        AND date <= ?
      ORDER BY date ASC;`,
    [input.habitId, input.throughDate]
  );
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const r of rows) {
    if (prev !== null && nextIsoDate(prev) === r.date) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = r.date;
  }
  return best;
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
 * Insert a 'held' log for every date in [startDate, endDate] inclusive
 * that has no existing row. NON-DESTRUCTIVE: ON CONFLICT DO NOTHING, so
 * any real held/slipped log already on those days is left untouched.
 * This is why logHabit can't be reused — it upserts and would overwrite.
 *
 * Used by the "Set streak" flow to materialize a declared pre-existing
 * streak. The range is bounded by the caller (start is a user-picked
 * date capped at today), so the day-by-day loop stays small. Wrapped in
 * a transaction so a partial backfill can't leave a half-applied run.
 */
export async function backfillHeldLogs(input: {
  habitId: string;
  startDate: string;
  endDate: string;
}): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    let cursor = input.startDate;
    while (cursor <= input.endDate) {
      await db.runAsync(
        `INSERT INTO habit_logs (id, habit_id, date, status, logged_at)
         VALUES (?, ?, ?, 'held', ?)
         ON CONFLICT(habit_id, date) DO NOTHING;`,
        [habitLogId(input.habitId), input.habitId, cursor, now]
      );
      cursor = shiftIsoDate(cursor, 1);
    }
  });
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
    deleted_at: string | null;
  }>(
    `SELECT created_on, paused_at, deleted_at FROM habits WHERE id = ?;`,
    [input.habitId]
  );
  if (!habitRow) return 0;
  const createdOn = habitRow.created_on;

  // If the habit is paused or archived, freeze the walk at that date.
  // Slicing the ISO timestamp's date portion is safe because paused_at
  // and deleted_at are always written via toISOString() and the local
  // calendar day is what we want to anchor to (matching how throughDate
  // is also a local-time YYYY-MM-DD). Pause and archive both intend
  // "freeze the streak as-of this day"; days after are off the books
  // and must not be treated as gaps that would zero the streak.
  const pausedDate = habitRow.paused_at
    ? habitRow.paused_at.slice(0, 10)
    : null;
  const deletedDate = habitRow.deleted_at
    ? habitRow.deleted_at.slice(0, 10)
    : null;
  const freezeDate =
    pausedDate !== null && deletedDate !== null
      ? pausedDate < deletedDate
        ? pausedDate
        : deletedDate
      : (pausedDate ?? deletedDate);
  const effectiveThroughDate =
    freezeDate !== null && freezeDate < input.throughDate
      ? freezeDate
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
 * ISO-only date math thin-wrappers around the shared shiftIsoDate
 * helper. Kept as named one-liners so the streak walks and the
 * forward-pass best-streak loop read at the call site.
 */
function previousIsoDate(iso: string): string {
  return shiftIsoDate(iso, -1);
}

function nextIsoDate(iso: string): string {
  return shiftIsoDate(iso, 1);
}
