import { useHeaderHeight } from '@react-navigation/elements';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  Screen,
  Text,
  TextButton,
  WeekDots,
  type WeekDot,
} from '../../components/primitives';
import {
  BestLockup,
  Heatmap90,
  StatusLabel,
} from '../../components/habit';
import { CheckInRow } from '../../components/settings';
import {
  getBestStreak,
  getLogsForHabitInRange,
  getMostRecentSlipDate,
  getStreakForHabit,
} from '../../db/habitLogs';
import { getHabitWithLifecycle, setHabitReminderTime } from '../../db/habits';
import {
  syncHabitRemindersFromDb,
  useHabitsListStore,
} from '../../state/habitsListStore';
import { useTheme } from '../../theme';
import { ensurePermission } from '../../utils/notifications';
import { haptics } from '../../utils/haptics';
import {
  buildWeekDots,
  getHabitLifecycleVariant,
  heatmapWindow,
  sinceDate,
  type HabitLifecycleVariant,
} from '../../utils/habitDetail';
import { todayIso } from '../../utils/dateFormat';
import type { Habit, HabitLog, HabitStatus } from '../../state/types';

/**
 * Habit Detail. Stack route under root, reachable from Today (habit
 * card tap) and Habits List (active/paused/archived row taps).
 *
 * Hydration is screen-local — single habitId per lifecycle, no
 * cross-screen reuse — so the loader stays inline rather than
 * introducing a habitDetailStore. Mutations dual-hydrate the
 * habits-list and today stores via existing actions, then refresh the
 * screen-local snapshot so the action row's labels (Pause/Resume,
 * etc.) flip if the user lingers before navigating back.
 */

type DetailSnapshot = {
  habit: Habit;
  pausedAt: string | null;
  deletedAt: string | null;
  /** Per-habit daily reminder, "HH:mm" or null when off. */
  reminderTime: string | null;
  /** Streak through TODAY (live). Today's slip shows 0 immediately. */
  streak: number;
  best: number;
  mostRecentSlipDate: string | null;
  logsForWindow: ReadonlyArray<HabitLog>;
  weekDots: ReadonlyArray<WeekDot>;
  todayStatus: HabitStatus | null;
  variant: HabitLifecycleVariant;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'ready'; snapshot: DetailSnapshot };

// Stack options are static — no state-dependent header right slot in
// 3b — so memoize once at module scope. expo-router compares options
// by reference; a frozen object stops the header from churning across
// renders.
const STACK_OPTIONS = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
} as const;

export default function HabitDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  // expo-router's runtime contract is string | string[] | undefined —
  // narrow before passing to the data layer so an array can never slip
  // through to SQL parameter binding.
  const id = typeof params.id === 'string' ? params.id : null;

  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  // The editable reminder time lives in its own state, kept out of the
  // snapshot. The snapshot holds read-only derived data (streak, logs,
  // variant); folding the one editable field into it meant the
  // optimistic update spread a stale snapshot and a concurrent refresh()
  // could clobber the pick. Seeded once from the DB at mount — only this
  // screen edits a habit's reminder, so it never needs re-seeding.
  const [reminderValue, setReminderValue] = useState<string | null>(null);

  // Shared across the mount-effect and refresh() so a mutation that
  // resolves after unmount can't fire setState on a torn-down tree.
  //
  // Single-writer assumption: see useTodayStore.hydrate() for the
  // epoch-guard reasoning. cancelledRef on this screen has the same
  // narrow re-mount window — if a prior id's in-flight fetch resolves
  // after a new id-change has reset the ref to false, it can write a
  // stale snapshot. Acceptable at this app's scale (one user, push
  // navigation); revisit with an epoch counter if it surfaces.
  const cancelledRef = useRef(false);

  // Reminder commit is debounced — CheckInRow's spinner fires onChange
  // per wheel tick. reminderTimer holds the pending commit; the mount
  // effect seeds latestReminderRef, which carries the picked value into
  // the debounced tail and is the synchronous source of truth for the
  // null<->time transition (a ref updates before React commits, so two
  // fast ticks can't both read the pre-edit value).
  const reminderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestReminderRef = useRef<string | null>(null);

  const fetchSnapshot = useCallback(async (
    habitId: string
  ): Promise<DetailSnapshot | null> => {
    const today = todayIso();
    const { start: windowStart, end: windowEnd } = heatmapWindow(today);

    const habitWithLifecycle = await getHabitWithLifecycle(habitId);
    if (!habitWithLifecycle) return null;

    const [streak, best, mostRecentSlipDate, logsForWindow] = await Promise.all([
      getStreakForHabit({ habitId, throughDate: today }),
      getBestStreak({ habitId, throughDate: today }),
      getMostRecentSlipDate({ habitId, throughDate: today }),
      getLogsForHabitInRange({
        habitId,
        startDate: windowStart,
        endDate: windowEnd,
      }),
    ]);

    const todayLog = logsForWindow.find((l) => l.date === today) ?? null;
    // buildWeekDots reads only logs whose dates match a dot's date via
    // a Map lookup, so passing the full window is safe and avoids a
    // second round-trip for the week-only range.
    const weekDots = buildWeekDots({ today, logs: logsForWindow });

    const variant = getHabitLifecycleVariant({
      createdOn: habitWithLifecycle.habit.createdOn,
      today,
      todayStatus: todayLog?.status ?? null,
      pausedAt: habitWithLifecycle.pausedAt,
      deletedAt: habitWithLifecycle.deletedAt,
      mostRecentSlipDate,
    });

    return {
      habit: habitWithLifecycle.habit,
      pausedAt: habitWithLifecycle.pausedAt,
      deletedAt: habitWithLifecycle.deletedAt,
      reminderTime: habitWithLifecycle.reminderTime,
      streak,
      best,
      mostRecentSlipDate,
      logsForWindow,
      weekDots,
      todayStatus: todayLog?.status ?? null,
      variant,
    };
  }, []);

  // Mount + id-change loader. cancelledRef gates both this initial
  // load and any subsequent refresh() so mutation handlers and the
  // mount fetch share a single unmount guard.
  useEffect(() => {
    if (id === null) {
      setState({ kind: 'not-found' });
      return;
    }
    cancelledRef.current = false;
    setState({ kind: 'loading' });
    void (async () => {
      try {
        const snapshot = await fetchSnapshot(id);
        if (cancelledRef.current) return;
        if (snapshot !== null) {
          // Seed the editable reminder state + the ref the debounced
          // commit reads. Done here, not in refresh(), so a focus
          // refresh can never revert an in-progress edit.
          setReminderValue(snapshot.reminderTime);
          latestReminderRef.current = snapshot.reminderTime;
        }
        setState(
          snapshot === null ? { kind: 'not-found' } : { kind: 'ready', snapshot }
        );
      } catch {
        if (!cancelledRef.current) setState({ kind: 'not-found' });
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, [id, fetchSnapshot]);

  const refresh = useCallback(async () => {
    if (id === null) return;
    const snapshot = await fetchSnapshot(id);
    if (cancelledRef.current) return;
    setState(
      snapshot === null ? { kind: 'not-found' } : { kind: 'ready', snapshot }
    );
  }, [id, fetchSnapshot]);

  // Re-fetch on focus so the return trip from the Set-streak modal
  // picks up the new streak. The modal navigates away and back, so the
  // mount effect (same id) does not re-run and would leave the snapshot
  // stale. refresh() never sets the loading state, so the redundant
  // first-mount fire is one cheap read with no flicker. cancelledRef
  // already guards refresh() against post-unmount setState.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const onPause = useCallback(async () => {
    if (id === null) return;
    await useHabitsListStore.getState().pause(id);
    await refresh();
  }, [id, refresh]);

  const onResume = useCallback(async () => {
    if (id === null) return;
    await useHabitsListStore.getState().resume(id);
    await refresh();
  }, [id, refresh]);

  const onArchive = useCallback(async () => {
    if (id === null) return;
    await useHabitsListStore.getState().archive(id);
    router.back();
  }, [id, router]);

  const onRestore = useCallback(async () => {
    if (id === null) return;
    await useHabitsListStore.getState().restore(id);
    router.back();
  }, [id, router]);

  const onSetStreak = useCallback(() => {
    if (id === null) return;
    router.push({ pathname: '/habit/set-streak', params: { id } });
  }, [id, router]);

  // The debounced commit: write the latest picked value to SQLite, then
  // reconcile this habit's notification. Reads latestReminderRef so it
  // is not pinned to a stale render's value.
  const commitReminder = useCallback(() => {
    if (id === null) return;
    void (async () => {
      await setHabitReminderTime({
        id,
        reminderTime: latestReminderRef.current,
      });
      await syncHabitRemindersFromDb();
    })();
  }, [id]);

  const scheduleReminderCommit = useCallback(() => {
    if (reminderTimer.current) clearTimeout(reminderTimer.current);
    reminderTimer.current = setTimeout(() => {
      reminderTimer.current = null;
      commitReminder();
    }, 400);
  }, [commitReminder]);

  // Flush a pending reminder commit on unmount so a change made right
  // before navigating away still reaches SQLite.
  useEffect(
    () => () => {
      if (reminderTimer.current) {
        clearTimeout(reminderTimer.current);
        reminderTimer.current = null;
        commitReminder();
      }
    },
    [commitReminder],
  );

  // Permission is requested lazily — only when the reminder is turned
  // on. A denial keeps the time saved; the reconcile then no-ops and
  // the alert points to iOS Settings. The trailing commit covers the
  // case where the prompt outlasts the debounced commit.
  const onEnableReminder = useCallback(async () => {
    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert(
        'Notifications are off.',
        'Turn them on for Lumen in iOS Settings to get habit reminders.',
      );
    }
    commitReminder();
  }, [commitReminder]);

  const onChangeReminder = useCallback(
    (next: string | null) => {
      // Transition is read off the ref, not React state — the ref
      // updates synchronously, so two fast spinner ticks before a
      // render commits can't both see the pre-edit value and double-
      // fire onEnableReminder.
      const prev = latestReminderRef.current;
      const turnedOn = prev === null && next !== null;
      const turnedOff = prev !== null && next === null;
      if (turnedOn || turnedOff) haptics.light();
      latestReminderRef.current = next;
      setReminderValue(next);
      if (turnedOn) void onEnableReminder();
      scheduleReminderCommit();
    },
    [onEnableReminder, scheduleReminderCommit],
  );

  // Pad the top of the body so the title clears the system back
  // chevron under headerTransparent. Header height + a single spacing
  // step lands the Fraunces title at the same vertical rhythm as
  // every other screen's first content.
  const titleTopPad = useMemo(
    () => headerHeight + theme.spacing[3],
    [headerHeight, theme.spacing]
  );

  if (state.kind === 'loading') {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={STACK_OPTIONS} />
      </Screen>
    );
  }

  if (state.kind === 'not-found') {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={STACK_OPTIONS} />
        <View style={{ marginTop: titleTopPad }}>
          <Text variant="displayItalic" tone="secondary">
            Habit not found.
          </Text>
        </View>
      </Screen>
    );
  }

  const s = state.snapshot;
  const today = todayIso();

  const isDayOne = s.variant === 'day-one';
  const isArchived = s.variant === 'archived';
  const isPaused = s.variant === 'paused';

  // Reminder row shows only for active habits — a reminder on a paused
  // or archived habit would not schedule (getActiveHabitReminders
  // excludes them), so the control would silently do nothing. The
  // stored reminder_time is left intact across a pause and reschedules
  // on resume.
  const showReminder = !isPaused && !isArchived;

  // Calendar hides on day-one only; just-slipped, paused, and
  // archived all keep the calendar visible so the run history reads.
  const showCalendar = !isDayOne;
  // BEST hides on day-one only; just-slipped still shows BEST so the
  // pre-slip record stays on screen.
  const showBest = !isDayOne && s.best > 0;
  // "Since" line hides only when there's no prior run to reference,
  // which is day-one. Stays visible on just-slipped (anchors the
  // previous run's start) and on paused / archived.
  const showSince = !isDayOne;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={STACK_OPTIONS} />

      <View style={{ marginTop: titleTopPad }}>
        <Text variant="display">{s.habit.name}</Text>
        {showSince ? (
          <Text
            variant="body"
            tone="secondary"
            style={{ marginTop: theme.spacing[2] }}
          >
            Since {sinceDate({
              createdOn: s.habit.createdOn,
              mostRecentSlipDate: s.mostRecentSlipDate,
            })}.
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: theme.spacing[7], alignItems: 'flex-start' }}>
        <Text variant="displayXL" tone="accent">
          {s.streak}
        </Text>
        <View style={{ marginTop: theme.spacing[2] }}>
          <StatusLabel variant={s.variant} />
        </View>
      </View>

      {showBest ? (
        <View style={{ marginTop: theme.spacing[5] }}>
          <BestLockup best={s.best} />
        </View>
      ) : null}

      <View style={{ marginTop: theme.spacing[7] }}>
        <Text variant="label" tone="secondary" style={{ marginBottom: theme.spacing[3] }}>
          THIS WEEK
        </Text>
        <WeekDots dots={s.weekDots} />
      </View>

      {showCalendar ? (
        <View style={{ marginTop: theme.spacing[7] }}>
          <Text
            variant="label"
            tone="secondary"
            style={{ marginBottom: theme.spacing[3] }}
          >
            LAST 90 DAYS
          </Text>
          <Heatmap90
            logs={s.logsForWindow}
            today={today}
            createdOn={s.habit.createdOn}
          />
        </View>
      ) : null}

      {showReminder ? (
        <View style={{ marginTop: theme.spacing[7] }}>
          <CheckInRow
            index={0}
            title="Reminder"
            value={reminderValue}
            onChange={onChangeReminder}
            accessibilityLabel={`Daily reminder for ${s.habit.name}`}
          />
        </View>
      ) : null}

      <View
        style={{
          marginTop: theme.spacing[7],
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/*
          All action-row verbs on Habit Detail render quiet. Habit
          Detail has no singular primary affordance (the screen is
          for reading history; mutations are daily-rare). Amber is
          reserved per the filled-button rule's principle.
        */}
        {isArchived ? (
          <TextButton
            label="Restore"
            tone="secondary"
            onPress={onRestore}
            accessibilityLabel={`Restore ${s.habit.name}`}
          />
        ) : (
          <>
            <TextButton
              label="Set streak"
              tone="secondary"
              onPress={onSetStreak}
              accessibilityLabel={`Set streak start for ${s.habit.name}`}
            />
            {isPaused ? (
              <TextButton
                label="Resume"
                tone="secondary"
                onPress={onResume}
                accessibilityLabel={`Resume ${s.habit.name}`}
              />
            ) : (
              <TextButton
                label="Pause"
                tone="secondary"
                onPress={onPause}
                accessibilityLabel={`Pause ${s.habit.name}`}
              />
            )}
            <TextButton
              label="Archive"
              tone="secondary"
              onPress={onArchive}
              accessibilityLabel={`Archive ${s.habit.name}`}
            />
          </>
        )}
      </View>
    </Screen>
  );
}
