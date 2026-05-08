import type { JournalEntry, Mood } from '../state/types';
import { getDB } from './db';
import { journalEntryId } from './ids';

/**
 * Journal data access. One entry per day, keyed by date — UNIQUE(date)
 * makes upserts a single statement.
 */

type JournalRow = {
  id: string;
  date: string;
  mood: number | null;
  tags: string;
  body: string;
};

function rowToEntry(row: JournalRow): JournalEntry {
  let tags: ReadonlyArray<string> = [];
  try {
    const parsed: unknown = JSON.parse(row.tags);
    if (Array.isArray(parsed)) {
      tags = parsed.filter((t): t is string => typeof t === 'string');
    }
  } catch {
    // Corrupt JSON in a tags column should not crash the screen — fall
    // back to no tags. Re-saving the entry rewrites the column cleanly.
    tags = [];
  }
  return {
    date: row.date,
    mood: (row.mood as Mood | null) ?? null,
    tags,
    body: row.body,
  };
}

export async function getJournalEntryForDate(date: string): Promise<JournalEntry | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<JournalRow>(
    `SELECT id, date, mood, tags, body
       FROM journal_entries
      WHERE date = ?;`,
    [date]
  );
  return row ? rowToEntry(row) : null;
}

/**
 * Idempotent delete by date. Used by the journal editor when the user
 * clears all fields — body, mood, tags — on an existing entry. The
 * editor prefers a clean disk over a stale row that the future
 * Journal List would render as a blank preview. Succeeds whether or
 * not a row exists for the date (no upstream existence check needed).
 */
export async function deleteJournalEntry(date: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `DELETE FROM journal_entries WHERE date = ?;`,
    [date]
  );
}

/**
 * created_at is a write-time audit field. If a past date is edited,
 * this reflects when the row was inserted, not when the date occurred.
 * Journal List should sort by date (content), not created_at (audit).
 */
export async function upsertJournalEntry(entry: JournalEntry): Promise<void> {
  const db = await getDB();
  const id = journalEntryId(entry.date);
  const now = new Date().toISOString();
  const tagsJson = JSON.stringify(entry.tags);
  await db.runAsync(
    `INSERT INTO journal_entries (id, date, mood, tags, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       mood = excluded.mood,
       tags = excluded.tags,
       body = excluded.body,
       updated_at = excluded.updated_at;`,
    [id, entry.date, entry.mood, tagsJson, entry.body, now, now]
  );
}
