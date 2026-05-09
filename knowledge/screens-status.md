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

**Status:** ✅ Done. Strongest set of frames in the design pass. Built in code in Phase 3c at [app/journal/[date].tsx](../app/journal/[date].tsx). Reachable as `/journal/[date]` from Today (`NoJournalYetCard.onWrite` → today's date, `YesterdayCard.onPress` → entry's date). Auto-save is debounced at 500ms via [utils/useDebouncedSave.ts](../utils/useDebouncedSave.ts); the SAVED indicator dot dims to a hollow ring while pending or errored, fills once persisted state matches the draft. The hook gates with `enabled: hydrated` so opening an existing entry rebases the persisted-baseline to the loaded values — no spurious save fires on hydrate. Tap a chip to delete; "+ tag" expands inline with case-insensitive dedupe (preserving first-typed casing). Body's prompts are sibling Text nodes, not the input's placeholder, so they hide once `body.length > 0`. Today's `useFocusEffect` calls `useTodayStore.refreshJournalSlice()` on focus as a safety net for the editor's unmount-flush path; save-time refresh is the fast path. New theme variant `bodyItalicFraunces` (Fraunces italic, 16/22) introduced for the prompt lines so they sit at body size, not heading size.

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

Built in code in Phase 3d at [app/(tabs)/gym.tsx](../app/(tabs)/gym.tsx). Hydrates via [state/gymHomeStore.ts](../state/gymHomeStore.ts) on focus. Two new SQLite queries in [db/workouts.ts](../db/workouts.ts): `getWorkoutTemplatesWithLastCompleted` (correlated MAX per template, LEFT-JOIN-equivalent semantics, preserves rotation_order) and `getCompletedWorkoutDatesInRange` (DISTINCT date strings via `substr(completed_at, 1, 10)`). No migration. Date math + the "Last · {phrase} · N exercises" caption live in [utils/gymHome.ts](../utils/gymHome.ts) (`getWeekRange`, `buildGymWeekDots`, `formatRelativeDate`). The week strip reuses the new shared primitive [components/primitives/WeekDots.tsx](../components/primitives/WeekDots.tsx) — promoted out of `components/habit/` and the status union renamed `'held' | 'slipped' | 'empty'` → `'filled' | 'outlined' | 'empty'` so the vocabulary is domain-agnostic. `buildWeekDots` in [utils/habitDetail.ts](../utils/habitDetail.ts) maps `'held' → 'filled'`, `'slipped' → 'outlined'`, no-log → `'empty'`. Habit Detail renders identically — pure naming change. Gym Home's `buildGymWeekDots` only emits `'filled'` and `'empty'` (workouts have no slipped concept). The `NextWorkoutCard` is screen-local under `components/gym/`, deliberately not unified with Today's; both surfaces wire to the same Active Workout route in Phase 3e+. Routine row tap, "+ Add routine", "Start", and "Add one." all `console.log` for now.

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

- **Journal Editor SAVED indicator position.** Currently: absolutely positioned inside the `Screen`'s `ScrollView` contentContainer at `top: useHeaderHeight() + spacing[3]`, `right: theme.spacing[5]`. Because the contentContainer already paints its own horizontal gutter, this lands the indicator one full gutter inside the date title's right edge rather than flush with it. Phone-test whether that inset reads as "comfortable corner placement" or "drifting away from the title's edge." If too inset, drop to `right: 0`.

- **Journal Editor scroll vs. KeyboardAvoidingView.** Currently: `Screen scroll={true}` (default), no KeyboardAvoidingView. iOS scrolls a focused multiline TextInput into view automatically. If the keyboard covers the body or word count on the phone, switch to `scroll={false}` + `KeyboardAvoidingView behavior="padding"`, mirroring the add-habit modal.

- **Journal Editor mood dot diameter.** Currently: 12px (vs. 8px on the read-only `MoodDots` used by the Yesterday card). The interactive version doubles as a touch target via `hitSlop: 16`; the visible dot is intentionally larger so it reads as a control rather than an indicator. Phone-test whether 12px sits comfortably with the Inter caption tag chips on the same row, or whether 10–11 reads better.

- **Journal Editor mood-row + tag-row wrapping.** Currently: dots and chips render in a single flex row with `flexWrap: 'wrap'`, gap `spacing[4]`. With four or more tags ("evening · gym · morning · walk") the chip set wraps to a second line *below* the dots, breaking the design's single-row inline reading. Phone-test on a typical real-world tag count. Remediation if it reads wrong: split into two rows (dots above, chips below), or scrollable horizontal chip rail.

- **Journal Editor tag-chip baseline alignment with mood dots.** Currently: `alignItems: 'center'` on the row centers 12px circles against the chip's box midline. PDF page 7 ("Mood set — terracotta dot") aligns dots with the chip-text baseline, not the chip-box midline. Phone-test whether the centered alignment reads off-balance.

- **Journal Editor word-count placement.** Currently: flowed below the body TextInput with `marginTop: spacing[5]` so it scrolls with content. Design-system.md:86 says "small caps gray bottom-left only when content exists" which reads as viewport-anchored corner placement. Phone-test on PDF pages 8-10. If corner-anchored is the canonical design, the editor needs `scroll={false}` + `KeyboardAvoidingView` + a footer slot, which is mutually exclusive with the current `scroll={true}` layout. Resolve along with the scroll-vs-KAV question above.

- **Journal Editor error-caption overlap on long-weekday dates.** Currently: SavedIndicator is absolute-positioned at `top: useHeaderHeight() + spacing[3]`, `right: spacing[5]` (see indicator-position note above). The "Could not save." caption renders directly under the SAVED row inside the same absolute wrapper. On dates whose Fraunces-display title wraps to a second line ("Wednesday, September 25"), the caption can collide with the title's descender. Phone-test on a long weekday/month combination.

- **Journal Editor prompts hard-hide vs. fade.** Currently: `JournalPrompts` is rendered iff `body.length === 0`, no animation. Design-system.md:85 says "These disappear as the user types" — ambiguous between instant and animated. Phone-test whether a 120-200ms cross-fade reads more graceful than the current hard-cut.

- **Journal Editor date title format (`MMMM d` vs `MMM d`).** Currently: `formatWeekdayWithDate(iso)` returns `EEEE, MMMM d` ("Wednesday, May 6", full month name). The Today header uses `MMM d` (abbreviated). The journal-and-Yesterday-card pair share the same util, so they stay consistent — but PDF page 8 shows the journal title's date and is the tiebreaker on whether full-month or abbreviated reads correct at the editor's display size.

- **Today-cell ring on Heatmap90 over a held tile.** Currently: 1px accent ring on top of accent-at-`heldCellOpacity` fill. May read as darker-amber-on-lighter-amber — the ring sits at full accent opacity on top of a fill whose opacity is often <1. Phone-test on the 24-day "No nicotine" run vs. a fresh held cell. Remediation options if too loud:
  - ring at reduced opacity
  - ring at `theme.colors.textPrimary` instead of `accent` (contrast against the fill, not the gap)
  - inset ring with a 1-2px margin so it sits inside the cell against a sliver of background

- **Gym Home next-up dot diameter.** Currently: 6px solid amber circle inside a 14px-wide gutter on every `RoutineRow`. PDF page 25 shows the dot at roughly the same scale, but on-device a 6px pixel-snapped circle on 3x density may read smaller than intended. Phone-test against the gutter; remediation is bumping to 7-8px, since the gutter has the headroom.

- **Gym Home "Start ›" chevron glyph weight.** Currently: literal `›` (U+203A, single right-pointing angle quotation) inline in the `TextButton` label, rendering at Inter Medium 16. Inter ships the chevron at a slightly-thicker weight than the system pseudo-chevron in iOS lists. Phone-test whether the inline glyph reads as "tap me" or as decorative punctuation; remediation is replacing with a Lucide `ChevronRight` icon at the same baseline.

- **Gym Home "Add one." button weight on first-time empty.** Currently: muted `TextButton` (accent tone). HabitsEmpty uses the same treatment, and the project's settled reading of the filled-button rule reserves `FilledButton` for Today's canonical first-time CTA only. Phone-test whether the muted "Add one." reads as discoverable enough on the empty Gym Home, or if the screen needs a touch more weight than HabitsEmpty since Gym Home has nothing else competing for attention.

- **Gym Home next-workout card subtitle wrapping.** Currently: `previewLine` is `template.exercises.slice(0, 3).join(', ')` and renders with `numberOfLines={1}` so a long preview ellipsizes mid-word. PDF page 25 shows the line ending cleanly within the card width; phone-test on a routine with three long exercise names ("Incline DB press, Triceps pushdown, Lateral raise") — if it ellipsizes too aggressively, drop to a 2-exercise preview or switch to a shorter exercise vocabulary in the seed.

- **WeekDots rename regression check.** Currently: the primitive at [components/primitives/WeekDots.tsx](../components/primitives/WeekDots.tsx) renders identically to the previous Habit-Detail-only version — the rename was status-union-only, no style changes. Phone-test Habit Detail's THIS WEEK row before and after — visual parity is the bar.

- **Gym Home "X of N done this week" denominator semantics.** Currently: `N` is `templates.length` (total routine count). A user with four routines who has done three sessions reads as "3 of 4 done this week." Alternative: `N` could be a planned-per-week target (e.g. 4 sessions/week even if 6 routines exist), but that requires a per-routine cadence field that doesn't exist yet. Phone-test whether "of N total routines" reads naturally; if not, the denominator may need to drop entirely ("3 sessions this week.").

- **Gym Home week strip caption-vs-dot-row spacing.** Currently: dots row, then `marginTop: spacing[3]` to the "X of N done" caption when present. PDF page 25 shows the caption sitting one row of breathing room below the dots; phone-test whether `spacing[3]` (12) reads as that row, or if `spacing[4]` (16) is closer to the design's gap.

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
