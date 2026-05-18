# Plan — Habit Notifications (Phase 4)

Status: **Steps 1 and 2 implemented.** Typecheck clean. Pending a new build to
test on-device (`expo-notifications` is a new native dependency).

## Step 1 — app-wide check-ins (implemented)

- `expo-notifications` 0.32.17 installed; `"expo-notifications"` added to
  `app.json` plugins.
- The planned `utils/notifications.test.ts` was dropped: `notifications.ts`
  imports `expo-notifications` (a native module), so it cannot run under the
  project's standalone `tsc`+`node` test convention. The only pure logic is a
  6-line `parseHHmm` regex guard — not worth extracting into its own module.
- Permission-denied caption on `CheckInRow` was not built (kept optional). The
  denial Alert in `settings.tsx` covers communication at the moment it matters.
- Sync is debounced 400ms in `settings.tsx` — the picker fires onChange per
  wheel tick, so a per-tick cancel+reschedule would churn and race.

Step 1 review fixes:
- `requestCheckInPermission` re-syncs after the permission prompt resolves —
  the prompt can outlast the debounced sync, which would otherwise schedule
  nothing against a still-undetermined status.
- `syncCheckInNotifications` runs are serialized through a module-level promise
  chain — concurrent reconciles could interleave a stale cancel after a fresh
  schedule and drop a reminder.

## Step 2 — per-habit reminders (implemented)

- Migration `0005_habits_reminder_time` adds a nullable `reminder_time TEXT`
  column to `habits`. `db/habits.ts` gained `setHabitReminderTime` and
  `getActiveHabitReminders` (active, non-paused, non-archived habits only).
- `utils/notifications.ts` gained `syncHabitReminders` — a reconcile that
  lists all scheduled notifications, sweeps everything under the
  `lumen.habit.` id prefix, then reschedules the active set. Shares the Step 1
  serialized chain.
- `habitsListStore` exports `syncHabitRemindersFromDb()` (reads the DB, feeds
  the reconcile, swallows its own errors). Fired after pause/resume/archive/
  restore so a habit leaving or rejoining the active set updates its reminder.
- Habit Detail has a `Reminder` row (reused `CheckInRow`), shown only for
  active habits. `_layout.tsx` reconciles habit reminders on boot once the DB
  is ready.

Step 2 review fixes:
- Habit Detail's reminder is its own `useState`, not folded into the snapshot
  — the earlier optimistic update spread a stale snapshot and a focus refresh
  could clobber the pick.
- `onChangeReminder` reads the null<->time transition off a synchronously-
  updated ref, not React state — two fast spinner ticks could otherwise both
  see the pre-edit value and double-fire the permission request.

## Carryover

`CheckInRow` now lives in `components/settings/` but is used by Habit Detail
too. It is a generic time-or-off row; consider moving it to
`components/primitives/` if a third caller appears.

## Goal

Make the two check-in times in Settings actually fire local notifications. Today
they are configuration-only: `morningCheckInTime` / `eveningCheckInTime` are
stored in `settingsStore` as `"HH:mm" | null`, the UI to set them ships in
`CheckInRow`, but nothing schedules anything. Both the `CheckInRow` header
comment and `settingsStore`'s doc comment explicitly defer scheduling to Phase 4.

## Scope decision

Owner decision: **both** — ship app-wide check-ins first, per-habit reminders
as a follow-up step.

### Step 1 (this plan) — two app-wide check-ins

The config surface already exists, so build this first:

- Morning check-in — a nudge to look at the day's habits.
- Evening check-in — a nudge to log Held/Slipped before the day closes.

Everything below ("Architecture" through "Acceptance") describes Step 1.

### Step 2 (follow-up) — per-habit reminders

Built after Step 1 lands and is verified on-device. Sketch:

- Schema: add `reminder_time TEXT` (`"HH:mm" | null`) to `habits` via a new
  migration in `db/migrations/`. Streak math is unaffected.
- UI: a per-habit reminder row on Habit Detail, reusing `CheckInRow`'s
  expand-to-pick / "Turn off" pattern.
- Scheduling: `utils/notifications.ts` gains a per-habit reconcile. Identifiers
  become `lumen.habit.<habitId>`. The sync function takes the full habit list
  and cancels reminders for deleted/paused habits. `syncCheckInNotifications`
  generalizes into a single `syncAllNotifications` reconcile.
- Reuses the same permission flow, daily-trigger logic, and boot-time sync —
  no new native work. Designed so Step 1's module extends cleanly rather than
  being rewritten.

## Constraints (from CLAUDE.md / memory)

- Single-user, offline, no backend. **Local notifications only** — no push
  tokens, no APNs, no server. CLAUDE.md lists "push notifications beyond local
  reminders" as out of scope; local reminders are in scope.
- Distribution is a GitHub Actions unsigned IPA installed via SideStore, not
  Expo Go. Local notifications work in a standalone build without a paid signing
  entitlement (only remote push needs APNs). Adding `expo-notifications` is a new
  native dependency → **requires a new build**; it cannot be hot-reloaded into
  the existing install. Expo Go testing of local notifications is unreliable
  on recent SDKs — verify on the standalone build.
- Voice rules apply to all notification copy: short, declarative, period
  terminal punctuation, no exclamation marks, no emoji, no shame/motivational
  language. Run copy past the voice rules before shipping.

## Dependency

- `expo-notifications` (matching Expo SDK 54).
- Add its config plugin to `app.json`. iOS needs no extra entitlement for local
  notifications. Set the plugin so the notification permission prompt is only
  triggered by us at the right moment (not at launch).

## Architecture

### New module: `utils/notifications.ts`

The single boundary around `expo-notifications`. Nothing else imports the
library directly. Responsibilities:

- `configureNotificationHandler()` — set foreground presentation behavior
  (called once at module load or boot).
- `ensurePermission(): Promise<boolean>` — check current status, request if
  undetermined, return whether granted. Does not re-prompt once denied (iOS
  only shows the system prompt once anyway).
- `syncCheckInNotifications(morning, evening)` — the reconcile function.
  Cancels Lumen's existing scheduled check-ins by stable identifier, then
  schedules a daily-repeating trigger for each non-null time. This is
  idempotent: safe to call on every boot and on every settings change.
- Stable identifiers: `lumen.checkin.morning`, `lumen.checkin.evening`. Cancel
  by identifier so we never touch notifications we did not create and never
  accumulate duplicates.
- iOS daily trigger: `SchedulableTriggerInputTypes.DAILY` with `{ hour, minute }`
  parsed from the `"HH:mm"` string. The repeat handles day rollover — no
  per-day rescheduling needed.

### Notification content (draft — pending copy review)

- Morning: title `Morning.` / body `Your habits for today.`
- Evening: title `Evening.` / body `Log today before it closes.`

These follow the design-system greeting fragments. Treat as draft; the body
lines especially should get a voice pass.

### `state/settingsStore.ts` changes

- Add `_hasHydrated: boolean` plus an `onRehydrateStorage` callback that flips
  it true. The store doc comment already anticipates this: "Phase 4's
  notification scheduler can add a hydration gate when it arrives with a real
  boot-time consumer." We are that consumer — boot-time sync must read the
  persisted times, not the in-memory `null` defaults.

### `app/_layout.tsx` changes

- After boot, once `settingsStore._hasHydrated` is true, call
  `syncCheckInNotifications` with the persisted times. This reconciles state
  the OS may have dropped and applies any change made while the app was off.
- Do **not** request notification permission at boot. Permission is requested
  only when the user turns a reminder on (see below).

### `app/settings.tsx` changes

- In `onChangeMorning` / `onChangeEvening`: when a time transitions from `null`
  to a value (reminder turned on), call `ensurePermission()`. If denied, keep
  the time saved but show a one-time `Alert` explaining notifications are off
  in iOS Settings — do not revert the value, the picker is still the enabler.
- After any change, call `syncCheckInNotifications` with the new pair.

### `components/settings/CheckInRow.tsx` (optional)

- If permission is denied while a time is set, the right slot could show a
  muted `Notifications off` caption instead of the time, so the row does not
  silently lie. Optional polish; decide during implementation.

## Permission UX

- Requested lazily — the first time the user sets a check-in time.
- iOS shows the system prompt once. If denied, subsequent `ensurePermission`
  calls return false without re-prompting; the Alert points the user to iOS
  Settings.
- If granted later via iOS Settings, the boot-time sync picks it up on next
  launch with no extra code.

## Edge cases

- Permission denied → scheduling is a silent no-op; the optional CheckInRow
  caption surfaces it.
- Both times null → sync cancels everything, schedules nothing.
- Time changed → cancel-by-identifier then reschedule keeps exactly one of each.
- App reinstalled / fresh build → boot sync re-creates from persisted settings
  (AsyncStorage survives across builds of the same install; a true fresh
  install starts with `null` and nothing scheduled).
- Daily repeat means no day-rollover logic is needed.

## Files touched

| File | Change |
|---|---|
| `package.json` / `app.json` | add `expo-notifications` + config plugin |
| `utils/notifications.ts` | new — the expo-notifications boundary |
| `utils/notifications.test.ts` | new — test `"HH:mm"` → trigger parsing |
| `state/settingsStore.ts` | add `_hasHydrated` + `onRehydrateStorage` |
| `app/_layout.tsx` | boot-time `syncCheckInNotifications` after hydrate |
| `app/settings.tsx` | permission request + sync on change |
| `components/settings/CheckInRow.tsx` | optional permission-denied caption |

## Acceptance

- Set a morning time → grant permission → notification fires at that time the
  next day, and repeats daily.
- Change the time → only the new time fires; the old one does not.
- Turn a reminder off → no notification fires.
- Cold-start the app → reminders still fire (reconciled from persisted state).
- Deny permission → time stays saved, an Alert explains, nothing fires.

## 30-second verification script (for the owner, post-build)

1. Build via GitHub Actions, install the IPA through SideStore.
2. Settings → Morning check-in → set a time two minutes out → grant permission.
3. Background the app. Wait. The notification arrives.
4. Reopen → Settings → tap the row → Turn off. Background again past the time —
   nothing arrives.

## Open questions for the owner

- Approve the draft notification copy or supply replacements.
- Confirm a new build is acceptable (this dependency cannot ship without one).
