import { create } from 'zustand';
import {
  getLastSetsForExerciseBeforeWorkout,
  logSet,
  type SetRow,
} from '../db/sets';
import {
  completeWorkout,
  getWorkoutTemplates,
  startWorkout,
} from '../db/workouts';
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
 *                                  written; store reset; caller pops
 *   abandon()                    → workout row + sets deleted via
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
   * Sets pulled from the most recent prior completed workout that
   * contained this exercise. Empty array means "first time this
   * exercise has been done" — the screen hides the LAST line and
   * skips the numeric-pad pill.
   */
  lastSets: ReadonlyArray<SetRow>;
  /** Sets logged so far in this workout, in set-number order. */
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

  startNewWorkout: (templateId: string) => Promise<void>;
  logCurrentSet: (input: { kg: number; reps: number }) => Promise<void>;
  skipRest: () => void;
  /**
   * Persists `completed_at` + `duration_seconds`. Does NOT reset the
   * store — `status` stays at `'done'` so the DoneTakeover stays
   * painted through the navigation. The screen's mount effect resets
   * the slot to 'idle' on the next /workout open via `resetToIdle`.
   */
  completeAndSave: () => Promise<void>;
  abandon: () => Promise<void>;
  /**
   * Reset the active-workout slice to `initialState`. The screen's
   * mount effect calls this once on each open iff the current status
   * is 'done' — handling the post-save handoff without flashing a
   * blank screen between completeAndSave and router.back().
   */
  resetToIdle: () => void;
  reset: () => void;
};

/** Default rest duration in seconds. Phase 4+ may make this per-exercise. */
export const DEFAULT_REST_SECONDS = 90;

const initialState = {
  status: 'idle' as ActiveWorkoutStatus,
  workoutId: null,
  templateId: null,
  templateName: null,
  startedAt: null,
  exercises: [] as ReadonlyArray<ExerciseProgress>,
  currentExerciseIndex: 0,
  restEndsAt: null,
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
    const restEndsAt = isComplete
      ? null
      : Date.now() + DEFAULT_REST_SECONDS * 1000;

    set({
      exercises,
      currentExerciseIndex: isComplete
        ? exerciseIndex // keep pointing at the last exercise for the takeover summary
        : currentExerciseIndex,
      restEndsAt,
      status: isComplete ? 'done' : 'active',
    });
  },

  skipRest: () => {
    set({ restEndsAt: null });
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
    // GC the row if it's never resumed. Phase 4 will surface
    // resumable orphans on Gym Home.
    //
    // This is what the "End workout." Alert promises ("Sets logged
    // so far are kept.") — abandon stops the session without
    // destroying data.
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
