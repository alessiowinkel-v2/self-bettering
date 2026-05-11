import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DoneTakeover,
  ExerciseHeader,
  NumericPad,
  PreviousExerciseRow,
  RestTimer,
  SetRow,
  type NumericPadMode,
  type SetRowStatus,
} from '../components/workout';
import { Text } from '../components/primitives';
import { useActiveWorkoutStore, selectIsLastSet } from '../state/activeWorkoutStore';
import { useGymHomeStore } from '../state/gymHomeStore';
import { useTodayStore } from '../state/todayStore';
import { useTheme } from '../theme';
import { formatElapsed } from '../utils/workout';

/**
 * Active Workout screen. Full-screen modal route at `/workout?templateId=...`.
 *
 * Lifecycle:
 *   mount        → startNewWorkout(templateId) populates store
 *   active       → user logs each set; rest banner pulses between logs
 *   last set     → "Last one." caption appears beneath the active row
 *                  (PDF page 18). Caption is the final element in the
 *                  scrollable column — there are no inactive rows
 *                  below it by definition.
 *   done         → store.status flips to 'done' after the final Log;
 *                  full-screen DoneTakeover replaces the active layout
 *   save         → completeAndSave writes completed_at + duration;
 *                  router.back() returns to the entry point
 *   abandon      → confirmed via Alert.alert from the back chevron;
 *                  the in-progress row is left on disk so logged
 *                  sets survive until the 24h orphan-cleanup, or
 *                  until Phase 4 surfaces resume-in-progress
 *
 * Elapsed time and rest countdown are screen-local:
 *   `now` ticks every second via setInterval and drives both the
 *   header's elapsed display and the rest banner's remaining-seconds
 *   computation. The store carries `startedAt` and `restEndsAt`; the
 *   tick doesn't touch the store, so no other subscribers re-render.
 *
 * Draft values: the active set row's kg and reps inputs live in screen
 * state. The pad's Log writes into the draft and dismisses; the row's
 * Log commits the draft (falling back to placeholder values from
 * `lastSets`) into the DB via logCurrentSet. Drafts reset whenever the
 * active set advances.
 */
export default function WorkoutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ templateId?: string }>();

  const status = useActiveWorkoutStore((s) => s.status);
  const workoutId = useActiveWorkoutStore((s) => s.workoutId);
  const templateId = useActiveWorkoutStore((s) => s.templateId);
  const templateName = useActiveWorkoutStore((s) => s.templateName);
  const startedAt = useActiveWorkoutStore((s) => s.startedAt);
  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const currentExerciseIndex = useActiveWorkoutStore(
    (s) => s.currentExerciseIndex,
  );
  const restEndsAt = useActiveWorkoutStore((s) => s.restEndsAt);
  const isLastSet = useActiveWorkoutStore(selectIsLastSet);
  const startNewWorkout = useActiveWorkoutStore((s) => s.startNewWorkout);
  const logCurrentSet = useActiveWorkoutStore((s) => s.logCurrentSet);
  const skipRest = useActiveWorkoutStore((s) => s.skipRest);
  const completeAndSave = useActiveWorkoutStore((s) => s.completeAndSave);
  const abandon = useActiveWorkoutStore((s) => s.abandon);
  const reset = useActiveWorkoutStore((s) => s.reset);
  const resetToIdle = useActiveWorkoutStore((s) => s.resetToIdle);

  // Bootstrap on mount.
  //
  // Two responsibilities sequenced in a single effect so ordering is
  // explicit (mount-reset before bootstrap):
  //   1. If the prior workout left status at 'done' (just saved and
  //      navigated away), clear it. Without this the bootstrap gate
  //      below sees status === 'done' and skips startNewWorkout.
  //   2. Decide whether to bootstrap a fresh workout. Reads from
  //      getState() so the gate sees the post-reset slot, not the
  //      stale closure value.
  //
  // Single-writer store; Fast Refresh during dev is the only way this
  // effect re-fires mid-workout (params.templateId is stable across
  // a session). The status check prevents Fast Refresh from arming a
  // second workout on top of an active one.
  useEffect(() => {
    const tid = params.templateId;
    if (typeof tid !== 'string' || tid.length === 0) {
      router.back();
      return;
    }
    if (useActiveWorkoutStore.getState().status === 'done') {
      resetToIdle();
    }
    const fresh = useActiveWorkoutStore.getState();
    if (
      fresh.status === 'idle' ||
      (fresh.templateId !== tid && fresh.status !== 'loading')
    ) {
      void startNewWorkout(tid).catch(() => {
        router.back();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.templateId]);

  // Tick driver for elapsed + rest. One interval per workout, cleared
  // on unmount. The dependency on `startedAt` re-arms cleanly if a
  // new workout begins while the screen is still mounted (e.g. Fast
  // Refresh during dev).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsedSeconds = useMemo(() => {
    if (!startedAt) return 0;
    return Math.max(
      0,
      Math.floor((now - new Date(startedAt).getTime()) / 1000),
    );
  }, [now, startedAt]);

  const restRemaining = useMemo(() => {
    if (restEndsAt === null) return 0;
    return Math.max(0, Math.ceil((restEndsAt - now) / 1000));
  }, [restEndsAt, now]);

  // Crossing the rest countdown from > 0 to 0 dismisses the banner
  // exactly once. Without this guard, the equality check `>= 0`
  // would keep the banner mounted permanently after the timer hit
  // zero (restEndsAt is still set in the store).
  useEffect(() => {
    if (restEndsAt !== null && restRemaining === 0) {
      skipRest();
    }
  }, [restEndsAt, restRemaining, skipRest]);

  // Draft kg/reps for the active set. Resets every time the active
  // set advances (currentExerciseIndex or loggedSets.length changes).
  const currentExercise = exercises[currentExerciseIndex];
  const currentSetNumber = currentExercise
    ? currentExercise.loggedSets.length + 1
    : 0;
  const placeholderForCurrentSet = useMemo(() => {
    if (!currentExercise || currentSetNumber <= 0) return null;
    return currentExercise.lastSets[currentSetNumber - 1] ?? null;
  }, [currentExercise, currentSetNumber]);

  const [draftKg, setDraftKg] = useState<number | null>(null);
  const [draftReps, setDraftReps] = useState<number | null>(null);
  useEffect(() => {
    setDraftKg(null);
    setDraftReps(null);
  }, [currentExerciseIndex, currentSetNumber]);

  // Numeric pad open state. Non-null = pad covers bottom half; null = hidden.
  const [editingField, setEditingField] = useState<NumericPadMode | null>(null);

  const displayedKg = draftKg ?? placeholderForCurrentSet?.kg ?? null;
  const displayedReps = draftReps ?? placeholderForCurrentSet?.reps ?? null;
  const canLog = displayedKg !== null && displayedReps !== null;

  const onTapKg = useCallback(() => setEditingField('kg'), []);
  const onTapReps = useCallback(() => setEditingField('reps'), []);
  const onPadCommit = useCallback(
    (value: number) => {
      if (editingField === 'kg') {
        setDraftKg(value);
      } else if (editingField === 'reps') {
        setDraftReps(value);
      }
      setEditingField(null);
    },
    [editingField],
  );
  const onPadDismiss = useCallback(() => setEditingField(null), []);

  const onRowLog = useCallback(async () => {
    if (displayedKg === null || displayedReps === null) return;
    await logCurrentSet({ kg: displayedKg, reps: displayedReps });
  }, [displayedKg, displayedReps, logCurrentSet]);

  const onSave = useCallback(async () => {
    await completeAndSave();
    // Re-hydrate Today and Gym so the completed workout surfaces on
    // both tabs immediately (next-workout rotation, this-week dots,
    // routine last-completed date).
    await Promise.all([
      useTodayStore.getState().hydrate(),
      useGymHomeStore.getState().hydrate(),
    ]);
    router.back();
  }, [completeAndSave, router]);

  const onBackPress = useCallback(() => {
    if (status === 'done' || status === 'idle') {
      router.back();
      return;
    }
    Alert.alert(
      'End workout.',
      'Sets logged so far are kept.',
      [
        { text: 'Keep going.', style: 'cancel' },
        {
          text: 'End.',
          style: 'destructive',
          onPress: async () => {
            await abandon();
            router.back();
          },
        },
      ],
      { cancelable: true },
    );
  }, [status, router, abandon]);

  // Reset the store if the screen unmounts in a non-final state
  // (Fast Refresh, force-quit, JS reload). We don't auto-abandon — a
  // crash mid-workout leaves an in-progress row that the boot-time
  // cleanup will GC after 24h.
  useEffect(() => {
    return () => {
      if (useActiveWorkoutStore.getState().status !== 'done') {
        reset();
      }
    };
  }, [reset]);

  if (status === 'loading' || status === 'idle' || !templateName) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        edges={['top']}
      />
    );
  }

  if (status === 'done') {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        edges={['top']}
      >
        <DoneTakeover durationSeconds={elapsedSeconds} onSave={onSave} />
      </SafeAreaView>
    );
  }

  // Active layout. Previous-exercise rows render above the current
  // exercise header in completion order (already-completed exercises).
  const previousExercises = exercises.slice(0, currentExerciseIndex);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      edges={['top']}
    >
      {/* Header row.
          Side elements are absolute-positioned so the centered title
          sits on the visual midline regardless of how wide the back
          chevron and elapsed timer happen to be. A simple
          space-between row would float the title left of center when
          the two gutters have different widths. The wrapper still
          takes up vertical room via the centered title's intrinsic
          height + padding. */}
      <View
        style={{
          paddingHorizontal: theme.spacing[5],
          paddingVertical: theme.spacing[3],
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={onBackPress}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="End workout"
          style={{
            position: 'absolute',
            left: theme.spacing[5],
            top: 0,
            bottom: 0,
            justifyContent: 'center',
          }}
        >
          <ChevronLeft
            size={24}
            color={theme.colors.textSecondary}
            strokeWidth={1.5}
          />
        </Pressable>
        <Text variant="label" tone="secondary">
          {templateName.toUpperCase()}
        </Text>
        <View
          style={{
            position: 'absolute',
            right: theme.spacing[5],
            top: 0,
            bottom: 0,
            justifyContent: 'center',
          }}
        >
          <Text variant="caption" tone="secondary">
            {formatElapsed(elapsedSeconds)}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing[5],
          paddingTop: theme.spacing[3],
          paddingBottom: theme.spacing[8] + 80, // headroom for rest banner
        }}
      >
        {previousExercises.map((ex) => (
          <PreviousExerciseRow
            key={ex.name}
            name={ex.name}
            sets={ex.loggedSets}
          />
        ))}

        {currentExercise ? (
          <>
            <View style={{ marginTop: theme.spacing[3] }}>
              <ExerciseHeader
                name={currentExercise.name}
                setCount={currentExercise.setCount}
                repRange={currentExercise.repRange}
                lastSets={currentExercise.lastSets}
              />
            </View>

            {/* SETS group header. Same small-caps + secondary treatment
                as the "LAST" line in ExerciseHeader, and the same
                spacing[4] top margin against its preceding sibling so
                the two labels read as a single rhythm. */}
            <View style={{ marginTop: theme.spacing[4] }}>
              <Text
                variant="label"
                tone="secondary"
                style={{ marginBottom: theme.spacing[2] }}
              >
                SETS
              </Text>
              {Array.from({ length: currentExercise.setCount }, (_, i) => {
                const setNumber = i + 1;
                const isLogged = i < currentExercise.loggedSets.length;
                const isCurrent = setNumber === currentSetNumber;
                const rowStatus: SetRowStatus = isLogged
                  ? 'logged'
                  : isCurrent
                    ? 'active'
                    : 'inactive';

                let rowKg: number | null;
                let rowReps: number | null;
                let placeholderKg = false;
                let placeholderReps = false;
                if (isLogged) {
                  const logged = currentExercise.loggedSets[i];
                  rowKg = logged.kg;
                  rowReps = logged.reps;
                } else if (isCurrent) {
                  rowKg = displayedKg;
                  rowReps = displayedReps;
                  placeholderKg = draftKg === null;
                  placeholderReps = draftReps === null;
                } else {
                  const fallback = currentExercise.lastSets[i] ?? null;
                  rowKg = fallback?.kg ?? null;
                  rowReps = fallback?.reps ?? null;
                  placeholderKg = true;
                  placeholderReps = true;
                }

                return (
                  <SetRow
                    key={setNumber}
                    setNumber={setNumber}
                    status={rowStatus}
                    kg={rowKg}
                    reps={rowReps}
                    isPlaceholderKg={placeholderKg}
                    isPlaceholderReps={placeholderReps}
                    onTapKg={isCurrent ? onTapKg : undefined}
                    onTapReps={isCurrent ? onTapReps : undefined}
                    onLog={isCurrent ? onRowLog : undefined}
                    canLog={canLog}
                  />
                );
              })}
              {isLastSet ? (
                <Text
                  variant="bodyItalicFraunces"
                  tone="secondary"
                  style={{ marginTop: theme.spacing[3] }}
                >
                  Last one.
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Rest banner. Hidden when the pad is open — the pad sits at
          the bottom and would visually fight the banner. */}
      {restRemaining > 0 && editingField === null ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <RestTimer remainingSeconds={restRemaining} onSkip={skipRest} />
        </View>
      ) : null}

      {/* Numeric pad overlay. Tap-outside (the transparent backdrop
          above the pad) dismisses without committing. */}
      {editingField !== null ? (
        <>
          <Pressable
            onPress={onPadDismiss}
            accessibilityLabel="Close numeric pad"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            <NumericPad
              key={`${editingField}-${currentExerciseIndex}-${currentSetNumber}`}
              mode={editingField}
              initialValue={
                editingField === 'kg' ? displayedKg : displayedReps
              }
              lastValue={
                editingField === 'kg'
                  ? (placeholderForCurrentSet?.kg ?? null)
                  : (placeholderForCurrentSet?.reps ?? null)
              }
              onLog={onPadCommit}
            />
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}
