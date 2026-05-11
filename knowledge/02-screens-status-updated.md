# Lumen — Screens Status

Tracks what's been designed in Claude Design, what's been built directly in Claude Code, what's still pending, and known issues already resolved or deferred.

## Designed in Claude Design

### Today
**States covered:**
- Dark · Morning (3 habit cards, Held/Slipped buttons, Streaks row, Yesterday peek)
- Dark · Evening — "All held today." replacing the three cards, with Streaks, Yesterday, Next workout (Push A)
- Dark · Night — Evening greeting variant
- Light · Morning — same as dark, cream background
- Partially held — one habit collapsed to "HELD", others still actionable, one expanded mid-tap
- Edge: Add your first habit to begin (first-time, dark)
- Edge: "Today is done." — habits + journal + workout all complete (dark, night)

**Status:** ✅ Designed. ✅ Implemented. ✅ Phone-tested.

### Habit Detail
**States covered:**
- Dark · default (No nicotine, 24-day current streak, Best 47, This week dot row, 90-day heatmap)
- Dark · just slipped today ("Started over today.", 0 streak, calendar shows the slip)
- Dark · new habit, day one (Read 20 minutes, "Day one.", no calendar, no Best, Pause/Delete actions visible)
- Light · default

**Status:** ✅ Designed. ✅ Implemented. ✅ Phone-tested. Calendar saturation and "Since Apr 12." copy fix landed in iteration 2.

### Journal Editor
**States covered:**
- Empty — placeholder + prompts ("What did you avoid today, and why." / "What happened today.")
- Mood set — terracotta dot
- Mid-entry — real text, mood set, tags, word count visible
- One-line entry ("Tired.") — proves the editor stays spacious with sparse input
- Light · mid-entry

**Status:** ✅ Designed. ✅ Implemented. ✅ Phone-tested. Strongest set of frames in the design pass.

### Active Workout
**States covered:**
- Dark · mid-workout (Push A, Bench press, set 3 current, sets 1–2 logged, previous exercise "Incline DB press" shown as a dim row above)
- Dark · just-logged set 3, rest timer counting down at 1:12
- Dark · numeric pad open, editing set 3 weight ("85" entered, "last · 82.5" pill visible)
- Dark · last set of last exercise (Triceps pushdown, "Last one." caption)
- Dark · workout complete — "Done. 47 minutes." italic Fraunces takeover, "Save workout" amber link below
- Light · mid-workout

**Status:** ✅ Designed. ✅ Implemented. ✅ Phone-tested. Voice carries through ("Last one.", "Done. 47 minutes."), the custom numeric pad replaces the iOS keyboard as specified, rest timer sits as a quiet bottom card.

### Exercise History
**States covered:**
- Dark · default (Bench press, 23 sessions since Feb, line chart of top-set weight, 5-rep and 8-rep PR row, expanded session row showing rest times)
- Dark · first session (no chart, no PRs, single history row, "More sessions, more shape." caption)
- Dark · 4 sessions (flatter chart, no PR row, history rows visible)
- Light · default

**Status:** ✅ Designed. ✅ Implemented. ✅ Phone-tested. Chart stays quiet (1px line, single accent dot on most recent point, two hollow rings on previous two, only first/middle/last x-axis labels). PR pills are small hairline outlines, not badges. "PUSH A · TODAY" breadcrumb at the top reads as nice unprompted addition.

### Gym Home
**States covered:**
- Dark · default (Push A up next, 4 routines, 3 of 4 done this week, amber dot marks the next-up routine in the list)
- Dark · first-time empty ("No routines yet." / "Add one")
- Dark · routines exist but nothing logged this week (next-workout card visible, "This week" shows empty hollow dots, count line hidden)
- Dark · in-progress card variant — Next workout card replaced by "IN PROGRESS · 18 MIN" eyebrow + Resume affordance (added during Phase 4 resume-in-progress pass)
- Light · default

**Status:** ✅ Designed. ✅ Implemented. ✅ Phone-tested. "+ Add routine" reads as a quiet text link — the link works as an affordance but its destination (Add Routine screen) has not yet been designed or implemented. See Pending below.

### Exercise Picker
**States covered:**
- Dark · default (swapping from Bench press, Recent (4) + All (15, alphabetical), current item greyed with italic "current" tag)
- Dark · first use (bare search, no history, "No exercises yet." line)
- Dark · typing match (query "press" filters live, accent-soft highlight on the hit substring)
- Dark · typing no match (query "Zercher squat" surfaces the Add path as the only row)
- Light · populated (Default state, cream background)

**Status:** ✅ Designed. Implementation deferred until the swap-exercise flow in Active Workout is wired up — that's the surface that calls the picker. See implementation prompt for swap-exercise.

**Design decisions locked:**
- Modal style: full-height sheet with grabber + eyebrow context ("Swap exercise")
- Title: "Exercise." matching the Today./Gym. pattern
- Swap context line: "Replacing Bench press." in Fraunces italic under the title
- Row pattern: name (Inter 16) + last-used date right-muted, no weight (avoids gym-bro noise)
- Add-new path: "Add "{query}" as new." in accent Fraunces italic + "It'll show up here next time." subline
- Selection: tap dismisses immediately, no confirm step
- Muscle-group sections: dropped (name-based derivation too fragile)

## Built directly in Claude Code

These screens were designed and built directly in Claude Code using established design system tokens and patterns from Today / Gym Home / Habit Detail as reference, rather than going through Claude Design first.

### Habits List
Tab destination behind the Habits tab. All habits including paused and archived. Active habits as rows with streak number and today-status caption. Paused section at ~50% opacity, no streak. Archived section collapsed by default.

**Status:** ✅ Built. ✅ Phone-tested. Reference pattern: Gym Home routines list.

### Journal List
Tab destination behind the Journal tab. Reverse-chronological entries grouped by month.

**Status:** ✅ Built. ✅ Phone-tested. Reference pattern: the Yesterday card on Today's evening state.

### Settings
Cog icon top-right of Today opens this. Sections: Appearance, Notifications, Data, About.

**Status:** ✅ Built. ✅ Phone-tested. Reference pattern: rows with name on left, current value or chevron on right.

### Add Habit modal
Reached from Habits List's "+ Add habit" link. Single-field modal with name input.

**Status:** ✅ Built. ✅ Phone-tested.

## Pending — to be designed in Claude Design before implementation

### Add Routine and Edit Routine
The "+ Add routine" link on Gym Home is a dead affordance — visible but with no destination. Same situation Add Habit had before it was built. Needs design first because the surface has more decisions than Add Habit had (exercise selection method, set-count stepper, reorder pattern, edit access from Gym Home).

**Design prompt:** prepared, ready to paste into Claude Design. May share patterns with Exercise Picker (the exercise selection step inside Add Routine could reuse the picker's full-sheet pattern).

**Once designed and implemented, the dead "+ Add routine" link becomes a real surface.**

## Known issues from design pass — status

These came up across the design iterations.

- **Start button on Today's "Next workout" card** rendered as filled amber button in design — fixed in code as text affordance. ✅ Fixed.
- **No-journal-yet edge case** had no empty-state card in design — implementation added "No entry yet today." card. ✅ Fixed.
- **Headers under the iOS notch** on several dark frames — fixed in Phase 4 safe-area insets sweep. ✅ Fixed.
- **Streaks row clipping** on right edge — gradient fade-out implemented. ✅ Fixed.

## Frames already on-device (in PDF) that match spec

For reference when implementing — these are the canonical visual targets. PDF page numbers refer to the original 32-page export. Exercise Picker frames live in a separate handoff bundle, not in the original PDF.

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

## Handoff bundles from Claude Design

The original six-screen bundle covers the first 32-page PDF surfaces.

The Exercise Picker bundle (separate, additive) covers the picker's 5 frames. Component files: `exercise-picker.jsx`, `exercise-picker.css`. Concatenated reference: `05-handoff-exercise-picker.md` in project knowledge.

When Add Routine is designed, append its bundle to a new section in the handoff doc and add it back here.
