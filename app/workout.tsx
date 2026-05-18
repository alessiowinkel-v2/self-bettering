import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DoneTakeover,
  ExerciseHeader,
  ExercisePicker,
  NumericPad,
  PreviousExerciseRow,
  RestTimer,
  SetRow,
  type NumericPadMode,
  type SetRowStatus,
} from '../components/workout';
import { Text } from '../components/primitives';
import {
  useActiveWorkoutStore,
  selectIsLastSet,
  type LoggedSet,
} from '../state/activeWorkoutStore';
import { useGymHomeStore } from '../state/gymHomeStore';
import { useTodayStore } from '../state/todayStore';
import { useTheme } from '../theme';
import { haptics } from '../utils/haptics';
import { formatElapsed } from '../utils/workout';
import { getMostRecentOrphan } from '../db/workouts';

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
 *
 * Deferred to Phase 4 (intentional gaps, not bugs):
 *   - Tick re-render scope. ElapsedDisplay and RestBanner could be
 *     extracted as children to localize the 1Hz re-render. Wait until
 *     rest-timer behavior gets more elaborate or DevTools shows it
 *     costing frames on real-device profiling.
 *   - In-flight guards on startNewWorkout / logCurrentSet /
 *     swapCurrentExercise. A row-Log cannot race a swap — the picker
 *     is a page-sheet covering the set rows. Swap-vs-swap is the one
 *     interleave the picker does not structurally rule out
 *     (swapCurrentExercise awaits one indexed read between its get()
 *     and set()), but the picker's dismiss-then-reopen animation
 *     dwarfs that read's latency, so it stays unreachable in practice.
 *     SetRow's isLogging gate + the DB-level UNIQUE constraint cover
 *     the row-Log double-tap; store-level guards stay deferred until a
 *     genuinely concurrent writer exists.
 *   - SetRow.handleLog silent error swallow. Wire to the toast/Alert
 *     system when that's built. The UNIQUE-collision case is no-op
 *     by design — silent is correct there; the gap is everything else.
 *   - Resume-in-progress UI on Gym Home. Orphan workouts (abandoned
 *     or force-quit) sit on disk for 24h until cleanupOrphanWorkouts
 *     GCs them; Phase 4 will surface them as "Pick up where you left
 *     off." rows so the kept sets are reachable before the GC fires.
 */
export default function WorkoutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ templateId?: string }>();

  const status = useActiveWorkoutStore((s) => s.status);
  const templateId = useActiveWorkoutStore((s) => s.templateId);
  const templateName = useActiveWorkoutStore((s) => s.templateName);
  const startedAt = useActiveWorkoutStore((s) => s.startedAt);
  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const currentExerciseIndex = useActiveWorkoutStore(
    (s) => s.currentExerciseIndex,
  );
  const restEndsAt = useActiveWorkoutStore((s) => s.restEndsAt);
  const swappedOut = useActiveWorkoutStore((s) => s.swappedOut);
  const isLastSet = useActiveWorkoutStore(selectIsLastSet);
  const startNewWorkout = useActiveWorkoutStore((s) => s.startNewWorkout);
  const resumeWorkout = useActiveWorkoutStore((s) => s.resumeWorkout);
  const logCurrentSet = useActiveWorkoutStore((s) => s.logCurrentSet);
  const skipRest = useActiveWorkoutStore((s) => s.skipRest);
  const swapCurrentExercise = useActiveWorkoutStore(
    (s) => s.swapCurrentExercise,
  );
  const completeAndSave = useActiveWorkoutStore((s) => s.completeAndSave);
  const abandon = useActiveWorkoutStore((s) => s.abandon);
  const discard = useActiveWorkoutStore((s) => s.discard);
  const reset = useActiveWorkoutStore((s) => s.reset);
  const resetToIdle = useActiveWorkoutStore((s) => s.resetToIdle);

  // Bootstrap on mount.
  //
  //   1. If the prior workout left status at 'done' (just saved and
  //      navigated away), clear it. Without this the bootstrap gate
  //      below sees status === 'done' and skips the open.
  //   2. Check for a resumable orphan workout for the requested
  //      templateId. If one exists, rehydrate the store from disk —
  //      logged sets reappear and the user lands on the in-progress
  //      set, not a fresh set 1.
  //   3. Otherwise, start a new workout for the templateId.
  //
  // Reads via getState() so the gate sees the post-reset slot rather
  // than a stale closure value.
  //
  // Deps: only `params.templateId` is reactive — the other reads
  // (`router`, `resetToIdle`, `startNewWorkout`, `resumeWorkout`)
  // hold stable refs (expo-router memoizes the router; zustand
  // action refs are created once at store init). They're listed
  // so exhaustive-deps stays honest without a disable; the effect
  // still only re-fires when the templateId param changes (Fast
  // Refresh aside).
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
      fresh.status !== 'idle' &&
      !(fresh.templateId !== tid && fresh.status !== 'loading')
    ) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const orphan = await getMostRecentOrphan();
        if (cancelled) return;
        if (orphan && orphan.templateId === tid) {
          await resumeWorkout(orphan);
        } else {
          await startNewWorkout(tid);
        }
      } catch {
        if (!cancelled) router.back();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.templateId, router, resetToIdle, startNewWorkout, resumeWorkout]);

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
  //
  // Haptic fires inside this transition guard so it triggers exactly
  // once per rest interval, even though the screen ticks `now` every
  // second. The user may be looking away — Success notification is
  // the right pattern (distinct from the routine impacts elsewhere).
  useEffect(() => {
    if (restEndsAt !== null && restRemaining === 0) {
      haptics.success();
      skipRest();
    }
  }, [restEndsAt, restRemaining, skipRest]);

  // Draft kg/reps for the active set. Resets every time the active
  // set advances (currentExerciseIndex or loggedSets.length changes).
  const currentExercise = exercises[currentExerciseIndex];
  const currentSetNumber = currentExercise
    ? currentExercise.loggedSets.length + 1
    : 0;
  // Primitive-keyed deps so invalidation is explicit:
  //   - `exercises` reference changes after every logCurrentSet (the
  //     store dispatches a new array) — keys the most common case.
  //   - `currentExerciseIndex` advances when an exercise completes.
  //   - `currentSetNumber` advances on every log within an exercise.
  // The body reads `currentExercise` from closure, which is just
  // `exercises[currentExerciseIndex]` — re-evaluated each render.
  const placeholderForCurrentSet = useMemo(() => {
    const ex = exercises[currentExerciseIndex];
    if (!ex) return null;
    return ex.lastSets[currentSetNumber - 1] ?? null;
  }, [exercises, currentExerciseIndex, currentSetNumber]);

  // Rows shown above the current exercise header — every exercise the
  // user has moved past, newest last. Two sources merge in workout
  // order: exercises that ran to completion (exercises[0..current-1])
  // and exercises swapped away (swappedOut[]). Per slot i, the
  // swapped-away occupants come before the exercise that completed in
  // that slot; slot `currentExerciseIndex` contributes only its
  // swapped-away occupants — its live occupant is the current exercise.
  // A swapped-away entry with no logged sets (swap on set 1) renders
  // nothing — PreviousExerciseRow guards on it — so the visible
  // previous row falls through to the last occupant that logged a set.
  // Keys are positional so duplicate names (swap back to an exercise
  // used earlier) never collide.
  const previousRows = useMemo(() => {
    const rows: Array<{
      key: string;
      name: string;
      sets: ReadonlyArray<LoggedSet>;
    }> = [];
    for (let i = 0; i <= currentExerciseIndex; i++) {
      swappedOut
        .filter((s) => s.index === i)
        .forEach((s, seq) => {
          rows.push({
            key: `swap-${i}-${seq}`,
            name: s.name,
            sets: s.loggedSets,
          });
        });
      if (i < currentExerciseIndex) {
        const ex = exercises[i];
        if (ex) {
          rows.push({ key: `done-${i}`, name: ex.name, sets: ex.loggedSets });
        }
      }
    }
    return rows;
  }, [exercises, currentExerciseIndex, swappedOut]);

  const [draftKg, setDraftKg] = useState<number | null>(null);
  const [draftReps, setDraftReps] = useState<number | null>(null);
  // Clear drafts when the active set advances. The `currentExercise?.name`
  // dep covers the one case the other two miss: a swap whose outgoing
  // exercise had zero logged sets leaves currentExerciseIndex and
  // currentSetNumber both unchanged, so only the name marks that the
  // active set now belongs to a different exercise.
  useEffect(() => {
    setDraftKg(null);
    setDraftReps(null);
  }, [currentExerciseIndex, currentSetNumber, currentExercise?.name]);

  // Numeric pad open state. Non-null = pad covers bottom half; null = hidden.
  const [editingField, setEditingField] = useState<NumericPadMode | null>(null);

  // Swap-exercise picker open state. The picker is a page-sheet modal —
  // while it's up the set rows are covered, so no Log can race the swap.
  const [swapPickerVisible, setSwapPickerVisible] = useState(false);

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

  // Open the swap picker. No haptic — opening the picker modal is the
  // system's own response to the tap.
  const onOpenSwap = useCallback(() => setSwapPickerVisible(true), []);
  const onCloseSwap = useCallback(() => setSwapPickerVisible(false), []);

  // Open the current exercise's history. Pushed onto the stack above the
  // workout — the workout screen stays mounted, so its timer, draft set,
  // and rest countdown all survive the trip; router.back() reveals it
  // untouched. The raw exercise name goes through `params`; expo-router
  // URL-encodes the [name] segment and the route decodes it.
  const onOpenExerciseHistory = useCallback(() => {
    if (!currentExercise) return;
    router.push({
      pathname: '/exercise/[name]',
      params: { name: currentExercise.name },
    });
  }, [router, currentExercise]);
  // ExercisePicker fires haptics.light() itself on pick; the swap adds
  // none. onPick is synchronous-typed — fire-and-forget the async
  // re-query (one indexed read; the modal is dismissing over it). A
  // rejected re-query (exceptional — a local indexed read) leaves the
  // old exercise in the slot; swallow it rather than surface an
  // unhandled rejection.
  const onSwapPick = useCallback(
    (name: string) => {
      void swapCurrentExercise(name).catch(() => {});
    },
    [swapCurrentExercise],
  );

  const onRowLog = useCallback(async () => {
    if (displayedKg === null || displayedReps === null) return;
    haptics.light();
    await logCurrentSet({ kg: displayedKg, reps: displayedReps });
  }, [displayedKg, displayedReps, logCurrentSet]);

  const onSave = useCallback(async () => {
    haptics.medium();
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
    // Three exits. Pause keeps the session as a resumable orphan;
    // Save and end finalizes it (counts in history); Discard deletes
    // it. onSave already does completeAndSave + re-hydrate + pop.
    Alert.alert(
      'End workout.',
      undefined,
      [
        {
          text: 'Pause',
          onPress: async () => {
            haptics.medium();
            await abandon();
            router.back();
          },
        },
        {
          text: 'Save and end',
          onPress: () => {
            void onSave();
          },
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            haptics.warning();
            await discard();
            router.back();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  }, [status, router, abandon, discard, onSave]);

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
    // Done takeover centers "Done. 47 minutes." on the inset-aware
    // available height — top AND bottom edges respected so the lockup
    // visually sits on the screen's midline rather than drifting upward
    // because the home-indicator territory bites into the bottom.
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        edges={['top', 'bottom']}
      >
        <DoneTakeover durationSeconds={elapsedSeconds} onSave={onSave} />
      </SafeAreaView>
    );
  }

  // Active layout. Previous-exercise rows (`previousRows`, computed
  // above) render above the current exercise header.
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
        {previousRows.map((row) => (
          <PreviousExerciseRow
            key={row.key}
            name={row.name}
            sets={row.sets}
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
                onSwap={onOpenSwap}
                onOpenHistory={onOpenExerciseHistory}
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

      {/* Swap-exercise picker. Page-sheet modal — `swappingFrom` drives
          both the "Replacing X." line and the greyed/disabled current
          row inside the picker. */}
      <ExercisePicker
        visible={swapPickerVisible}
        mode="swap"
        swappingFrom={currentExercise?.name ?? null}
        loggedSetsCount={currentExercise?.loggedSets.length ?? 0}
        onPick={onSwapPick}
        onClose={onCloseSwap}
      />
    </SafeAreaView>
  );
}
