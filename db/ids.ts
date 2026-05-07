/**
 * ID helpers. The shape of every row's id is decided at the data layer,
 * not the call site, so the conventions stay consistent across modules.
 *
 *   habits             h-${slug}-${ts36}
 *   habit_logs         hl-${ts36}-${habitId-tail}
 *   journal_entries    j-${dateStr}            (date is the natural key)
 *   workouts           w-${ts36}
 *   sets               s-${ts36}-${setNum}
 *   workout_templates  wt-${slug}
 *
 * `slug` lowercases, replaces non-alphanumeric runs with `-`, and trims
 * leading/trailing dashes. `ts36` = `Date.now().toString(36)`.
 */

export function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ts36(): string {
  return Date.now().toString(36);
}

export function habitId(name: string): string {
  return `h-${slug(name)}-${ts36()}`;
}

export function habitLogId(habitIdValue: string): string {
  // Tail of the habit id keeps debugging readable without bloating the row.
  const tail = habitIdValue.slice(-6);
  return `hl-${ts36()}-${tail}`;
}

export function journalEntryId(dateStr: string): string {
  return `j-${dateStr}`;
}

export function workoutId(): string {
  return `w-${ts36()}`;
}

export function setId(setNumber: number): string {
  return `s-${ts36()}-${setNumber}`;
}

export function workoutTemplateId(name: string): string {
  return `wt-${slug(name)}`;
}
