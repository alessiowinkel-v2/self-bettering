import { format, parseISO, subDays } from 'date-fns';

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
