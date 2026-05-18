# Lumen — Exercise History Implementation Prompt

Paste-ready brief for Claude Code. Exercise History was part of the original six-screen design pass (PDF pages 21–24) but was not implemented in the Phase 1 build. The 02-screens-status doc currently marks this screen as built — that's stale; it was never built. The seedDev comment referencing it as a future view confirms this.

## Surface

Exercise History — the per-exercise detail screen showing top-set progress over time, PRs at common rep ranges, and a reverse-chronological session history with expandable per-set rest times.

Entered from Active Workout by tapping an exercise's name header. Future entry points (from a hypothetical Exercise List or from Gym Home) are out of scope for now.

## Route

`app/exercise/[name].tsx` — name is the exercise name (URL-encoded), matching the existing pattern of `app/habit/[id].tsx`. Exercises are not a first-class entity with IDs in Lumen's schema; the name string is the key, joining across `sets.exercise_name`.

If a `[name]` segment with special characters proves brittle, use a hashed key generated client-side. Don't introduce an `exercises` table just for this.

## States designed (PDF pages 21–24)

| State | Mode | Trigger |
|---|---|---|
| Default — 23 sessions since Feb | Dark | exercise with 12+ sessions, chart visible, 5-rep + 8-rep PR row, expanded session showing rests |
| First session | Dark | exercise has exactly one logged session ever — no top-set row, no chart, no PR row, single history row, "More sessions, more shape." caption |
| 4 sessions, flatter chart | Dark | exercise with 2–9 sessions — chart visible but no PR row (insufficient data for clean PR derivation), history rows all collapsed |
| Light · default | Light | same as Dark · default on cream background |

## Design decisions locked

- **Breadcrumb eyebrow:** `PUSH A · TODAY` small-caps secondary, centered in the header bar on the back-chevron row. The routine name + relative date of the current workout, so you remember the context you came from. With no routine name (or no sessions at all) it falls back to a bare `EXERCISE`.
- **Title:** Exercise name in Fraunces 40px (e.g. "Bench press"). Matches the Habit Detail title treatment.
- **Subtitle:** `{N} sessions since {Month}.` in Fraunces italic muted. `First session.` for the single-session state.
- **Top set row:** Eyebrow `TOP SET` + value `82.5kg × 6 · today`. The "today" tail is the relative date label of the most recent session. The `kg` unit and the `· {date}` tail render a step smaller and quieter than the weight value. Hidden entirely in the single-session (first session) state — title, subtitle, then straight to history.
- **Chart:**
  - Hidden in first-session state.
  - Shown when sessions ≥ 2.
  - 1px line in a near-neutral warm grey — reads as a pencil mark, not a colored stroke. The accent is reserved for the dots.
  - Single filled accent dot on the most recent point. Two hollow accent rings on the two prior points. Earlier points have no dot, just the line.
  - X-axis labels: only the first, middle, and last session date, lowercase, small caption muted, no axis line, no grid.
  - Y-axis: no axis, no grid, no labels.
  - The chart plots top-set weight per session. Top set = heaviest weight × highest reps tiebreak.
  - Height: roughly the same as a habit-detail heatmap row band — visually quiet, not a hero.
- **PR row:** Two columns, `5-REP` and `8-REP` eyebrows, value `{kg} · {Mon Day}` below each. Shown only when the exercise has 10+ sessions AND has at least one logged set at both 5 reps and 8 reps. Otherwise hidden — the row doesn't shrink to one column.
- **No section rules.** `TOP SET`, the chart, the PR row, and the history label are separated by whitespace only — no hairline dividers between sections. The history list keeps its per-row dividers; nothing else is ruled. Matches the rest of the app.
- **History list:** Reverse-chronological session rows. Each row: weekday + date on left, top-set weight on right, expand chevron (points down collapsed, up expanded). PR pill (small hairline outline, Fraunces italic "PR" in accent) renders inline next to weight when that session set a top-set record for the exercise.
- **Expanded session row:** Reveals the full set list (`82.5kg × 6, 6, 5, 4`) and a `RESTS` block below: `set 1   1:32`, `set 2   1:45`, etc., tabular nums, em-dash for missing rests (last set typically has none). The most recent session row opens expanded by default only when the PR row is shown (10+ sessions); in the 2–9 session states every row opens collapsed.
- **Voice:** No "Personal Record!" or motivational copy. "PR" pill alone carries it. The "First session." and "More sessions, more shape." lines are the entirety of the empty-state voice.

## Voice strings

| String | Category |
|---|---|
| `{N} sessions since {Month}.` | sentence |
| `First session.` | sentence |
| `TOP SET` | label |
| `5-REP` / `8-REP` | label |
| `HISTORY` | label |
| `RESTS` | label |
| `More sessions, more shape.` | sentence — empty-state caption when one session |
| `PR` | label — pill, no period |
| `today` / `Sat` / `Apr 27` | label — relative date tail |
| `—` | for missing rest values |

All strings follow the three-bucket rule.

## Data shape

The screen reads from `sets` joined to `workouts`. No new tables.

Query plan (pseudo-SQL):

```sql
-- All sessions for this exercise, ordered newest first
SELECT
  w.id AS workout_id,
  w.started_at,
  w.template_name,                  -- for the breadcrumb on the most-recent
  s.set_number, s.kg, s.reps, s.logged_at
FROM sets s
JOIN workouts w ON w.id = s.workout_id
WHERE s.exercise_name = ?
ORDER BY w.started_at DESC, s.set_number ASC;
```

Derive in pure functions:
- `sessionsByWorkout(rows)` — group rows by `workout_id`, ordered.
- `topSet(sets)` — heaviest kg, tiebreak by reps.
- `chartPoints(sessions)` — `[{date, topSetKg}]` newest last for plotting left→right.
- `prsByRep(sessions, reps)` — heaviest weight ever logged at exactly that rep count, returns `{kg, date}` or null.
- `restsForSession(sessionSets)` — `logged_at[i+1] - logged_at[i]` for adjacent sets, last set's rest is null.
- `isTopSetPR(session, prior)` — true if this session's top-set weight exceeds the best top-set weight in any earlier session.

All of these are pure and unit-testable. Put them in `lib/exerciseHistory.ts` alongside the route.

## Components to build

- `ExerciseHistoryScreen` — the route entry, owns queries and passes derived data down.
- `TopSetChart` — SVG component, takes `points: {date, kg}[]`, renders the line + dots + minimal x-axis labels. Use `react-native-svg`. No chart library — the design is too specific (and quiet) to be worth the dependency.
- `PrRow` — two-column PR display, renders nothing if neither rep range has data.
- `SessionRow` — collapsed and expanded states, owns its expand toggle locally.
- `PrPill` — the small hairline outline + Fraunces italic "PR".

Match the existing component conventions — colocate styles, use the theme module, no inline magic numbers.

## Navigation hookup

In Active Workout, the exercise name header (`Bench press` Fraunces title at the top of the current exercise section) becomes tappable. Tap pushes to `/exercise/{name}`. Long-press is reserved for the swap-exercise flow (existing). Don't conflict.

Test the back navigation returns to the active workout in the correct state — workout in progress should not be torn down by navigating away.

## Acceptance

1. From Active Workout with bench press as current exercise, tap the exercise title — Exercise History opens with bench press data.
2. All four designed states reachable with seed data: load seedDev with exercises having 1, 4, and 23 session counts, plus one in light mode via theme override.
3. Chart renders to spec at all three populated densities. The single-session state does not show a chart.
4. PR pill renders on sessions that set a top-set record, and nowhere else. PR row appears only at 10+ sessions with both rep ranges represented.
5. Expanding a session reveals set list and rests. Rest values use tabular numerals and align right. Missing rest renders as em-dash.
6. Back navigation returns to Active Workout with the workout still running, timer intact.
7. Visual parity check via designer/critic subagent against PDF pages 21–24.

## Implementation order

1. Build `lib/exerciseHistory.ts` with the pure derivations and unit tests against fixture data. Get this right before any UI.
2. Build `TopSetChart` in isolation on a scratch screen with a few fixture point sets (1, 2, 4, 12, 23 points). Verify the dot-treatment rule (filled latest, two hollow rings, plain line earlier).
3. Build the route shell with mock-prop variants for the four states, render statically before wiring queries.
4. Wire the SQLite queries.
5. Hook up the navigation from Active Workout.
6. Run the designer/critic subagent.

## Things to fix on the way through

- The 02-screens-status doc lists Exercise History as ✅ Implemented. It isn't. After this lands, that entry stays ✅ but is now true. Update the doc as part of the same change.
- The seedDev comment at line 165 referring to Exercise History as future-work can be removed once the route exists.

## Out of scope

- Editing past sessions from this screen. Read-only.
- Deleting sessions. Read-only.
- Comparing two exercises. Single exercise only.
- Filter by rep range / date range. The whole history fits on one screen with scroll.
- Entry from anywhere other than Active Workout. Future surfaces (Exercise List, links from Gym Home) come later.

## Voice reminder

Same as every prompt: short, declarative, ends with a period, no exclamation marks, no shame, no motivational copy. The "More sessions, more shape." line is the model — observation, not encouragement.
