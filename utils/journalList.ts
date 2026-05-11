import { format, parseISO } from 'date-fns';
import type { JournalEntry } from '../state/types';

/**
 * Journal List grouping helpers. Pure functions over date strings —
 * no DB, no time-of-day, fully unit-testable.
 */

export type JournalMonthGroup = {
  /** Year extracted from any entry in the group. Same across the group. */
  year: number;
  /** 1-12 month index. Same across the group. */
  monthIndex: number;
  /** Header label, e.g. "MAY" or cross-year "MAY 2025". */
  label: string;
  entries: ReadonlyArray<JournalEntry>;
};

/**
 * Groups a newest-first list of entries into month buckets, preserving
 * order. The label drops the year for entries inside the same year as
 * the most recent entry (typical case: "MAY"); for entries from a
 * prior year the year is appended ("MAY 2025") so a long-history list
 * doesn't quietly conflate two different Mays.
 *
 * Reference year: the year of `entries[0]`. Falls back to undefined
 * when the list is empty, which makes the labelling logic a no-op
 * (no groups exist to label).
 *
 * Assumes input is sorted newest-first (date DESC). The SQL ORDER BY
 * in getAllJournalEntries guarantees this; future callers passing a
 * mixed-order list would break the cross-year reference-year logic.
 */
export function groupEntriesByMonth(
  entries: ReadonlyArray<JournalEntry>,
): ReadonlyArray<JournalMonthGroup> {
  if (entries.length === 0) return [];

  const referenceYear = parseISO(entries[0].date).getFullYear();

  const groups: JournalMonthGroup[] = [];
  let current: { entries: JournalEntry[]; year: number; monthIndex: number } | null = null;

  for (const entry of entries) {
    const parsed = parseISO(entry.date);
    const year = parsed.getFullYear();
    const monthIndex = parsed.getMonth() + 1;

    if (current === null || current.year !== year || current.monthIndex !== monthIndex) {
      if (current !== null) {
        groups.push(finalizeGroup(current, referenceYear));
      }
      current = { entries: [], year, monthIndex };
    }
    current.entries.push(entry);
  }
  if (current !== null) {
    groups.push(finalizeGroup(current, referenceYear));
  }
  return groups;
}

function finalizeGroup(
  group: { entries: JournalEntry[]; year: number; monthIndex: number },
  referenceYear: number,
): JournalMonthGroup {
  // parseISO + format keeps the month name driven by date-fns' locale
  // tables — same source the rest of the app uses for "Wednesday,
  // May 6" / "May 6" etc.
  const sample = parseISO(group.entries[0].date);
  const monthName = format(sample, 'MMMM').toUpperCase();
  const label = group.year === referenceYear ? monthName : `${monthName} ${group.year}`;
  return {
    year: group.year,
    monthIndex: group.monthIndex,
    label,
    entries: group.entries,
  };
}
