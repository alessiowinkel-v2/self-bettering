---
description: Run end-of-phase checks (typecheck, doctor, bundle build) and then invoke the reviewer subagent. Pass --quick to run only typecheck and expo-doctor.
argument-hint: [--quick]
---

Determine the mode from `$ARGUMENTS`:

- If it contains `--quick`, run steps 1 and 3 only, then invoke the reviewer.
- Otherwise, run all four steps in order, then invoke the reviewer.

Stop and surface failures rather than continuing past them. Do not auto-fix; report and wait.

1. `npx tsc --noEmit` — strict TypeScript must pass with zero errors.
2. Lint: check `package.json` for a `lint` script. If one exists, run it. If not, print "no lint configured yet, skipping" and continue.
3. `npx expo-doctor` — flags peer-dep and SDK mismatches.
4. `npx expo export --platform ios` — confirms the JS bundle builds without errors.

If any check fails: stop, show the error, and wait. Do not invoke the reviewer on a broken build.

If all pass: invoke the `reviewer` subagent. Pass it:
- The current branch's diff against `main` (use `git diff main...HEAD`).
- A one-paragraph summary of what this phase added, derived from recent commits.

Print the reviewer's full report back without summarizing.
