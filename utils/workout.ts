import type { SetRow } from '../db/sets';

/**
 * Active Workout formatters and small helpers. Pure functions, no
 * dates beyond the in-args — callers pass `now` explicitly so the
 * screen's setInterval-driven re-render is the only time source.
 */

/**
 * Elapsed time since workout start. Returns "mm:ss" under 60 minutes,
 * "h:mm:ss" from 60 minutes onward. Matches PDF page 15 ("32:14") and
 * page 18 ("46:08") — same screen, format flips only after a long
 * session crosses the hour mark.
 */
export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Rest-timer countdown. Always "m:ss" — rest is always under an hour.
 * "1:12" matches PDF page 16's running countdown.
 */
export function formatRest(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * "47 minutes" / "1 minute" — singular/plural aware. Workouts shorter
 * than a minute round up to "1 minute" rather than rendering "0 minutes"
 * (which reads as a bug). The Done takeover composes this as
 * "Done. {N minutes}." in displayItalic Fraunces.
 */
export function formatDurationMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

/**
 * Display kg with at most one decimal, trimming a trailing `.0`. The
 * SetRow and numeric-pad display both reach for this — "82.5" stays,
 * "85" stays, "85.0" collapses to "85". null returns null (caller
 * decides whether to render a placeholder).
 */
export function formatKg(kg: number | null): string | null {
  if (kg === null) return null;
  const rounded = Math.round(kg * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

/**
 * "82.5kg × 6, 6, 5, 4" — the LAST line under the exercise header and
 * the previous-exercise summary row. Uses the FIRST set's weight as
 * the representative load (typical when a working-set scheme stays at
 * one weight across sets); if weights vary, the first set still reads
 * as the headline and the reps tell the rest of the story.
 *
 * Returns null when there's nothing to summarize — caller should hide
 * the LAST line entirely on a first-ever exercise.
 */
export function formatLastSetsLine(
  sets: ReadonlyArray<Pick<SetRow, 'kg' | 'reps'>>
): string | null {
  if (sets.length === 0) return null;
  const firstKg = sets[0].kg;
  const kgStr = firstKg !== null ? formatKg(firstKg) : null;
  const repsStr = sets
    .map((s) => (s.reps !== null ? s.reps.toString() : '—'))
    .join(', ');
  if (kgStr === null) return repsStr;
  return `${kgStr}kg × ${repsStr}`;
}

/**
 * "Incline DB press   20kg · 8, 8, 7" — the dim previous-exercise
 * row above the current exercise on the Active Workout screen (PDF
 * page 15). Same kg+reps spine as formatLastSetsLine but separated by
 * a single bullet, since the row is structural rather than labeled
 * with a "LAST" prefix.
 *
 * Returns just the exercise name when no sets exist (impossible in
 * the natural flow — the only way an exercise has zero sets is if
 * the user reaches the next exercise without logging anything, which
 * the screen flow doesn't allow).
 */
export function formatPreviousExerciseSummary(
  name: string,
  sets: ReadonlyArray<Pick<SetRow, 'kg' | 'reps'>>
): string {
  if (sets.length === 0) return name;
  const firstKg = sets[0].kg;
  const kgStr = firstKg !== null ? formatKg(firstKg) : null;
  const repsStr = sets
    .map((s) => (s.reps !== null ? s.reps.toString() : '—'))
    .join(', ');
  if (kgStr === null) return `${name}    ${repsStr}`;
  return `${name}    ${kgStr}kg · ${repsStr}`;
}

/**
 * "4 × 5–8" / "3 × 10" — the prescription subtitle below the
 * exercise name. Min === max renders as a single number; otherwise an
 * en-dash range.
 */
export function formatPrescription(
  setCount: number,
  repRange: readonly [number, number]
): string {
  const [min, max] = repRange;
  const rep = min === max ? `${min}` : `${min}–${max}`;
  return `${setCount} × ${rep}`;
}
