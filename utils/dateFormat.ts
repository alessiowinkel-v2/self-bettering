import { addDays, format, parseISO, subDays } from 'date-fns';

/**
 * Date helpers for screens. Centralized so the format strings are auditable
 * in one place and so tests can pass deterministic dates through.
 */

/** Returns the ISO date (YYYY-MM-DD) for a Date in local time. */
export function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Today as a YYYY-MM-DD string in local time. */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** Yesterday as a YYYY-MM-DD string in local time. */
export function yesterdayIso(now: Date = new Date()): string {
  return toIsoDate(subDays(now, 1));
}

/**
 * The Today header's date row, e.g. "Wednesday, May 6". Mirrors the
 * canonical lockup from the design PDF.
 */
export function formatTodayHeaderDate(now: Date = new Date()): string {
  return format(now, 'EEEE, MMM d');
}

/**
 * Weekday plus month-day, e.g. "Tuesday, May 5". Used on the Yesterday
 * card so the date context is explicit rather than inferred.
 */
export function formatWeekdayWithDate(iso: string): string {
  return format(parseISO(iso), 'EEEE, MMMM d');
}

/**
 * Shift a YYYY-MM-DD date by N days (positive or negative). Returns
 * YYYY-MM-DD. The intermediate Date constructor uses local time, which
 * is what every YYYY-MM-DD date in this app represents — keeps DST and
 * timezone semantics aligned with the rest of the date helpers.
 */
export function shiftIsoDate(iso: string, deltaDays: number): string {
  return toIsoDate(addDays(parseISO(iso), deltaDays));
}

/**
 * Compact "last used" phrase for the Exercise Picker rows. Mirrors the
 * design PDF: "today" / "yesterday" today and yesterday, three-letter
 * weekday for the rest of the current week, "MMM d" beyond that.
 *
 *   0 days     → "today"
 *   1 day      → "yesterday"
 *   2–6 days   → "Sat"
 *   7+ days    → "Apr 24"
 *
 * Picker right-column only — kept here so the format string sits in the
 * same module as the rest of the calendar shorthand.
 */
export function formatExerciseLastUsed(input: {
  fromIso: string;
  todayIso: string;
}): string {
  const from = parseISO(input.fromIso);
  const today = parseISO(input.todayIso);
  const days = Math.max(
    0,
    Math.floor((today.getTime() - from.getTime()) / 86400000)
  );
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return format(from, 'EEE');
  return format(from, 'MMM d');
}
