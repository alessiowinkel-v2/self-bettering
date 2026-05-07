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

If all pass: invoke the `reviewer` subagent, then the `runtime-auditor` subagent. Pass each the same payload:
- The current branch's diff against `main` (use `git diff main...HEAD`).
- A one-paragraph summary of what this phase added, derived from recent commits.

Print both full reports back-to-back without summarizing, in this order:
1. Reviewer report — design and architecture concerns.
2. Runtime auditor report — runtime-failure pattern scan.

If one of the two agents errors out, surface the failure and continue to the other. Never block the whole flow on a single agent's tooling hiccup.
