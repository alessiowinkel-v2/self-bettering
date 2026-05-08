# Lumen — Screens Status

Tracks what's been designed in Claude Design, what's pending, and known issues to fix during implementation rather than re-iterate in design.

## Designed

### Today
**States covered:**
- Dark · Morning (3 habit cards, Held/Slipped buttons, Streaks row, Yesterday peek)
- Dark · Evening — "All held today." replacing the three cards, with Streaks, Yesterday, Next workout (Push A)
- Dark · Night — Evening greeting variant
- Light · Morning — same as dark, cream background
- Partially held — one habit collapsed to "HELD", others still actionable, one expanded mid-tap
- Edge: Add your first habit to begin (first-time, dark)
- Edge: "Today is done." — habits + journal + workout all complete (dark, night)

**Status:** ✅ Done. Ready for implementation.

### Habit Detail
**States covered:**
- Dark · default (No nicotine, 24-day current streak, Best 47, This week dot row, 90-day heatmap)
- Dark · just slipped today ("Started over today.", 0 streak, calendar shows the slip)
- Dark · new habit, day one (Read 20 minutes, "Day one.", no calendar, no Best, Pause/Delete actions visible)
- Light · default

**Status:** ✅ Done. Calendar saturation and "Since Apr 12." copy fix landed in iteration 2.

### Journal Editor
**States covered:**
- Empty — placeholder + prompts ("What did you avoid today, and why." / "What happened today.")
- Mood set — terracotta dot
- Mid-entry — real text, mood set, tags, word count visible
- One-line entry ("Tired.") — proves the editor stays spacious with sparse input
- Light · mid-entry

**Status:** ✅ Done. Strongest set of frames in the design pass.

### Active Workout
**States covered:**
- Dark · mid-workout (Push A, Bench press, set 3 current, sets 1–2 logged, previous exercise "Incline DB press" shown as a dim row above)
- Dark · just-logged set 3, rest timer counting down at 1:12
- Dark · numeric pad open, editing set 3 weight ("85" entered, "last · 82.5" pill visible)
- Dark · last set of last exercise (Triceps pushdown, "Last one." caption)
- Dark · workout complete — "Done. 47 minutes." italic Fraunces takeover, "Save workout" amber link below
- Light · mid-workout

**Status:** ✅ Done. Voice carries through ("Last one.", "Done. 47 minutes."), the custom numeric pad replaces the iOS keyboard as specified, rest timer sits as a quiet bottom card. The completed-set rows dim correctly, current-set row gets the subtle bg-elev-2 fill on the inputs.

### Exercise History
**States covered:**
- Dark · default (Bench press, 23 sessions since Feb, line chart of top-set weight, 5-rep and 8-rep PR row, expanded session row showing rest times)
- Dark · first session (no chart, no PRs, single history row, "More sessions, more shape." caption)
- Dark · 4 sessions (flatter chart, no PR row, history rows visible)
- Light · default

**Status:** ✅ Done. Chart stays quiet (1px line, single accent dot on most recent point, two hollow rings on previous two, only first/middle/last x-axis labels). PR pills are small hairline outlines, not badges. The "PUSH A · TODAY" breadcrumb at the top is a nice unprompted addition that signals where the screen was opened from.

### Gym Home
**States covered:**
- Dark · default (Push A up next, 4 routines, 3 of 4 done this week, amber dot marks the next-up routine in the list)
- Dark · first-time empty ("No routines yet." / "Add one.")
- Dark · routines exist but nothing logged this week (next-workout card visible, "This week" shows empty hollow dots, count line hidden)
- Light · default

**Status:** ✅ Done. Next-workout card is right-sized, "Start ›" with chevron as text link (correct, not filled). Routines render as rows not cards. The amber dot on the next-up routine inside the routines list is exactly the subtle hierarchy specified. "+ Add routine" reads as a quiet text link.

## Pending — design and build in Claude Code

These three screens were originally going to be designed in Claude Design first, then implemented. Switching strategy: **design and build them directly in Claude Code**, using the established design system tokens and the patterns from Today / Gym Home / Habit Detail as reference. They're all list patterns or settings — lower stakes than what's already designed, and Claude Code can produce them faithfully without canvas iteration.

### 1. Habits List
Tab destination behind the Habits tab. All habits including paused and archived. Active habits as rows with streak number and today-status caption. Paused section at ~50% opacity, no streak. Archived section collapsed by default, ~40% opacity when expanded. Swipe-left for Pause / Edit / Archive. Long-press for reorder. "+ Add habit" as quiet text link.

Reference pattern: Gym Home routines list. Same row-with-divider rhythm.

### 2. Journal List
Tab destination behind the Journal tab. Reverse-chronological entries grouped by month. Each entry uses the journal preview card from Today (mood dot row, date, first 1–2 lines fading out, tag chips). Tap to open Journal Editor.

Reference pattern: the Yesterday card on Today's evening state. Reuse that component.

### 3. Settings
Cog icon top-right of Today opens this. Sections (Fraunces section heads, rows below):
- Appearance: theme (system / dark / light), font size
- Notifications: morning check-in time, evening check-in time, rest timer alerts on/off
- Data: export to JSON, import, clear all data (destructive, confirm)
- About: version, build, single-line credit

Reference pattern: rows with name on left, current value or chevron on right. Same row-with-divider rhythm as everything else.

### Optionally later: Exercise Picker
Modal from inside Active Workout when adding/swapping an exercise. Search field at top, "Recently used" section, then by muscle group. Designed in Claude Code only when actually needed during implementation — can be deferred until you wire up the swap-exercise flow.

## Known issues to fix in code, not redesign

These came up across the design iterations. Logging them so they don't get lost.

- **Start button on Today's "Next workout" card** is rendered as a filled amber button, breaking the text-only Held/Slipped pattern used everywhere else. Should be a text affordance ("Start" in amber, no fill) to match the rest of the system. Two iterations didn't fix this — implement correctly in code.

- **No-journal-yet edge case** doesn't render an empty-state card in the design frames (pages 23–24 look identical to the default Today). The implementation should show, between the Yesterday section and the bottom tab bar, a card or quiet line like "No entry yet today." with a small "Write" affordance. Use Journal editor's empty state as the actual entry surface.

- **Headers under the iOS notch** on several dark frames — "Wednesday, May 6 Morning." sits very close to the dynamic island. Apply proper safe-area insets in implementation. This is a layout fix, not a design fix.

- **Streaks row clipping** the "Read 20m" chip on the right edge in several frames. The horizontal scroll is fine, but the gradient mask or fade-out on the trailing edge needs to be implemented so it reads as scrollable rather than clipped.

## Open visual questions for on-device review

These landed in code with a defensible default but want a phone-side eyeball pass before being treated as final.

- **Heatmap90 rightmost-column anchor.** Currently: today sits at the row matching its weekday inside the rightmost column, with future days of the current week rendering as flat empty cells below. Alternative: anchor today to the bottom-right corner with no future-cells rendered (canonical GitHub-style). PDF page 11 is the tiebreaker.

- **"Since {date}." typography.** Currently: Inter `body` `tone="secondary"` (16/22, muted, period-terminated). Alternative: Fraunces upright at ~16-18 (would require introducing a `displaySm` variant or repurposing `streakAccent` size). The line is factual metadata and reads cleanly as Inter, but Fraunces upright would lock the under-title slot to the heading typeface.

- **Archived variant layout.** Currently: BEST and "Since" still render under an `ARCHIVED.` label. Alternative: hide both the way day-one does. PDF is silent on archived since Phase 3a introduced the concept — phone-test which reads better.

- **Habit Detail title top-pad.** Currently: `useHeaderHeight() + spacing[3]`. May want spacing[2] or spacing[1] depending on how the title sits visually below the back chevron under the transparent header.

- **Habit Detail action row weight.** Currently: full-secondary parity — Pause / Resume / Archive / Restore all render `tone="secondary"`. Defensible per the filled-button rule (Habit Detail has no singular primary affordance). Alternative: give Archive / Restore a touch of extra weight (e.g. `tone="primary"` for the archive verb, since it's destructive-deliberate). Phone-test whether the row reads as appropriately quiet or as too flat.

- **Today-cell ring on Heatmap90 over a held tile.** Currently: 1px accent ring on top of accent-at-`heldCellOpacity` fill. May read as darker-amber-on-lighter-amber — the ring sits at full accent opacity on top of a fill whose opacity is often <1. Phone-test on the 24-day "No nicotine" run vs. a fresh held cell. Remediation options if too loud:
  - ring at reduced opacity
  - ring at `theme.colors.textPrimary` instead of `accent` (contrast against the fill, not the gap)
  - inset ring with a 1-2px margin so it sits inside the cell against a sliver of background

## Library assumptions worth re-verifying on dep upgrades

Pinning third-party behavior. Worth checking when upgrading any of these.

- **`react-native-draggable-flatlist` v4.0.3** is assumed not to mutate its `data` prop. The `as Habit[]` cast in [app/(tabs)/habits.tsx](../app/(tabs)/habits.tsx) (active habits passed as `ReadonlyArray<Habit>` cast to `Habit[]`) depends on this contract. Re-verify on major version bumps — if the library starts splicing in place, the store's reference would mutate silently. The current cast was verified against v4.0.3 source.

## Frames already on-device (in PDF) that match spec

For reference when implementing — these are the canonical visual targets. PDF page numbers refer to the latest 32-page export.

| Screen | Page in PDF |
|---|---|
| Today · Dark · Morning | 1 |
| Today · Dark · Evening (All held) | 2 |
| Today · Light · Morning | 3 |
| Today · Partially held / one collapsed | 4 |
| Today · Dark · Night | 5 |
| Journal · Empty | 6 |
| Journal · Mood set | 7 |
| Journal · Mid-entry (66 words) | 8 |
| Journal · One-line ("Tired.") | 9 |
| Journal · Light · Mid-entry | 10 |
| Habit Detail · Default (24-day streak) | 11 |
| Habit Detail · Just slipped | 12 |
| Habit Detail · Day one | 13 |
| Habit Detail · Light · Default | 14 |
| Active Workout · Mid-workout | 15 |
| Active Workout · Rest timer 1:12 | 16 |
| Active Workout · Numeric pad open | 17 |
| Active Workout · Last set ("Last one.") | 18 |
| Active Workout · Done takeover | 19 |
| Active Workout · Light · Mid-workout | 20 |
| Exercise History · Default (12+ sessions, PRs) | 21 |
| Exercise History · First session | 22 |
| Exercise History · 4 sessions, flatter | 23 |
| Exercise History · Light · Default | 24 |
| Gym Home · Default (Push A up next) | 25 |
| Gym Home · First-time empty | 26 |
| Gym Home · Routines exist, nothing this week | 27 |
| Gym Home · Light · Default | 28 |
| Edge · First-time (Today) | 29 |
| Edge · Today is done | 30 |
| Edge · No journal yet (dark) | 31 |
| Edge · No journal yet (light) | 32 |

## Handoff bundle from Claude Design

In addition to the PDF, generate the Claude Design "Handoff to Claude Code" bundle while design budget remains. The bundle includes the design tokens, component definitions, and screen specs in a format Claude Code can read directly. Drop the bundle alongside this doc in the project knowledge.
