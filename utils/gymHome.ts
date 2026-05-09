import { addDays, differenceInCalendarDays, parseISO, startOfWeek } from 'date-fns';
import type { WeekDot } from '../components/primitives';
import { toIsoDate } from './dateFormat';

/**
 * Pure helpers for the Gym Home screen. Date math + the routine-row
 * "Last · ..." caption. Kept in isolation so the screen stays
 * declarative and the formatting is unit-testable without RN.
 */

/**
 * Monday-anchored ISO week range covering `today`. Both bounds are
 * inclusive YYYY-MM-DD strings. Mirrors heatmapWindow's Monday-start
 * convention (European; matches the design PDF).
 */
export function getWeekRange(today: string): { start: string; end: string } {
  const todayDate = parseISO(today);
  const monday = startOfWeek(todayDate, { weekStartsOn: 1 });
  return {
    start: toIsoDate(monday),
    end: toIsoDate(addDays(monday, 6)),
  };
}

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/**
 * Build the Gym Home week strip, Mon → Sun. A day with one or more
 * completed workouts renders as 'filled'; everything else (past,
 * future, today-without-a-workout) renders as 'empty'. Workouts have
 * no slipped equivalent, so this builder never emits 'outlined'.
 */
export function buildGymWeekDots(input: {
  today: string;
  completedDates: ReadonlyArray<string>;
}): ReadonlyArray<WeekDot> {
  const { start } = getWeekRange(input.today);
  const startDate = parseISO(start);
  const completedSet = new Set(input.completedDates);

  const dots: WeekDot[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = toIsoDate(addDays(startDate, i));
    dots.push({
      date,
      letter: WEEKDAY_LETTERS[i],
      status: completedSet.has(date) ? 'filled' : 'empty',
      isToday: date === input.today,
    });
  }
  return dots;
}

/**
 * Short relative-date phrase for routine rows.
 *   today       → "today"
 *   yesterday   → "yesterday"
 *   2-6 days    → "{n} days ago"
 *   >6 days     → "{n} days ago" (cap not applied at this scale)
 *   null input  → "never"
 *
 * Returns the bare phrase without leading "Last ·" or trailing
 * period — the row composes the full sentence so the formatter stays
 * focused on relative-date wording alone.
 */
export function formatRelativeDate(input: {
  fromDate: string | null;
  today: string;
}): string {
  if (input.fromDate === null) return 'never';
  const days = differenceInCalendarDays(
    parseISO(input.today),
    parseISO(input.fromDate)
  );
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}
