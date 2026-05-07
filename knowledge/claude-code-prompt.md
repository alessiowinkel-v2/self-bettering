# Lumen — Claude Code Implementation Prompt

Paste-ready brief for Claude Code. Assumes the design PDF and the design-system / screens-status docs are also in the project knowledge.

## Context

Lumen is a personal-use iOS habit + journal + gym app. Single user (the project owner). No App Store distribution. Installed via Expo Go on the owner's iPhone. No backend service — all data lives on-device.

The design pass is complete for Today, Habit Detail, Journal Editor, and Active Workout. Remaining screens (Exercise History, Gym Home, Habits List, Journal List, Exercise Picker, Settings) will be designed alongside or just before their implementation phase.

## Stack

- **Framework:** Expo SDK (latest stable) + React Native + TypeScript
- **Navigation:** Expo Router (file-based, typed routes)
- **State:** Zustand for app state. React Query is overkill for a local-only app — skip it.
- **Storage:** SQLite via `expo-sqlite`. All habits, habit logs, journal entries, workouts, sets persist to a single local DB. Simple migrations file, no ORM.
- **Styling:** Tamagui or restyle if a design-token system pays off. Otherwise plain StyleSheet with a centralized theme module — this is a small app, do not over-engineer.
- **Fonts:** Fraunces (display) + Inter (body) loaded via `expo-font`.
- **Icons:** Lucide React Native or hand-rolled SVGs. The icon set is tiny: tab bar (4), settings cog, back chevron, edit, checkmark, backspace.
- **Haptics:** `expo-haptics`. Light tap on Held/Slipped commit, log on set, success on workout complete.
- **Date/time:** `date-fns`. The greeting logic (Morning/Evening/Night) and "yesterday/today" rollover live in one util module, well-tested.
- **No analytics, no crash reporting, no auth, no sync.** Offline-only, single-device.

## Phasing

### Phase 1 — Implement the design bundle faithfully

The original phased prompt had Phase 1 as scaffold + data model. That still happens, but the surface goal of Phase 1 is now **render the six designed screens to spec, with mock data**, so we can validate the visual system on-device before building the data layer behind it.

The six screens designed in Claude Design (Today, Habit Detail, Journal Editor, Active Workout, Exercise History, Gym Home) all have their canonical frames in the design PDF and the handoff bundle. Phase 1 implements them.

Order of work in Phase 1:
1. Project init: Expo, TypeScript strict, Expo Router, theme module with both color modes, font loading, base layout (tab bar with 4 tabs).
2. Mock data layer: a typed `mockData.ts` that returns the same shapes the real DB will return. Habits, habit logs by date, journal entries, workouts, sets.
3. **Today** screen, all states. Greeting logic from time of day. Held/Slipped commit (writes to in-memory mock store, persists across navigation but not across app reload — that's Phase 2's job). Streaks chip row with the trailing fade. Yesterday card. Next workout card. The five edge cases from the screens-status doc.
4. **Habit Detail** screen. 90-day heatmap rendered from mock data. Streak math (current, best). Day-one and just-slipped variants pulled from mock state. Edit / Pause / Delete are stubbed buttons, no functionality yet.
5. **Journal Editor**. Mood dots, tag chips, prompts that hide on type, word count, SAVED indicator. Persistence to mock store.
6. **Active Workout** flow. Set rows, custom numeric pad (do not use the iOS keyboard for kg/reps — it's a custom pad per the design), rest timer, last-set caption, end-of-workout takeover. Save-workout writes to mock store.
7. Light/dark theme switching wired to system, with manual override available in a placeholder Settings screen.

**Acceptance for Phase 1:** Owner installs via Expo Go, navigates all six screens, every designed state renders, mock data behaves correctly, but nothing persists across cold start. Visual parity with the design PDF is the bar.

### Phase 2 — Real persistence

Replace the mock layer with SQLite. Schema:

- `habits` (id, name, created_on, paused_at, deleted_at). `description` deferred until Habit Detail picks up notes; not in 0001. `created_on` is a date (YYYY-MM-DD), not a timestamp — habits are date-keyed for streak math.
- `habit_logs` (id, habit_id, date, status: 'held' | 'slipped', logged_at)
- `journal_entries` (id, date, mood, tags JSON, body, created_at, updated_at)
- `workout_templates` (id, name, exercises JSON ordered)
- `workouts` (id, template_id, started_at, completed_at, duration_seconds)
- `sets` (id, workout_id, exercise_name, set_number, kg, reps, logged_at)

Migrations live in `db/migrations/`. A single `db.ts` exposes typed query functions — no ORM, no query builder, just hand-rolled SQL with parameterized inputs.

Streak math should be a pure function on top of `habit_logs` ordered by date, not denormalized into `habits`. It's fast enough at this scale and saves a class of bugs.

**Acceptance for Phase 2:** Cold-start the app, all data is still there. Slipping a habit on Tuesday and viewing it on Friday shows the correct calendar state.

### Phase 3 — Remaining screens (designed in code)

The remaining three screens (Habits List, Journal List, Settings) were not designed in Claude Design. Build them directly in Claude Code using:

- The design system tokens from the handoff bundle (or design-system.md if the bundle isn't present)
- The patterns established in the six designed screens — section heads in Fraunces, rows with subtle dividers, `+ Add X` as quiet text links, empty states as "X. Y." two-line treatments
- The reference notes in screens-status.md for each one

Build order:
1. Habits List — closest sibling to Gym Home, same row pattern
2. Journal List — reuses the journal preview card from Today's evening state
3. Settings — rows with name + value/chevron, same rhythm as everything else

Implement Exercise Picker only when wiring up the swap-exercise flow inside Active Workout. It can stay deferred until then.

After each screen lands, run the designer/critic subagent against the design PDF for consistency — even though these screens aren't in the PDF, the patterns should hold.

### Phase 4 — Polish

- Haptics tuned per surface
- Streak number animation on increment (subtle amber pulse, not bouncy)
- Empty-state copy review pass — make sure no shame language slipped in anywhere
- Safe-area insets reviewed on all screens (the design PDF showed several headers under the notch — fix those)
- Export data (Settings → "Export" produces a JSON file via the share sheet)
- Backup reminder logic (gentle prompt every 30 days to export, since there's no cloud sync)

## Subagents to use

- **Designer/critic** — when a screen is implemented, hand its rendered state and the corresponding PDF page to a critic subagent that compares them and lists differences. Do not trust the implementing agent's self-assessment.
- **Migration writer** — when the schema needs changes after Phase 2 ships, a dedicated subagent writes the migration, the rollback, and the test that exercises both.
- **Copy reviewer** — before any text ships, a subagent reads it against the voice rules in the design system doc and flags anything that drifts.

## Skills to lean on

- **frontend-design** — for any screen work. The design system is locked, but layout decisions (spacing scales, breakpoints if we ever go iPad, accessibility) should pull from this skill.
- **product-self-knowledge** — only for Anthropic SDK questions, which this project shouldn't have. If something pulls Claude into the runtime (e.g., journal autocomplete or summary), this becomes relevant.

## Things explicitly out of scope

- Sync between devices
- Sharing, social, streaks competition, anything multi-user
- Push notifications beyond local reminders
- Apple Health integration
- Widgets, watchOS, shortcuts
- Onboarding flow — there's one user and they wrote the spec

These can be revisited later. They are not Phase 4.

## Known issues from design pass to fix during implementation

(Mirrored from screens-status.md — listed here so Claude Code sees them in context):

- "Start" button on Next Workout card should be a text affordance, not a filled button.
- "No journal yet" edge case needs a real empty-state card on Today; the design didn't render one.
- Several dark frames have the date header riding under the dynamic island — apply safe-area insets.
- Streaks row trailing chip clipping needs a gradient fade, not a hard cut.

## Voice reminder for any text that gets added during implementation

If during build a string needs writing that wasn't in the design (error states, empty lists, confirmation dialogs), the rules from the design system doc apply: short, declarative, ends with a period, no exclamation marks, no shame language, no motivational language. When in doubt, halve the sentence and add a period.
