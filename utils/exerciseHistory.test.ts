/**
 * Unit tests for the Exercise History pure derivations.
 *
 * These functions touch no SQLite, no React, no date-fns, so they run
 * as a plain script — no in-app harness needed (unlike db/test.ts).
 *
 * Compile and run:
 *   npx tsc utils/exerciseHistory.ts utils/exerciseHistory.test.ts \
 *     --outDir .tmp-eh --module commonjs --target es2022 --strict
 *   node .tmp-eh/utils/exerciseHistory.test.js
 *
 * A failing assertion throws, so the node process exits non-zero.
 */

import {
  chartPoints,
  isTopSetPR,
  prsByRep,
  prSessionIds,
  restsForSession,
  sessionsByWorkout,
  shouldShowChart,
  shouldShowPrRow,
  topSet,
  type ExerciseSession,
  type ExerciseSetRow,
  type SessionSet,
} from './exerciseHistory';

// --- tiny test harness --------------------------------------------------

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({
      name,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

function eq<T>(actual: T, expected: T, msg: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${msg} — expected ${b}, got ${a}`);
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// --- fixture builders ---------------------------------------------------

/** A set row with sensible defaults; override only what a test cares about. */
function row(
  over: Partial<ExerciseSetRow> & { workoutId: string; setNumber: number }
): ExerciseSetRow {
  return {
    startedAt: '2026-02-01T10:00:00.000Z',
    templateName: 'Push A',
    kg: 80,
    reps: 6,
    loggedAt: '2026-02-01T10:00:00.000Z',
    ...over,
  };
}

/** A session built directly, bypassing sessionsByWorkout. */
function session(
  workoutId: string,
  startedAt: string,
  sets: ReadonlyArray<SessionSet>
): ExerciseSession {
  return {
    workoutId,
    startedAt,
    date: startedAt.slice(0, 10),
    templateName: 'Push A',
    sets,
  };
}

function set(
  setNumber: number,
  kg: number | null,
  reps: number | null,
  loggedAt = '2026-02-01T10:00:00.000Z'
): SessionSet {
  return { setNumber, kg, reps, loggedAt };
}

// --- sessionsByWorkout --------------------------------------------------

test('sessionsByWorkout groups rows by workout, newest session first', () => {
  const sessions = sessionsByWorkout([
    row({ workoutId: 'w1', startedAt: '2026-02-01T10:00:00.000Z', setNumber: 1 }),
    row({ workoutId: 'w1', startedAt: '2026-02-01T10:00:00.000Z', setNumber: 2 }),
    row({ workoutId: 'w2', startedAt: '2026-02-08T10:00:00.000Z', setNumber: 1 }),
  ]);
  eq(sessions.length, 2, 'two distinct workouts');
  eq(sessions[0].workoutId, 'w2', 'newest workout leads');
  eq(sessions[1].workoutId, 'w1', 'older workout follows');
  eq(sessions[0].date, '2026-02-08', 'date is the YYYY-MM-DD slice of startedAt');
});

test('sessionsByWorkout sorts sets by set number regardless of input order', () => {
  const sessions = sessionsByWorkout([
    row({ workoutId: 'w1', setNumber: 3 }),
    row({ workoutId: 'w1', setNumber: 1 }),
    row({ workoutId: 'w1', setNumber: 2 }),
  ]);
  eq(
    sessions[0].sets.map((s) => s.setNumber),
    [1, 2, 3],
    'sets ascending by number'
  );
});

test('sessionsByWorkout returns no sessions for an empty row list', () => {
  eq(sessionsByWorkout([]).length, 0, 'empty in, empty out');
});

// --- topSet -------------------------------------------------------------

test('topSet picks the heaviest weight', () => {
  const ts = topSet([set(1, 80, 8), set(2, 85, 5), set(3, 82.5, 6)]);
  eq(ts, { setNumber: 2, kg: 85, reps: 5 }, 'heaviest kg wins');
});

test('topSet breaks a weight tie on the higher rep count', () => {
  const ts = topSet([set(1, 82.5, 5), set(2, 82.5, 6), set(3, 82.5, 4)]);
  eq(ts, { setNumber: 2, kg: 82.5, reps: 6 }, 'same kg, most reps wins');
});

test('topSet ignores sets with no weight logged', () => {
  const ts = topSet([set(1, null, 12), set(2, 60, 8)]);
  eq(ts, { setNumber: 2, kg: 60, reps: 8 }, 'bodyweight set skipped');
});

test('topSet returns null when no set has a weight', () => {
  eq(topSet([set(1, null, 12), set(2, null, 10)]), null, 'no weighted set');
  eq(topSet([]), null, 'no sets at all');
});

// --- chartPoints --------------------------------------------------------

test('chartPoints emits one oldest-first point per weighted session', () => {
  const sessions = [
    session('w3', '2026-02-15T10:00:00.000Z', [set(1, 90, 5)]),
    session('w1', '2026-02-01T10:00:00.000Z', [set(1, 80, 6)]),
    session('w2', '2026-02-08T10:00:00.000Z', [set(1, 85, 6), set(2, 87.5, 4)]),
  ];
  eq(
    chartPoints(sessions),
    [
      { workoutId: 'w1', date: '2026-02-01', kg: 80 },
      { workoutId: 'w2', date: '2026-02-08', kg: 87.5 },
      { workoutId: 'w3', date: '2026-02-15', kg: 90 },
    ],
    'points oldest-first, kg = top set'
  );
});

test('chartPoints skips sessions with no weighted set', () => {
  const sessions = [
    session('w1', '2026-02-01T10:00:00.000Z', [set(1, 80, 6)]),
    session('w2', '2026-02-08T10:00:00.000Z', [set(1, null, 12)]),
  ];
  const points = chartPoints(sessions);
  eq(points.length, 1, 'bodyweight-only session contributes no point');
  eq(points[0].workoutId, 'w1', 'only the weighted session plots');
});

// --- prsByRep -----------------------------------------------------------

test('prsByRep finds the heaviest weight at exactly that rep count', () => {
  const sessions = [
    session('w1', '2026-02-01T10:00:00.000Z', [set(1, 80, 5), set(2, 75, 8)]),
    session('w2', '2026-02-08T10:00:00.000Z', [set(1, 85, 5), set(2, 60, 8)]),
  ];
  eq(
    prsByRep(sessions, 5),
    { kg: 85, date: '2026-02-08', workoutId: 'w2' },
    '5-rep PR is the heaviest 5-rep set'
  );
  eq(
    prsByRep(sessions, 8),
    { kg: 75, date: '2026-02-01', workoutId: 'w1' },
    '8-rep PR ignores 5-rep sets'
  );
});

test('prsByRep dates a tie to the earliest session', () => {
  const sessions = [
    session('wB', '2026-02-08T10:00:00.000Z', [set(1, 100, 5)]),
    session('wA', '2026-02-01T10:00:00.000Z', [set(1, 100, 5)]),
  ];
  eq(
    prsByRep(sessions, 5),
    { kg: 100, date: '2026-02-01', workoutId: 'wA' },
    'equal weight dates to when the record was first set'
  );
});

test('prsByRep returns null when nothing was logged at that rep count', () => {
  const sessions = [
    session('w1', '2026-02-01T10:00:00.000Z', [set(1, 80, 6), set(2, 80, 7)]),
  ];
  eq(prsByRep(sessions, 5), null, 'no 5-rep set ever logged');
});

test('prsByRep ignores sets at the rep count with no weight', () => {
  const sessions = [
    session('w1', '2026-02-01T10:00:00.000Z', [set(1, null, 5)]),
  ];
  eq(prsByRep(sessions, 5), null, 'bodyweight set is not a weighted PR');
});

// --- restsForSession ----------------------------------------------------

test('restsForSession measures gaps between consecutive logs', () => {
  const rests = restsForSession([
    set(1, 80, 6, '2026-02-01T10:00:00.000Z'),
    set(2, 80, 6, '2026-02-01T10:01:32.000Z'),
    set(3, 80, 5, '2026-02-01T10:03:17.000Z'),
  ]);
  eq(
    rests,
    [
      { setNumber: 1, restSeconds: 92 },
      { setNumber: 2, restSeconds: 105 },
      { setNumber: 3, restSeconds: null },
    ],
    'gap in seconds, last set has no rest'
  );
});

test('restsForSession returns a single null rest for a one-set session', () => {
  eq(
    restsForSession([set(1, 80, 6)]),
    [{ setNumber: 1, restSeconds: null }],
    'one set, one null'
  );
});

test('restsForSession sorts by set number before measuring', () => {
  const rests = restsForSession([
    set(2, 80, 6, '2026-02-01T10:01:00.000Z'),
    set(1, 80, 6, '2026-02-01T10:00:00.000Z'),
  ]);
  eq(
    rests,
    [
      { setNumber: 1, restSeconds: 60 },
      { setNumber: 2, restSeconds: null },
    ],
    'unsorted input still measures set 1 -> set 2'
  );
});

test('restsForSession clamps a negative gap to zero', () => {
  const rests = restsForSession([
    set(1, 80, 6, '2026-02-01T10:05:00.000Z'),
    set(2, 80, 6, '2026-02-01T10:04:00.000Z'),
  ]);
  eq(rests[0].restSeconds, 0, 'clock skew never renders as negative rest');
});

// --- isTopSetPR ---------------------------------------------------------

test('isTopSetPR is true when the top set beats every prior session', () => {
  const prior = [
    session('w1', '2026-02-01T10:00:00.000Z', [set(1, 80, 6)]),
    session('w2', '2026-02-08T10:00:00.000Z', [set(1, 82.5, 6)]),
  ];
  const current = session('w3', '2026-02-15T10:00:00.000Z', [set(1, 85, 5)]);
  assert(isTopSetPR(current, prior), '85 beats prior best of 82.5');
});

test('isTopSetPR is false when the top set only matches the prior best', () => {
  const prior = [session('w1', '2026-02-01T10:00:00.000Z', [set(1, 85, 6)])];
  const current = session('w2', '2026-02-08T10:00:00.000Z', [set(1, 85, 5)]);
  assert(!isTopSetPR(current, prior), 'matching a record is not a new record');
});

test('isTopSetPR is false for the first weighted session', () => {
  const current = session('w1', '2026-02-01T10:00:00.000Z', [set(1, 80, 6)]);
  assert(!isTopSetPR(current, []), 'nothing prior to beat');
});

test('isTopSetPR is false for a session with no weighted set', () => {
  const prior = [session('w1', '2026-02-01T10:00:00.000Z', [set(1, 80, 6)])];
  const current = session('w2', '2026-02-08T10:00:00.000Z', [set(1, null, 12)]);
  assert(!isTopSetPR(current, prior), 'a bodyweight session sets no record');
});

test('isTopSetPR is false for a session that ties an earlier record exactly', () => {
  // session 1 establishes 100kg x 5 as the record.
  const s1 = session('w1', '2026-02-01T10:00:00.000Z', [set(1, 100, 5)]);
  // session 2 logs the identical set — same kg, same reps. A tie, not a win.
  const s2 = session('w2', '2026-02-08T10:00:00.000Z', [set(1, 100, 5)]);
  // session 3 logs 105kg x 5 — clears both.
  const s3 = session('w3', '2026-02-15T10:00:00.000Z', [set(1, 105, 5)]);

  // session 1 holds the record but breaks nothing prior to it, so it is
  // not flagged a PR — the first weighted session is always the baseline.
  assert(!isTopSetPR(s1, []), 'session 1 is the baseline, not a PR break');
  assert(!isTopSetPR(s2, [s1]), 'session 2 ties session 1 exactly — not a PR');
  assert(isTopSetPR(s3, [s1, s2]), 'session 3 beats both — a PR');
});

// --- prSessionIds -------------------------------------------------------

test('prSessionIds marks each session that broke the running record', () => {
  const sessions = [
    session('w1', '2026-02-01T10:00:00.000Z', [set(1, 80, 6)]), // baseline
    session('w2', '2026-02-08T10:00:00.000Z', [set(1, 82.5, 6)]), // PR
    session('w3', '2026-02-15T10:00:00.000Z', [set(1, 82.5, 8)]), // matches, no PR
    session('w4', '2026-02-22T10:00:00.000Z', [set(1, 85, 5)]), // PR
  ];
  const ids = prSessionIds(sessions);
  eq([...ids].sort(), ['w2', 'w4'], 'only the record-breaking sessions');
  assert(!ids.has('w1'), 'first session is the baseline, not a PR');
  assert(!ids.has('w3'), 'matching the record is not a PR');
});

test('prSessionIds flags only the session that clears the running best', () => {
  // session 2 dips below session 1, then session 3 clears both.
  const sessions = [
    session('w1', '2026-02-01T10:00:00.000Z', [set(1, 100, 5)]),
    session('w2', '2026-02-08T10:00:00.000Z', [set(1, 95, 5)]),
    session('w3', '2026-02-15T10:00:00.000Z', [set(1, 105, 5)]),
  ];
  eq([...prSessionIds(sessions)], ['w3'], 'only session 3 is a PR');
});

test('prSessionIds returns an empty set for a single session', () => {
  const sessions = [
    session('w1', '2026-02-01T10:00:00.000Z', [set(1, 100, 5)]),
  ];
  eq(prSessionIds(sessions).size, 0, 'one session, nothing prior to beat');
});

// --- shouldShowChart ----------------------------------------------------

test('shouldShowChart hides the chart for a single session', () => {
  const one = [session('w1', '2026-02-01T10:00:00.000Z', [set(1, 80, 6)])];
  assert(!shouldShowChart(one), 'one session, no chart');
  assert(!shouldShowChart([]), 'no sessions, no chart');
});

test('shouldShowChart shows the chart from two sessions up', () => {
  const two = [
    session('w1', '2026-02-01T10:00:00.000Z', [set(1, 80, 6)]),
    session('w2', '2026-02-08T10:00:00.000Z', [set(1, 82.5, 6)]),
  ];
  assert(shouldShowChart(two), 'two sessions, chart visible');
});

// --- shouldShowPrRow ----------------------------------------------------

/** Build N sessions, each one weighted set, optionally at given reps. */
function manySessions(count: number, reps: number): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (let i = 0; i < count; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    out.push(
      session(`w${i}`, `2026-02-${day}T10:00:00.000Z`, [set(1, 80 + i, reps)])
    );
  }
  return out;
}

test('shouldShowPrRow hides the row below the session threshold', () => {
  const nine = manySessions(9, 5).map((s, i) =>
    i === 0 ? session(s.workoutId, s.startedAt, [set(1, 80, 5), set(2, 70, 8)]) : s
  );
  assert(!shouldShowPrRow(nine), 'nine sessions is below the 10-session gate');
});

test('shouldShowPrRow hides the row when a rep range is missing', () => {
  // Ten sessions, but every set is 5 reps — no 8-rep data.
  assert(
    !shouldShowPrRow(manySessions(10, 5)),
    'no 8-rep set means no PR row'
  );
});

test('shouldShowPrRow shows the row at 10+ sessions with both rep ranges', () => {
  const ten = manySessions(10, 5);
  // Give one session an 8-rep weighted set so both ranges are present.
  ten[0] = session(ten[0].workoutId, ten[0].startedAt, [
    set(1, 80, 5),
    set(2, 70, 8),
  ]);
  assert(shouldShowPrRow(ten), 'ten sessions with 5-rep and 8-rep data');
});

// --- report -------------------------------------------------------------

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;

for (const r of results) {
  if (r.ok) {
    console.log(`PASS  ${r.name}`);
  } else {
    console.log(`FAIL  ${r.name}\n      ${r.detail ?? ''}`);
  }
}
console.log(`\n${passed}/${results.length} passed, ${failed} failed.`);

if (failed > 0) {
  throw new Error(`${failed} exerciseHistory test(s) failed.`);
}
