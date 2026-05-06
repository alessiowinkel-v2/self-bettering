/**
 * Time-of-day greeting. Returns one of three values that map to the Today
 * header's secondary line: "Morning.", "Evening.", "Night."
 *
 * Boundaries (per design):
 *   05:00 to 16:59 — morning  (afternoon folds into morning by design)
 *   17:00 to 20:59 — evening
 *   21:00 to 04:59 — night
 *
 * The function accepts an injected `now` so dev hooks can preview other
 * states without changing the phone clock:
 *
 *   greet(new Date('2026-05-06T19:00:00'))  // 'evening'
 */

export type Greeting = 'morning' | 'evening' | 'night';

export function greet(now: Date = new Date()): Greeting {
  const hour = now.getHours();
  if (hour >= 5 && hour < 17) return 'morning';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Display label for a greeting. Always terminated with a period to match
 * the calm-notebook voice.
 */
export function greetingLabel(g: Greeting): string {
  switch (g) {
    case 'morning':
      return 'Morning.';
    case 'evening':
      return 'Evening.';
    case 'night':
      return 'Night.';
  }
}
