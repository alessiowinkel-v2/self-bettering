# Lumen

Personal iOS habit, journal, and gym-tracking app. Single user (the project owner).
Distributed via Expo Go on a personal iPhone. No App Store, no backend, no other users.

<important if="adding-any-feature-or-changing-data-model">
This is a SINGLE-USER PERSONAL APP. Never add:
- Authentication, accounts, login, signup, or password flows.
- User profiles, sharing, social features, or multi-tenancy.
- Cloud sync, server APIs, telemetry, or analytics.
- Any concept of "users" beyond the implicit single owner.

All data is local (SQLite via expo-sqlite). All operations are offline-first.
If a library or feature implies a server, stop and ask before introducing it.
</important>

## Stack

- Expo SDK 54, React Native 0.81, React 19, TypeScript strict.
- expo-router 6 (file-based navigation).
- expo-sqlite for persistence (Phase 2+).
- State: Zustand for app state. No React Query (overkill for a local-only app).
- No styling library yet. Design system phase introduces tokens.

## Setup

```powershell
npm install
npx expo start              # LAN mode, scan QR with Expo Go
npx expo start --tunnel     # Fallback if LAN fails (VPN, firewall, Wi-Fi isolation)
npx tsc --noEmit            # Strict typecheck
npx expo-doctor             # Peer-dep / SDK sanity
```

## Running on iPhone via Expo Go

1. Install Expo Go on the iPhone from the App Store.
2. iPhone and Windows laptop must share the same Wi-Fi (no client isolation).
3. Run `npx expo start` from this directory.
4. Open Expo Go and scan the QR (camera also works).
5. First bundle takes 30 to 90 seconds. Subsequent reloads are fast.

If the scan hangs or shows "Network response timed out":
- Disconnect VPN.
- Allow Node.js through Windows Defender Firewall on Private networks.
- Fall back to `npx expo start --tunnel` (slower but routes through ngrok).

## Tone and copy rules

<important if="writing-text-the-user-will-read">
- No emoji anywhere. UI, comments, commit messages, docs.
- Periods as terminal punctuation. No exclamation marks.
- Tab labels: "Today", "Habits", "Journal", "Gym".
- Plain, declarative sentences. No marketing tone.
</important>

## Workflow

<important if="planning-or-executing-implementation-work">
- Plan first. Show file tree and full file contents before creating.
- Wait for explicit approval before running build or install commands.
- Commit each finished phase on a feature branch — never on `main`. The user
  reviews, verifies on-device, and merges. One commit per phase, voice rules
  apply to the message.
- After implementation, give a 30-second verification script the user can run on their phone.
- Keep phases small and shippable. One concern per phase.
</important>

## Subagents (auto-routed by description triggers)

- `db-architect` — schema, migrations, data-access layer. Read first for any DB work.
- `ui-builder` — design system and screen composition. Loads frontend-design skill before acting.
- `reviewer` — staff-engineer critic. Runs at end of each phase. Read-only.
- `runtime-auditor` — read-only pattern check for runtime-failure shapes (Zustand selectors returning fresh refs, effect dep issues, conditional hooks). Runs at end of phase via `/ship-phase`.

> Adding or renaming an agent file under `.claude/agents/` requires a Claude Code restart. The agent registry is loaded at session start, so newly-tracked files are not dispatchable until the next session.

## Slash commands

- `/ship-phase [--quick]` — typecheck, doctor, bundle check, then invoke reviewer. `--quick` skips lint and bundle export.
- `/new-screen <name>` — scaffold a new expo-router screen with placeholder body.
- `/db-migrate <description>` — generate a migration via db-architect.

## Project knowledge (long-form imports)

These hold the longer briefs that don't belong inline. They may not all exist yet.
Imports for missing files are silently skipped.

@knowledge/design-system.md
@knowledge/screens-status.md
@knowledge/claude-code-prompt.md

## File tree

```
lumen/
├── app/                        expo-router routes
│   ├── _layout.tsx             Stack root, no chrome
│   └── (tabs)/                 4-tab bottom bar
│       ├── _layout.tsx
│       ├── index.tsx           Today
│       ├── habits.tsx
│       ├── journal.tsx
│       └── gym.tsx
├── knowledge/                  long-form briefs (imported above)
├── .claude/
│   ├── agents/                 subagent definitions
│   └── commands/               slash commands
├── CLAUDE.md
├── app.json
├── package.json
└── tsconfig.json
```
