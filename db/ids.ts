/**
 * ID helpers. The shape of every row's id is decided at the data layer,
 * not the call site, so the conventions stay consistent across modules.
 *
 *   habits             h-${slug}-${ts36}
 *   habit_logs         hl-${ts36}-${habitId-tail}-${rand4}
 *   journal_entries    j-${dateStr}            (date is the natural key)
 *   workouts           w-${ts36}
 *   sets               s-${ts36}-${setNum}-${rand4}
 *
 * `slug` lowercases, replaces non-alphanumeric runs with `-`, and trims
 * leading/trailing dashes. `ts36` = `Date.now().toString(36)`.
 *
 * setId carries a `rand4` suffix because (ts36, setNumber) alone is not
 * unique: two exercises in the same workout share setNumber=1, and a
 * tight async loop (logSet for set 1 of each exercise, seedDev's nested
 * iteration over priorSets) can issue both inserts within the same
 * millisecond. The composite UNIQUE on (workout_id, exercise_name,
 * set_number) catches logical duplicates; rand4 protects the PK from
 * spurious collisions across distinct logical rows.
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

// 4 base36 chars (~1.7M values). Math.random is ~52 bits of entropy;
// truncating to 4 chars uses ~20. For a single-user personal app
// inserting at most a few dozen sets per workout, the birthday-paradox
// collision is negligible (probability < 1 in ~10^11 for 50 inserts).
function rand4(): string {
  return Math.random().toString(36).slice(2, 6);
}

export function habitId(name: string): string {
  return `h-${slug(name)}-${ts36()}`;
}

export function habitLogId(habitIdValue: string): string {
  // Tail of the habit id keeps debugging readable without bloating the row.
  const tail = habitIdValue.slice(-6);
  // rand4 for the same reason setId carries it: backfillHeldLogs issues a
  // tight async loop of inserts, many landing within one millisecond, so
  // ts36 + tail alone collide on the PK. UNIQUE(habit_id, date) still
  // catches logical duplicates; rand4 protects the id column.
  return `hl-${ts36()}-${tail}-${rand4()}`;
}

export function journalEntryId(dateStr: string): string {
  return `j-${dateStr}`;
}

export function workoutId(): string {
  return `w-${ts36()}`;
}

export function templateId(name: string): string {
  return `wt-${slug(name)}-${ts36()}`;
}

export function setId(setNumber: number): string {
  return `s-${ts36()}-${setNumber}-${rand4()}`;
}
