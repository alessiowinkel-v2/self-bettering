const UNITS: Readonly<Record<string, string>> = {
  minute: 'm',
  minutes: 'm',
};

/**
 * Compact habit names for the Streaks chip row. Replaces "<n> <unit>"
 * with "<n><abbrev>" where unit is in the UNITS table. Only "minute" and
 * "minutes" today — extend the table when a future habit needs it.
 *
 * Examples: "Read 20 minutes" → "Read 20m". "No nicotine" unchanged.
 *
 * Hyphenated forms ("20-minute walk") not handled. Extend when needed.
 */
export function abbreviateHabitName(name: string): string {
  // Decimals preserved: "20.5 minutes" → "20.5m".
  return name.replace(/\b(\d+)\s+([a-zA-Z]+)\b/g, (match, n: string, unit: string) => {
    const abbrev = UNITS[unit.toLowerCase()];
    return abbrev ? `${n}${abbrev}` : match;
  });
}
