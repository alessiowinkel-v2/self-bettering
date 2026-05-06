---
description: Scaffold a new expo-router screen with the right route placement and a placeholder body.
argument-hint: <screen-name> [tab|modal|nested]
---

Scaffold a new screen for: $ARGUMENTS

Default placement is `app/(tabs)/<name>.tsx` (a new tab). If the argument includes `modal`, place it under `app/` as a modal route. If it includes a path like `habits/new`, treat it as a nested route under that tab.

Steps:

1. Confirm the parsed screen name and placement in one short sentence; proceed if obvious.
2. Read `app/(tabs)/_layout.tsx` and an existing tab file (e.g. `index.tsx` or `habits.tsx`) so the new screen matches their structure exactly.
3. Create the new screen as a tiny functional component:
   - `<View>` with `flex: 1`, centered horizontally and vertically.
   - `<Text>` showing the human-readable screen name.
   - Imports limited to what existing screens use.
4. If it is a tab, add a matching `<Tabs.Screen>` entry in `(tabs)/_layout.tsx` with the title set to the human-readable name.
5. Print the file tree of what changed and a one-line verification step ("open Expo Go, tap <name> tab, expect <name> centered").

Do not add styling beyond what existing tabs use. Do not introduce design tokens, icons, fonts, or any new dependencies. This is a placeholder, not a finished screen — finishing happens in a later phase via `ui-builder`.
