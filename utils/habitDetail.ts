import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import type { HabitLog, HabitStatus } from '../state/types';
import { shiftIsoDate, toIsoDate } from './dateFormat';

/**
 * Pure helpers for the Habit Detail screen. Date math, the
 * logs-to-cells transformations, and the saturation ramp live here so
 * the screen and its components stay declarative and the logic is
 * unit-testable in isolation.
 */

/**
 * "Since {date}." anchor for the line under the habit name.
 *
 * If the habit has never slipped, the run started on createdOn — the
 * habit's first day is the start of its current run.
 *
 * If there is a most-recent slip, the run started the day AFTER that
 * slip. A slip on Apr 11 means the current held run begins Apr 12, so
 * "Since Apr 12." is the right anchor. When the slip is today, we
 * still resolve to the day after for consistency, but callers should
 * suppress the line on day-one habits where the run has no history
 * worth referencing.
 *
 * Returns an unpunctuated short date ("Apr 12"). Callers wrap it with
 * "Since {x}." themselves so the formatter stays focused on the date.
 */
export function sinceDate(input: {
  createdOn: string;
  mostRecentSlipDate: string | null;
}): string {
  const anchorIso =
    input.mostRecentSlipDate === null
      ? input.createdOn
      : shiftIsoDate(input.mostRecentSlipDate, 1);
  return format(parseISO(anchorIso), 'MMM d');
}

const HEATMAP_COLUMNS = 13;
const HEATMAP_ROWS = 7;
export const HEATMAP_TOTAL_CELLS = HEATMAP_COLUMNS * HEATMAP_ROWS;

/**
 * Compute the week-aligned heatmap window for a given "today". The
 * grid runs Monday-to-Sunday top-to-bottom (column-major). The
 * rightmost column is the current calendar week, with Monday at the
 * top and Sunday at the bottom; today sits at the row matching its
 * weekday. Earlier columns are full Monday-Sunday weeks going back.
 *
 * The window therefore extends:
 *   start = Monday of (current week - 12 weeks)
 *   end   = Sunday of current week (later than today on most days)
 *
 * Days after today within the current week render as empty/future,
 * which the screen treats the same as "no log on that day".
 */
export function heatmapWindow(today: string): {
  start: string;
  end: string;
} {
  const todayDate = parseISO(today);
  const monday = startOfWeek(todayDate, { weekStartsOn: 1 });
  // 12 weeks back from this week's Monday gives us a 13-column grid
  // counting the current week as the rightmost column.
  const start = toIsoDate(addDays(monday, -7 * (HEATMAP_COLUMNS - 1)));
  const end = toIsoDate(addDays(monday, HEATMAP_ROWS - 1));
  return { start, end };
}

/**
 * Heatmap cell. Heatmap90 reads these directly — no further per-cell
 * computation in render.
 *
 *   runPosition: 1-indexed position within the held run this cell
 *   belongs to (0 when not held). Used for graduated saturation.
 */
export type HeatmapCell = {
  date: string;
  status: 'held' | 'slipped' | 'pre-creation' | 'empty';
  runPosition: number;
};

/**
 * Build cells for the week-aligned grid. The window is derived from
 * `today` via heatmapWindow; callers supply only `today`, `createdOn`,
 * and the logs covering that window. Cells outside [createdOn, today]
 * resolve as 'pre-creation' (older than the habit) or 'empty' (future
 * days of the current calendar week).
 *
 * Held cells get a runPosition in a single forward pass so the
 * saturation gradient can read them in render without a second walk.
 */
export function buildHeatmapCells(input: {
  today: string;
  createdOn: string;
  logs: ReadonlyArray<HabitLog>;
}): ReadonlyArray<HeatmapCell> {
  const { start, end } = heatmapWindow(input.today);
  const byDate = new Map<string, HabitStatus>();
  for (const l of input.logs) byDate.set(l.date, l.status);

  const cells: HeatmapCell[] = [];
  let cursor = start;
  while (cursor <= end) {
    let status: HeatmapCell['status'];
    if (cursor < input.createdOn) {
      status = 'pre-creation';
    } else if (cursor > input.today) {
      // Future days of the current week — neither held nor slipped,
      // just blank slots. Mirrors how empty/missed past days render.
      status = 'empty';
    } else {
      const logged = byDate.get(cursor);
      status = logged === 'held' ? 'held' : logged === 'slipped' ? 'slipped' : 'empty';
    }
    cells.push({ date: cursor, status, runPosition: 0 });
    cursor = shiftIsoDate(cursor, 1);
  }

  // Forward pass: assign runPosition. A non-held cell resets the run
  // counter; a held cell increments it.
  let runLength = 0;
  for (const cell of cells) {
    if (cell.status === 'held') {
      runLength += 1;
      cell.runPosition = runLength;
    } else {
      runLength = 0;
    }
  }

  return cells;
}

export type WeekDot = {
  /** ISO date the dot represents. */
  date: string;
  /** "M" | "T" | "W" | "T" | "F" | "S" | "S" — letter under the dot. */
  letter: string;
  /**
   * 'held' | 'slipped' | 'empty' — empty covers both not-yet-logged
   * past days and future days within the current week.
   */
  status: 'held' | 'slipped' | 'empty';
  /** True when this dot represents today (gets a ring overlay). */
  isToday: boolean;
};

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/**
 * Build the THIS WEEK row, Mon → Sun. Week start is locked to Monday
 * (European convention; matches the design PDF). The caller passes
 * the full window's logs — buildWeekDots filters via Map lookup so
 * older logs are silently ignored, no extra DB round-trip required.
 */
export function buildWeekDots(input: {
  today: string;
  logs: ReadonlyArray<HabitLog>;
}): ReadonlyArray<WeekDot> {
  const todayDate = parseISO(input.today);
  const weekStart = startOfWeek(todayDate, { weekStartsOn: 1 });

  const byDate = new Map<string, HabitStatus>();
  for (const l of input.logs) byDate.set(l.date, l.status);

  const dots: WeekDot[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = toIsoDate(addDays(weekStart, i));
    const logged = byDate.get(date);
    const status: WeekDot['status'] =
      logged === 'held' ? 'held' : logged === 'slipped' ? 'slipped' : 'empty';
    dots.push({
      date,
      letter: WEEKDAY_LETTERS[i],
      status,
      isToday: date === input.today,
    });
  }
  return dots;
}

/**
 * Saturation ramp for a held heatmap cell. The standalone-day case
 * gets a fixed mid-opacity so a single held day reads as present
 * without faking a streak shape. Capped at HELD_RUN_SATURATION_CAP
 * cells so a long streak (e.g. 24 days) shows uniformly saturated
 * tail cells rather than the gradient drifting past max.
 */
export const HELD_RUN_SATURATION_CAP = 14;
export function heldCellOpacity(runPosition: number): number {
  if (runPosition <= 0) return 0;
  if (runPosition === 1) return 0.5;
  const ramp = Math.min(1, runPosition / HELD_RUN_SATURATION_CAP);
  return 0.4 + 0.6 * ramp;
}

/**
 * Lifecycle variant for Habit Detail's branching. Encodes which of
 * the design's discrete states this habit is in, so the screen and
 * StatusLabel both read from a single decision rather than computing
 * day-one / just-slipped / paused / archived independently.
 *
 * Priority (design's variant precedence):
 *   archived  → "ARCHIVED."
 *   paused    → "PAUSED."
 *   slipped   → "STARTED OVER TODAY." + calendar shows the slip
 *   day-one   → "DAY ONE." + no calendar / Best / Since
 *   normal    → "CURRENT STREAK"
 *
 * Day-one is checked AFTER slipped so a habit created today and then
 * slipped reads STARTED OVER TODAY. (matches the just-slipped variant
 * in the design rather than overriding to DAY ONE.).
 */
export type HabitLifecycleVariant =
  | 'archived'
  | 'paused'
  | 'just-slipped'
  | 'day-one'
  | 'normal';

export function getHabitLifecycleVariant(input: {
  createdOn: string;
  today: string;
  todayStatus: HabitStatus | null;
  pausedAt: string | null;
  deletedAt: string | null;
  mostRecentSlipDate: string | null;
}): HabitLifecycleVariant {
  if (input.deletedAt !== null) return 'archived';
  if (input.pausedAt !== null) return 'paused';
  if (input.todayStatus === 'slipped') return 'just-slipped';
  if (input.createdOn === input.today && input.mostRecentSlipDate === null) {
    return 'day-one';
  }
  return 'normal';
}
