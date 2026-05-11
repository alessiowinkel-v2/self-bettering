# Lumen — Exercise Picker Handoff Bundle (Additive)

This bundle is additive to the original six-screen handoff. It covers the Exercise Picker surface, designed after the original 32-page PDF export.

For the original six screens (Today, Habit Detail, Journal Editor, Active Workout, Exercise History, Gym Home) refer to the original handoff bundle and the 32-page PDF in project knowledge.

---

## Surface

Exercise Picker — a full-height modal sheet for selecting an exercise. Triggered from Active Workout's swap-exercise flow. Source data is the user's own exercise history (no global database). Free-text path for new exercises that haven't been used before.

## States designed

| State | Mode |
|---|---|
| Default (swapping from Bench press, Recent + All sections populated) | Dark |
| First use (no history, only free-text path meaningful) | Dark |
| Typing match (query filters live, accent-soft highlight on hits) | Dark |
| Typing no match (Add-new path surfaces as only row) | Dark |
| Default (populated) | Light |

## Design decisions locked

- **Modal style:** Full-height sheet with grabber at top.
- **Eyebrow:** "Swap exercise" (small-caps secondary). Establishes context when picker is opened from the swap flow.
- **Title:** "Exercise." matching the Today./Gym./Journal. pattern.
- **Swap context line:** "Replacing Bench press." in Fraunces italic under the title — keeps the user oriented without a heavy back-link.
- **Search field:** Bare underlined input at top, large-ish treatment.
- **Row pattern:** Exercise name (Inter 16) + last-used date right-muted (tabular nums). No weight shown — gets noisy for non-loaded movements (planks, rows where you swap implements).
- **Recently used section:** Top of list, from the user's last few workouts.
- **All section:** Below Recent, alphabetical, every exercise the user has ever logged.
- **Current item treatment:** When picker is opened to swap an exercise, the currently-selected exercise's row appears greyed with italic Fraunces "current" label on the right where the last-used date would be.
- **Add-new path:** Surfaces at top of list when query has no exact match. Two-line treatment: `Add "{query}" as new.` (accent Fraunces italic) + `It'll show up here next time.` (small caption).
- **Match highlighting:** When typing, matching substring inside each name gets accent-soft background highlight.
- **Selection:** Tap dismisses immediately. No confirm step.
- **Muscle-group sections:** Dropped. Name-based derivation too fragile.

## Voice strings

| String | Category | Notes |
|---|---|---|
| `Swap exercise` | label | eyebrow, no period |
| `Pick exercise` | label | alternate eyebrow when not swapping |
| `Exercise.` | title | Fraunces, period per Today./Gym. pattern |
| `Replacing {name}.` | sentence | Fraunces italic, period |
| `Find or add an exercise.` | label (placeholder) | input placeholder |
| `Type an exercise.` | label (placeholder) | first-use variant |
| `Recent` | label | section header (Fraunces) |
| `From your last few workouts.` | sentence | section caption |
| `All` | label | section header (Fraunces) |
| `Everything you've logged.` | sentence | section caption |
| `current` | label | trailing label on currently-selected row, Fraunces italic |
| `Add "{query}" as new.` | sentence | the add-new affordance, accent Fraunces italic |
| `It'll show up here next time.` | sentence | add-new subline |
| `No exercises yet.` | sentence | first-use empty state |
| `Type one to begin. They'll live here after.` | sentence | first-use hint |
| `Nothing matches.` | sentence | when query has no match AND no add-new path |

All strings follow the three-bucket rule. No periods on labels or action labels. Sentences end with periods.

## Component file — JSX

The Exercise Picker's React component source lives in the Claude Design canvas export as `exercise-picker.jsx`. Paste its contents below when the additive bundle is finalized:

```jsx
// [PASTE exercise-picker.jsx CONTENT HERE]
//
// Top-level export: ExercisePickerScreen
// Props:
//   swappingFrom?: string | null  - exercise being replaced
//   recent: Array<{name, lastLabel}>
//   all: Array<{name, lastLabel}>  - alphabetical
//   currentName?: string | null
//   initialQuery?: string
//   variant?: "default" | "first" | "typing-match" | "typing-nomatch"
//   dark?: boolean
```

## Component file — CSS

The stylesheet lives as `exercise-picker.css`:

```css
/* [PASTE exercise-picker.css CONTENT HERE]
 *
 * Class prefix: ep-
 * Key classes:
 *   ep-screen           - root, theme-aware via [data-dark]
 *   ep-grabber          - top drag handle (4px tall, 36px wide)
 *   ep-topnav           - eyebrow + close row
 *   ep-eyebrow          - small-caps "Swap exercise" label
 *   ep-close            - close X button
 *   ep-head             - title + swap-context block
 *   ep-title            - "Exercise." (Fraunces 40px)
 *   ep-swap-ctx         - "Replacing Bench press." italic line
 *   ep-search           - search field row
 *   ep-search__field    - underlined input wrapper
 *   ep-section / ep-h   - Recent/All sections
 *   ep-row              - single exercise row
 *   ep-row__name        - exercise name
 *   ep-row__last        - last-used date right-aligned
 *   ep-row__hit         - accent-soft highlight on query match
 *   ep-add              - Add-new row
 *   ep-empty            - first-use empty state
 *   ep-nomatch          - no-match line
 */
```

## Integration hints for Claude Code

When implementing the swap-exercise flow that calls this picker:

1. The component file at `exercise-picker.jsx` defines `ExercisePickerScreen` as the canonical screen component. Port it to React Native — the JSX is web-prototype shape; expect to rewrite layout in RN primitives but keep the same component structure, prop shape, and class naming intent.

2. The picker accepts `recent` and `all` as prop arrays. The data source is two SQLite queries:
   - `recent`: distinct exercise names from sets joined to workouts, ordered by workout `started_at DESC`, limit 6, format `lastLabel` as `formatRelativeDate(workouts.started_at)`.
   - `all`: distinct exercise names from sets, alphabetical, format `lastLabel` as the most recent use date for that exercise.

3. The Add-new path doesn't write to a database table — there's no `exercises` table in Lumen. It just resolves the picker with the typed query string as the chosen exercise name, and the caller (Active Workout's swap handler) uses that name directly.

4. Match highlighting can be implemented as a `<Text>` with multiple child spans, the matched substring wrapped in a span with the accent-soft background style.

5. The full-height sheet should use React Native's modal with `presentationStyle="pageSheet"` and a custom grabber, OR a `react-native-bottom-sheet` if already a dep. The Lumen-canonical pattern is the former; check the `Modal` or sheet primitives the project already established.
