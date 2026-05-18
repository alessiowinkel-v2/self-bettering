import { create } from 'zustand';
import {
  getLastSetsForExerciseBeforeWorkout,
  getSetsForWorkout,
  logSet,
  type SetRow,
} from '../db/sets';
import {
  completeWorkout,
  discardWorkout,
  getWorkoutTemplates,
  startWorkout,
  type ResumableOrphan,
} from '../db/workouts';
import { haptics } from '../utils/haptics';
import { useSettingsStore } from './settingsStore';
import type { WorkoutTemplate } from './types';

/**
 * Active Workout store — state machine for the in-progress session.
 *
 * Source of truth for the workout-id, template, per-exercise progress,
 * and the rest-timer endpoint. Elapsed-time tick is NOT held here —
 * the screen owns a setInterval and a local `now` state so per-second
 * re-renders don't bleed into store subscribers.
 *
 * Single-writer assumption: the user is the only writer; the screen
 * is the only consumer. Mid-flight re-entry (e.g. two Logs racing)
 * is prevented at the UI level — Log is disabled while a write is in
 * flight, and back-out goes through an Alert.alert confirmation.
 *
 * Lifecycle:
 *   startNewWorkout(templateId)  → status: 'active'
 *   logCurrentSet(kg, reps)      → set persisted; rest banner armed;
 *                                  status flips to 'done' iff last
 *                                  set of last exercise was logged
 *   completeAndSave()            → completed_at + duration_seconds
 *                                  written; status stays 'done'; caller pops
 *   abandon()                    → store reset only; the workout row
 *                                  stays on disk as a resumable orphan
 *   discard()                    → workout row + sets deleted via
 *                                  CASCADE; store reset; caller pops
 */

export type LoggedSet = {
  setNumber: number;
  kg: number;
  reps: number;
};

export type ExerciseProgress = {
  /** Position inside the template's exercises array, 0-based. */
  index: number;
  name: string;
  setCount: number;
  repRange: readonly [number, number];
  /**
   * Per-exercise rest override in seconds, carried from the template.
   * `undefined` → fall back to the Settings default; `0` → no rest.
   */
  restDurationSeconds?: number;
  /**
   * Sets pulled from the most recent prior completed workout that
   * contained this exercise. Empty array means "first time this
   * exercise has been done" — the screen hides the LAST line and
   * skips the numeric-pad pill.
   */
  lastSets: ReadonlyArray<SetRow>;
  /** Sets logged so far in this workout, in set-number order. */
  loggedSets: ReadonlyArray<LoggedSet>;
};

/**
 * An exercise swapped away mid-workout. Snapshots the name, the sets
 * logged against it before the swap, and the slot index it occupied.
 * The index lets the previous-exercise merge interleave swapped-away
 * exercises with completed ones in chronological order.
 *
 * In-memory only. The DB still holds this exercise's sets under its
 * original name (keyed by workout_id) — the snapshot is purely for
 * in-session display and is never persisted.
 */
type SwappedOutExercise = {
  /** Index in exercises[] this exercise occupied when it was swapped away. */
  index: number;
  name: string;
  loggedSets: ReadonlyArray<LoggedSet>;
};

export type ActiveWorkoutStatus = 'idle' | 'loading' | 'active' | 'done';

type ActiveWorkoutState = {
  status: ActiveWorkoutStatus;
  workoutId: string | null;
  templateId: string | null;
  templateName: string | null;
  /** ISO timestamp the workout began. Screen ticks elapsed off this. */
  startedAt: string | null;
  exercises: ReadonlyArray<ExerciseProgress>;
  /** 0-based index into `exercises`. */
  currentExerciseIndex: number;
  /**
   * Wall-clock ms when the current rest ends. null = no rest active
   * (either none has been armed yet, or the last log was the final
   * set and we transitioned straight to 'done').
   */
  restEndsAt: number | null;
  /**
   * Exercises swapped away during this session, oldest-first. In-memory
   * only — never written to disk. Feeds the previous-exercise rows so a
   * swapped-away exercise stays visible above the current header with
   * the sets logged against it. Cleared with the rest of the slice.
   */
  swappedOut: ReadonlyArray<SwappedOutExercise>;

  startNewWorkout: (templateId: string) => Promise<void>;
  /**
   * Rehydrate the store from an existing orphan workout on disk. Same
   * resulting state shape as startNewWorkout — exercises[] populated
   * with prescription + lastSets + already-logged sets, currentExerciseIndex
   * pointing at the in-progress exercise — but does NOT insert a new
   * workout row (the orphan's row is reused as-is).
   */
  resumeWorkout: (orphan: ResumableOrphan) => Promise<void>;
  logCurrentSet: (input: { kg: number; reps: number }) => Promise<void>;
  skipRest: () => void;
  /**
   * Replace the current exercise with `pickedName`. Snapshots the
   * outgoing exercise onto `swappedOut`, renames the slot, clears its
   * logged sets, and re-queries the LAST line for the incoming
   * exercise. No-op when the pick resolves to the exercise already in
   * the slot (case-insensitive). Sets already logged for the outgoing
   * exercise stay on disk under its original name.
   */
  swapCurrentExercise: (pickedName: string) => Promise<void>;
  /**
   * Persists `completed_at` + `duration_seconds`. Does NOT reset the
   * store — `status` stays at `'done'` so the DoneTakeover stays
   * painted through the navigation. The screen's mount effect resets
   * the slot to 'idle' on the next /workout open via `resetToIdle`.
   */
  completeAndSave: () => Promise<void>;
  /**
   * Stop the session without finishing it. Resets the store only — the
   * workout row stays on disk with `completed_at IS NULL`, so it can be
   * resumed (or is GC'd after 24h by cleanupOrphanWorkouts).
   */
  abandon: () => Promise<void>;
  /**
   * Throw the session away. Deletes the workout row + its sets, then
   * resets the store. Nothing is recorded.
   */
  discard: () => Promise<void>;
  /**
   * Reset the active-workout slice to `initialState`. The screen's
   * mount effect calls this once on each open iff the current status
   * is 'done' — handling the post-save handoff without flashing a
   * blank screen between completeAndSave and router.back().
   */
  resetToIdle: () => void;
  reset: () => void;
};

const initialState = {
  status: 'idle' as ActiveWorkoutStatus,
  workoutId: null,
  templateId: null,
  templateName: null,
  startedAt: null,
  exercises: [] as ReadonlyArray<ExerciseProgress>,
  currentExerciseIndex: 0,
  restEndsAt: null,
  swappedOut: [] as ReadonlyArray<SwappedOutExercise>,
};

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  ...initialState,

  startNewWorkout: async (templateId) => {
    set({ status: 'loading' });

    // Resolve the template from the existing read path. The
    // Today/Gym stores carry templates too but this store is reachable
    // from screens that haven't necessarily hydrated those yet
    // (`router.push('/workout')` from a deep link in the future, etc).
    // One extra read keeps the store self-contained.
    const templates = await getWorkoutTemplates();
    const template: WorkoutTemplate | undefined = templates.find(
      (t) => t.id === templateId,
    );
    if (!template) {
      // Caller routed to a non-existent template — surface as a reset
      // rather than a half-loaded screen. The screen guards on
      // status === 'loading' and falls through to a quiet empty state
      // if status drops back to 'idle' without an active workoutId.
      set(initialState);
      throw new Error(`[activeWorkout] unknown template: ${templateId}`);
    }

    const { id, startedAt } = await startWorkout({ templateId });

    // Pull each exercise's prior sets in parallel. Promise.all serializes
    // under expo-sqlite's queue anyway, but the JS overhead per exercise
    // grows with exercise count.
    const lastSetsPerExercise = await Promise.all(
      template.exercises.map((ex) =>
        getLastSetsForExerciseBeforeWorkout({
          exerciseName: ex.name,
          currentWorkoutId: id,
        }),
      ),
    );

    const exercises: ReadonlyArray<ExerciseProgress> = template.exercises.map(
      (ex, i) => ({
        index: i,
        name: ex.name,
        setCount: ex.setCount,
        repRange: ex.repRange,
        restDurationSeconds: ex.restDurationSeconds,
        lastSets: lastSetsPerExercise[i],
        loggedSets: [],
      }),
    );

    set({
      status: 'active',
      workoutId: id,
      templateId,
      templateName: template.name,
      startedAt,
      exercises,
      currentExerciseIndex: 0,
      restEndsAt: null,
      swappedOut: [],
    });
  },

  resumeWorkout: async (orphan) => {
    set({ status: 'loading' });

    const templates = await getWorkoutTemplates();
    const template: WorkoutTemplate | undefined = templates.find(
      (t) => t.id === orphan.templateId,
    );
    if (!template) {
      // Template vanished between orphan capture and resume — fall
      // back to idle so the screen can route back cleanly.
      set(initialState);
      throw new Error(
        `[activeWorkout] resume: unknown template ${orphan.templateId}`,
      );
    }

    // Pull each exercise's prior-workout sets and the already-logged
    // sets for this workout in parallel.
    const [lastSetsPerExercise, loggedSets] = await Promise.all([
      Promise.all(
        template.exercises.map((ex) =>
          getLastSetsForExerciseBeforeWorkout({
            exerciseName: ex.name,
            currentWorkoutId: orphan.workoutId,
          }),
        ),
      ),
      getSetsForWorkout(orphan.workoutId),
    ]);

    // Group the logged sets by exercise name so we can hand each
    // ExerciseProgress its slice in set_number order.
    const loggedByExercise = new Map<string, LoggedSet[]>();
    for (const s of loggedSets) {
      if (s.kg === null || s.reps === null) continue;
      const arr = loggedByExercise.get(s.exerciseName) ?? [];
      arr.push({ setNumber: s.setNumber, kg: s.kg, reps: s.reps });
      loggedByExercise.set(s.exerciseName, arr);
    }
    for (const arr of loggedByExercise.values()) {
      arr.sort((a, b) => a.setNumber - b.setNumber);
    }

    const exercises: ReadonlyArray<ExerciseProgress> = template.exercises.map(
      (ex, i) => ({
        index: i,
        name: ex.name,
        setCount: ex.setCount,
        repRange: ex.repRange,
        restDurationSeconds: ex.restDurationSeconds,
        lastSets: lastSetsPerExercise[i],
        loggedSets: loggedByExercise.get(ex.name) ?? [],
      }),
    );

    // Re-derive the in-progress exercise from the same rule the DB
    // layer uses: first exercise whose logged count falls short of
    // its prescription. Avoids trusting `orphan.currentExerciseName`
    // in case the template's exercise order changed since the
    // orphan was captured.
    let currentExerciseIndex = exercises.length - 1;
    for (let i = 0; i < exercises.length; i++) {
      if (exercises[i].loggedSets.length < exercises[i].setCount) {
        currentExerciseIndex = i;
        break;
      }
    }

    set({
      status: 'active',
      workoutId: orphan.workoutId,
      templateId: orphan.templateId,
      templateName: template.name,
      startedAt: orphan.startedAt,
      exercises,
      currentExerciseIndex,
      restEndsAt: null,
      swappedOut: [],
    });
  },

  logCurrentSet: async ({ kg, reps }) => {
    const state = get();
    if (state.status !== 'active' || state.workoutId === null) return;

    const exerciseIndex = state.currentExerciseIndex;
    const exercise = state.exercises[exerciseIndex];
    if (!exercise) return;

    const nextSetNumber = exercise.loggedSets.length + 1;
    if (nextSetNumber > exercise.setCount) return; // already complete

    await logSet({
      workoutId: state.workoutId,
      exerciseName: exercise.name,
      setNumber: nextSetNumber,
      kg,
      reps,
    });

    const updatedExercise: ExerciseProgress = {
      ...exercise,
      loggedSets: [
        ...exercise.loggedSets,
        { setNumber: nextSetNumber, kg, reps },
      ],
    };
    const exercises = state.exercises.map((e, i) =>
      i === exerciseIndex ? updatedExercise : e,
    );

    // Advance to next exercise if this one is complete.
    let currentExerciseIndex = exerciseIndex;
    if (updatedExercise.loggedSets.length >= updatedExercise.setCount) {
      currentExerciseIndex = exerciseIndex + 1;
    }

    // Workout complete iff there's no next exercise. The rest banner
    // is suppressed in that case — the user is about to see the Done
    // takeover, a rest countdown would be noise.
    const isComplete = currentExerciseIndex >= state.exercises.length;
    // Rest length: the just-logged exercise's override, or the Settings
    // default when it has none. A duration of 0 means "no rest" — arm
    // nothing, same as the complete case.
    const restSeconds =
      exercise.restDurationSeconds ??
      useSettingsStore.getState().defaultRestDurationSeconds;
    const restEndsAt =
      isComplete || restSeconds <= 0
        ? null
        : Date.now() + restSeconds * 1000;

    set({
      exercises,
      currentExerciseIndex: isComplete
        ? exerciseIndex // keep pointing at the last exercise for the takeover summary
        : currentExerciseIndex,
      restEndsAt,
      status: isComplete ? 'done' : 'active',
    });

    // Fire the workout-complete haptic on the active→done transition,
    // not on every DoneTakeover render. Living in the store means any
    // future surface (a watch companion, a widget) gets it for free.
    // The row Log already fired light() at the screen — success() here
    // is the additional confirmation that the workout itself ended.
    if (isComplete) haptics.success();
  },

  skipRest: () => {
    set({ restEndsAt: null });
  },

  swapCurrentExercise: async (pickedName) => {
    const state = get();
    if (state.status !== 'active' || state.workoutId === null) return;

    const exerciseIndex = state.currentExerciseIndex;
    const current = state.exercises[exerciseIndex];
    if (!current) return;

    const trimmed = pickedName.trim();
    // No-op guards. Empty pick is defensive (the picker trims its
    // add-new query already). The name match is case-insensitive: a
    // pick that only differs in capitalization is still "the exercise
    // you're on", and swapping would wipe loggedSets for nothing.
    if (trimmed.length === 0) return;
    if (trimmed.toLowerCase() === current.name.toLowerCase()) return;

    // Snapshot the outgoing exercise before mutating. loggedSets is a
    // frozen array — the swap below replaces the slot with a fresh
    // ExerciseProgress and never mutates this one — so holding the
    // reference is safe.
    const snapshot: SwappedOutExercise = {
      index: exerciseIndex,
      name: current.name,
      loggedSets: current.loggedSets,
    };

    // Re-query the LAST line for the incoming exercise — the same read
    // startNewWorkout runs per exercise. Status stays 'active' across
    // the await (no 'loading' flip) so the screen doesn't blank under
    // the dismissing picker.
    const lastSets = await getLastSetsForExerciseBeforeWorkout({
      exerciseName: trimmed,
      currentWorkoutId: state.workoutId,
    });

    const swapped: ExerciseProgress = {
      ...current,
      name: trimmed,
      lastSets,
      loggedSets: [],
    };

    set({
      exercises: state.exercises.map((e, i) =>
        i === exerciseIndex ? swapped : e,
      ),
      swappedOut: [...state.swappedOut, snapshot],
    });
  },

  completeAndSave: async () => {
    const state = get();
    if (state.workoutId === null || state.startedAt === null) return;
    const completedAt = new Date().toISOString();
    const durationSeconds = Math.max(
      0,
      Math.floor(
        (new Date(completedAt).getTime() -
          new Date(state.startedAt).getTime()) /
          1000,
      ),
    );
    await completeWorkout({
      id: state.workoutId,
      completedAt,
      durationSeconds,
    });
    // Intentionally leaves status at 'done'. The screen pops via
    // router.back() while DoneTakeover stays mounted; the next
    // /workout open calls resetToIdle on mount to clear the slot.
  },

  abandon: async () => {
    // Reset the active slice but leave the workout row on disk. Sets
    // logged so far are preserved as an orphan workout (completed_at
    // IS NULL); the 24h boot-cleanup in cleanupOrphanWorkouts will
    // GC the row if it's never resumed.
    //
    // This backs the "Pause" exit option — the session stops but the
    // data survives and can be resumed.
    set(initialState);
  },

  discard: async () => {
    // Delete the workout row outright (sets cascade) and reset. Backs
    // the "Discard" exit option — unlike abandon, nothing survives.
    const { workoutId } = get();
    if (workoutId !== null) await discardWorkout(workoutId);
    set(initialState);
  },

  resetToIdle: () => {
    set(initialState);
  },

  reset: () => {
    set(initialState);
  },
}));

/* --------------------------------- Selectors ------------------------------- */

/**
 * True iff the next-to-log set is the FINAL set of the FINAL exercise.
 *
 * Firing condition: `currentExerciseIndex === exercises.length - 1`
 * AND `loggedSets.length === setCount - 1` for that exercise. Crucially
 * this evaluates true BEFORE the final Log tap — the moment the user
 * begins entering values on the last set. That's what the design
 * wants: "Last one." surfaces as soon as the row is the active one,
 * including while the numeric pad is open.
 *
 * Returns false during 'loading', 'idle', or 'done'.
 */
export function selectIsLastSet(s: ActiveWorkoutState): boolean {
  if (s.status !== 'active') return false;
  if (s.exercises.length === 0) return false;
  if (s.currentExerciseIndex !== s.exercises.length - 1) return false;
  const exercise = s.exercises[s.currentExerciseIndex];
  return exercise.loggedSets.length === exercise.setCount - 1;
}
