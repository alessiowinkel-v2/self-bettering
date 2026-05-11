# Lumen — Design System

Personal-use iOS habit/journal/gym app. Stack: Expo + React Native, installed via Expo Go on a single iPhone. No App Store, no other users. The audience is one person and the tone is calibrated for that.

## Voice

Quiet-literary. Short sentences. Lowercase fragments allowed. The app talks like someone writing in a notebook, not like a coach.

Rules of thumb:
- Statements end with a period: "All held today." / "Last one." / "Done. 47 minutes." / "Day one."
- No exclamation marks. No emoji. No motivational language.
- No shame language about slips. "Since Apr 12." not "Broken since Apr 12." A reset is a date, not a failure.
- Time-of-day greeting is descriptive, not chatty: "Morning." / "Evening." / "Night."
- Empty states are full sentences: "Add your first habit to begin." / "Today is done." / "Started over today."
- Prompts in the journal lean confessional: "What did you avoid today, and why." / "What happened today."

When in doubt, cut the sentence in half and add a period.

### Three buckets for terminal punctuation

Every user-facing string falls into one of three buckets. Picking the right bucket decides whether the string ends with a period.

- **Statements** end with a period. Captions, empty-state body lines, error messages, alert body copy, status lines, greetings. "All held today." / "No habits yet." / "Could not save." / "Morning."
- **Labels** take no period. Small-caps eyebrows and inline metadata. `LAST 90 DAYS` / `IN PROGRESS` / `SAVED` / `BEST` / `CURRENT STREAK` / `DAY ONE` / `STARTED OVER TODAY`. The visual treatment carries the meaning — a period would read as an artifact.
- **Action labels** take no period. Buttons, links, alert buttons, in-picker actions, empty-state CTAs, retry affordances, input placeholders. `Held` / `Slipped` / `Log` / `Save workout` / `Cancel` / `Try again` / `Turn off` / `Add one` / `Write` / `Habit name`.

When in doubt, ask: is this string the verb the user is being invited to perform? If yes, no period. Is it a small-caps eyebrow or metadata chip? No period. Otherwise, period.

The same voice fragment can render differently in different buckets. "Day one." is a canonical voice statement quoted above; rendered as the eyebrow under the streak number it becomes the label `DAY ONE` (no period). The voice carries through, the punctuation follows the bucket.

## Type

- **Display & headings:** Fraunces. Used for screen titles ("Today.", "No nicotine", "Bench press"), date headers ("Wednesday, May 6"), and the big streak number on Habit Detail. Italic for soft states ("All held today.", "Last one.", "Done. 47 minutes.").
- **Body & UI:** Inter. Habit names in cards, set rows, journal body, labels.
- **Numerals:** Lining figures throughout. Streak counts on Today cards use Fraunces in amber. The big "24" on Habit Detail is Fraunces, oversized.

Hierarchy is carried mostly by typeface contrast and weight, not by size jumps. The screens stay calm because Fraunces and Inter sit very differently on the page.

## Color

Dark-first. Light mode is a near-equal alternative, not an afterthought.

**Dark mode**
- Background: deep near-black, slight warmth (not pure #000)
- Surface (cards): one step lighter than background, no borders
- Text primary: warm off-white
- Text secondary: muted gray for metadata, weekday letters, "LAST 90 DAYS" labels
- Accent: warm amber. Used for streak numbers, the "Held" affirmative state when active, "Log" affordances, the active tab indicator, and tag chips on Habit Detail (no nicotine, walk before noon).

**Light mode**
- Background: warm off-white (cream, not paper-white)
- Surface (cards): a touch lighter than background
- Text primary: near-black warm
- Accent: same amber, slightly deeper to maintain contrast on cream

The amber is the only chromatic accent in the system. Everything else is grayscale on warm-neutral. This is deliberate — when amber appears, it means something.

### The filled-button rule

Filled amber buttons are reserved for **the singular primary action of a screen that exists to take that action**. Two valid uses:
- First-time empty states (the "Add a habit" CTA on the empty Today screen)
- The "Save workout" link at the end of Active Workout

Daily, repetitive actions never get filled. Held/Slipped are text-only twin buttons. The "Start" button on the Next workout card should be text-only too — this is a case where the design currently has a filled regression that gets fixed in code.

The rule of thumb: if the action happens more than once a day, it's text. If the screen has one job and that's it, filled is allowed.

## Layout

- Generous vertical breathing room. Cards are tall, not dense.
- Single column. No grids beyond the 90-day calendar heatmap and the weekday dot row on Habit Detail.
- Section headers ("Streaks", "Yesterday", "Next workout") use Fraunces in white, with a clear margin above.
- The bottom tab bar is text + small icon, four tabs: Today, Habits, Journal, Gym.
- The "Today." title and date row sit at the top, then habit cards, then Streaks chips, then Yesterday card, then Next workout. This vertical order is the canonical Today layout.

## Component patterns

**Habit card (Today, default):**
- Habit name on the left, streak count in amber on the right.
- Two text buttons below: "Held" and "Slipped". Both are text-only, no fill, no border. Tapping commits the day.
- After commit, the card collapses to a single row: habit name on the left, "HELD" or "SLIPPED" small-caps on the right in amber/muted.

**Streak chips:**
- Pill-shaped, dark surface, habit name + number. Currently active (today) chips use amber text; inactive ones use muted gray.

**Habit detail:**
- Big Fraunces number (current streak), label below in small-caps gray ("CURRENT STREAK", "STARTED OVER TODAY.", "DAY ONE.").
- "Best 47" lockup in a single line, label in small caps gray, number in white.
- "This week" weekday dot row: M T W T F S S, today's dot ringed.
- "Last 90 days" calendar heatmap. Held cells filled in amber gradient (saturation by streak position), slipped cells dark with subtle outline, empty/future cells flat dark.
- New habits and recently-reset habits hide the calendar entirely. "Day one." and "Started over today." stand alone.

**Journal editor:**
- Date as Fraunces title at top.
- Five mood dots below the date (empty circles, fill the selected one in amber).
- Tag chips inline with mood dots: "+ tag" placeholder, taps to add. Tags like "evening", "gym", "morning" appear as pill chips.
- Two italic prompts grayed in the body: "What did you avoid today, and why." / "What happened today." These disappear as the user types.
- Word count appears in small caps gray bottom-left only when content exists.
- "SAVED" indicator top-right with a small dot, persistent.

**Active workout (set rows):**
- Header: "PUSH A" centered, elapsed time top-right, back chevron top-left.
- Previous exercise above current as a single dim row: "Incline DB press 20kg · 8, 8, 7".
- Current exercise: Fraunces title, "4 × 5–8" subtitle, "LAST 82.5kg × 6, 6, 5, 4" gray label.
- Set rows: number, kg input, reps input, "Log" amber CTA on active row, checkmark on completed rows.
- Inactive sets dim. Completed sets dim slightly less, with a tick.

**Numeric pad:**
- Custom in-app pad, not the iOS keyboard. Sits over the lower half of the screen.
- Big number display top-left, "last · 82.5" pill top-right.
- 3×4 number grid, decimal, zero, backspace. Amber "Log" button replaces the standard column on the right.

**Rest timer:**
- Bottom sheet, dim. Label "REST" small-caps, count "1:12" in Fraunces, "Skip" amber link on the right.

**End-of-workout takeover:**
- Whole screen empties to "Done. 47 minutes." in Fraunces italic, centered. "Save workout" amber link below. No stats, no celebration.

## What's already validated by the designed frames

These have been seen on-device (in mockup) and read as correct:
- Today's split between "Morning.", "Evening.", "Night." greetings, with the evening state replacing the three habit cards with a single "All held today." line when applicable.
- Habit Detail's calendar saturation (after the second iteration). Held/slipped/empty are now distinct.
- "Since Apr 12." replacing "Broken since Apr 12." on Habit Detail. The reset is a date.
- Journal editor's restraint. The one-line "Tired." entry holds the page without feeling sparse — that's the bar for everything else.
- Active Workout's "Last one." caption on the final set, and "Done. 47 minutes." takeover. The voice carries through.

## Open questions / things deferred to implementation

- Haptics on Held/Slipped commit, on Log, on rest timer completion — to be tuned in code.
- Streak number animation on increment (amber pulse vs. silent).
- Light mode hasn't been seen for Active Workout's full flow (numeric pad, rest timer, end-of-workout). Carry the same logic: warm cream background, amber accent unchanged.
