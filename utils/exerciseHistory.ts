/**
 * Pure derivations for the Exercise History screen.
 *
 * Lumen has no `exercises` table — exercise names live as strings on
 * `sets` rows (see migration 0001 + db/sets.ts). Exercise History is
 * therefore built entirely from the set log: every set ever logged for
 * one exercise name, joined to its parent workout. The screen reads a
 * flat list of those joined rows and these functions reshape them into
 * sessions, top sets, chart points, PRs, and rest gaps.
 *
 * Everything here is pure and free of date-fns / SQLite / React so the
 * logic is unit-testable in isolation (see exerciseHistory.test.ts).
 * String formatting — the "{N} sessions since {Month}." subtitle, the
 * relative-date tails — is presentation and lives with the screen, not
 * here.
 */

/**
 * One logged-set row joined to its workout. Mirrors the SQL query plan
 * in the Exercise History handoff: every `sets` row for an exercise,
 * plus the parent workout's id, start time, and routine name.
 *
 * The query is intentionally not restricted to completed workouts — a
 * set logged moments ago in the active workout the user came from is a
 * legitimate (in-progress) session and should appear.
 */
export type ExerciseSetRow = {
  workoutId: string;
  /** ISO timestamp the workout started. */
  startedAt: string;
  /** Routine name for the breadcrumb, or null if the template is gone. */
  templateName: string | null;
  setNumber: number;
  kg: number | null;
  reps: number | null;
  /** ISO timestamp the set itself was logged — drives rest gaps. */
  loggedAt: string;
};

/** A single logged set within a session. */
export type SessionSet = {
  setNumber: number;
  kg: number | null;
  reps: number | null;
  loggedAt: string;
};

/** All sets logged for one exercise inside one workout. */
export type ExerciseSession = {
  workoutId: string;
  startedAt: string;
  /** YYYY-MM-DD slice of `startedAt` — the session's calendar date. */
  date: string;
  templateName: string | null;
  /** Sets in ascending set-number order. */
  sets: ReadonlyArray<SessionSet>;
};

/** The heaviest set of a session — heaviest kg, highest reps as tiebreak. */
export type TopSet = {
  setNumber: number;
  kg: number;
  reps: number | null;
};

/** One plotted point on the top-set chart. */
export type ChartPoint = {
  workoutId: string;
  date: string;
  kg: number;
};

/** A personal record at a fixed rep count. */
export type RepPr = {
  kg: number;
  /** Calendar date the record was first set. */
  date: string;
  workoutId: string;
};

/** Rest gap after one set — null for the last set, which has no "after". */
export type SessionRest = {
  setNumber: number;
  restSeconds: number | null;
};

/**
 * Group flat set rows into sessions, one per workout, newest first.
 *
 * Does not trust the input order: sets within a session are sorted by
 * set number, and sessions by descending start time. `workoutId` is the
 * tiebreak on equal timestamps so the order is stable across calls.
 */
export function sessionsByWorkout(
  rows: ReadonlyArray<ExerciseSetRow>
): ReadonlyArray<ExerciseSession> {
  const byWorkout = new Map<
    string,
    {
      workoutId: string;
      startedAt: string;
      date: string;
      templateName: string | null;
      sets: SessionSet[];
    }
  >();

  for (const r of rows) {
    let session = byWorkout.get(r.workoutId);
    if (session === undefined) {
      session = {
        workoutId: r.workoutId,
        startedAt: r.startedAt,
        date: r.startedAt.slice(0, 10),
        templateName: r.templateName,
        sets: [],
      };
      byWorkout.set(r.workoutId, session);
    }
    session.sets.push({
      setNumber: r.setNumber,
      kg: r.kg,
      reps: r.reps,
      loggedAt: r.loggedAt,
    });
  }

  const sessions = [...byWorkout.values()];
  for (const s of sessions) {
    s.sets.sort((a, b) => a.setNumber - b.setNumber);
  }
  sessions.sort(
    (a, b) =>
      b.startedAt.localeCompare(a.startedAt) ||
      b.workoutId.localeCompare(a.workoutId)
  );
  return sessions;
}

/**
 * The top set of a session: heaviest kg, with the higher rep count
 * breaking ties (82.5kg x 6 beats 82.5kg x 5). Sets with no weight
 * logged (`kg === null`) cannot be a top set and are skipped. Returns
 * null when the session has no weighted set at all.
 */
export function topSet(sets: ReadonlyArray<SessionSet>): TopSet | null {
  let best: TopSet | null = null;
  for (const s of sets) {
    if (s.kg === null) continue;
    const heavier = best === null || s.kg > best.kg;
    const tieOnReps =
      best !== null && s.kg === best.kg && (s.reps ?? 0) > (best.reps ?? 0);
    if (heavier || tieOnReps) {
      best = { setNumber: s.setNumber, kg: s.kg, reps: s.reps };
    }
  }
  return best;
}

/**
 * Top-set weight per session, ordered oldest-first so the chart plots
 * left-to-right in time. Sessions with no weighted set contribute no
 * point — a bodyweight-only session is simply absent from the line.
 *
 * Order-independent: re-sorts by start time internally rather than
 * trusting the caller, so it is correct on raw `sessionsByWorkout`
 * output (newest-first) or any other ordering.
 */
export function chartPoints(
  sessions: ReadonlyArray<ExerciseSession>
): ReadonlyArray<ChartPoint> {
  const oldestFirst = [...sessions].sort(
    (a, b) =>
      a.startedAt.localeCompare(b.startedAt) ||
      a.workoutId.localeCompare(b.workoutId)
  );
  const points: ChartPoint[] = [];
  for (const session of oldestFirst) {
    const ts = topSet(session.sets);
    if (ts === null) continue;
    points.push({ workoutId: session.workoutId, date: session.date, kg: ts.kg });
  }
  return points;
}

/**
 * Heaviest weight ever logged at exactly `reps` reps, across every set
 * of every session. Ties resolve to the earliest session — a PR is
 * dated to when the record was first set, not when it was last matched.
 * Returns null when no set was ever logged at that rep count.
 */
export function prsByRep(
  sessions: ReadonlyArray<ExerciseSession>,
  reps: number
): RepPr | null {
  let best: (RepPr & { startedAt: string }) | null = null;
  for (const session of sessions) {
    for (const s of session.sets) {
      if (s.kg === null || s.reps !== reps) continue;
      const heavier = best === null || s.kg > best.kg;
      const earlierTie =
        best !== null &&
        s.kg === best.kg &&
        session.startedAt.localeCompare(best.startedAt) < 0;
      if (heavier || earlierTie) {
        best = {
          kg: s.kg,
          date: session.date,
          workoutId: session.workoutId,
          startedAt: session.startedAt,
        };
      }
    }
  }
  if (best === null) return null;
  return { kg: best.kg, date: best.date, workoutId: best.workoutId };
}

/**
 * Rest gap after each set, in whole seconds — the time between this
 * set's `loggedAt` and the next set's. The last set has no set after
 * it, so its rest is null (the screen renders that as an em-dash).
 *
 * Sets are sorted by set number internally. A non-positive gap (clock
 * skew, edited timestamps) is clamped to 0 rather than rendered
 * negative.
 */
export function restsForSession(
  sessionSets: ReadonlyArray<SessionSet>
): ReadonlyArray<SessionRest> {
  const ordered = [...sessionSets].sort((a, b) => a.setNumber - b.setNumber);
  return ordered.map((set, i) => {
    const next = ordered[i + 1];
    if (next === undefined) {
      return { setNumber: set.setNumber, restSeconds: null };
    }
    const deltaMs =
      new Date(next.loggedAt).getTime() - new Date(set.loggedAt).getTime();
    return {
      setNumber: set.setNumber,
      restSeconds: Math.max(0, Math.round(deltaMs / 1000)),
    };
  });
}

/**
 * Whether `session` set a top-set record: its top set is strictly
 * heavier than the top set of every session in `priorSessions`.
 *
 * "Strictly" matters — matching an existing best is not a new record.
 * The first weighted session is never a PR: there is no prior best to
 * beat, so it establishes the baseline rather than breaking it. A
 * session with no weighted set is never a PR.
 */
export function isTopSetPR(
  session: ExerciseSession,
  priorSessions: ReadonlyArray<ExerciseSession>
): boolean {
  const current = topSet(session.sets);
  if (current === null) return false;

  let priorBest = -Infinity;
  for (const p of priorSessions) {
    const pTop = topSet(p.sets);
    if (pTop !== null && pTop.kg > priorBest) priorBest = pTop.kg;
  }
  if (priorBest === -Infinity) return false;
  return current.kg > priorBest;
}

/**
 * The workout ids of every session that set a top-set record, found by
 * walking sessions oldest-to-newest and testing each against the ones
 * before it. The history list renders a PR pill on exactly these rows.
 */
export function prSessionIds(
  sessions: ReadonlyArray<ExerciseSession>
): ReadonlySet<string> {
  const oldestFirst = [...sessions].sort(
    (a, b) =>
      a.startedAt.localeCompare(b.startedAt) ||
      a.workoutId.localeCompare(b.workoutId)
  );
  const ids = new Set<string>();
  for (let i = 0; i < oldestFirst.length; i += 1) {
    if (isTopSetPR(oldestFirst[i], oldestFirst.slice(0, i))) {
      ids.add(oldestFirst[i].workoutId);
    }
  }
  return ids;
}

/** Minimum session count before the PR row is allowed to appear. */
export const PR_ROW_MIN_SESSIONS = 10;

/** The two rep counts the PR row reports on. */
export const PR_REP_RANGES = [5, 8] as const;

/**
 * Whether the top-set chart should render. The chart is hidden in the
 * single-session state — a line needs at least two points to read as a
 * line. Note this is a session-count gate only; the screen should also
 * confirm `chartPoints` is non-empty before drawing, since a run of
 * bodyweight-only sessions yields two sessions but zero plottable
 * points.
 */
export function shouldShowChart(
  sessions: ReadonlyArray<ExerciseSession>
): boolean {
  return sessions.length >= 2;
}

/**
 * Whether the 5-rep / 8-rep PR row should render. Two gates, both
 * required: at least PR_ROW_MIN_SESSIONS sessions logged, and a real
 * weighted set at every rep count in PR_REP_RANGES. Below either gate
 * the row is hidden entirely — it never collapses to a single column.
 */
export function shouldShowPrRow(
  sessions: ReadonlyArray<ExerciseSession>
): boolean {
  if (sessions.length < PR_ROW_MIN_SESSIONS) return false;
  return PR_REP_RANGES.every((reps) => prsByRep(sessions, reps) !== null);
}
