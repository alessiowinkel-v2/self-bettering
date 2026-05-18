import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * The single boundary around expo-notifications. Nothing else in the
 * app imports the library directly — all scheduling, permission, and
 * cancellation goes through here.
 *
 * Scope (Phase 4):
 *   - Step 1: two app-wide daily check-in reminders, driven by
 *     `morningCheckInTime` / `eveningCheckInTime` in the settings store.
 *   - Step 2: per-habit daily reminders, one per active habit that has
 *     a `reminder_time` set.
 *
 * Local notifications only — no push tokens, no server. iOS only:
 * every entry point no-ops on other platforms (Lumen ships to a single
 * iPhone).
 *
 * This module knows nothing about settings or the DB — callers pass
 * plain reminder data. Composing "read habits from SQLite, feed the
 * reconcile" is the application layer's job (see habitsListStore).
 */

// Foreground presentation. Registered at module load (this module is
// imported by the root layout's boot effect, so it runs at startup).
// A reminder that fires while the app is open still shows a banner —
// it is just as relevant foregrounded. No badge: Lumen does not use
// the app-icon badge anywhere.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Stable identifiers. Scheduling with an explicit identifier replaces
// any existing notification under it, and cancellation is by-id, so we
// only ever touch our own notifications and never accumulate
// duplicates. Habit reminders are namespaced by a shared prefix so the
// habit reconcile can find and sweep them all without knowing every id.
const MORNING_ID = 'lumen.checkin.morning';
const EVENING_ID = 'lumen.checkin.evening';
const HABIT_ID_PREFIX = 'lumen.habit.';

type CheckInKind = 'morning' | 'evening';

const CHECKIN_CONTENT: Record<CheckInKind, { title: string; body: string }> = {
  morning: { title: 'Morning.', body: 'Your habits for today.' },
  evening: { title: 'Evening.', body: 'Log today before it closes.' },
};

/** One active habit's daily reminder. `time` is an "HH:mm" 24h string. */
export type HabitReminder = {
  habitId: string;
  name: string;
  time: string;
};

/**
 * Parse a stored "HH:mm" time into hour/minute. Returns null for
 * anything malformed. The UI feeds well-formed values (zero-padded by
 * DateTimePicker), so this is purely defensive — a bad value drops
 * that one reminder rather than throwing mid-sync.
 */
function parseHHmm(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Ensure notification permission. Checks current status, requests it
 * once if undetermined, and returns whether it is granted. iOS only
 * surfaces the system prompt once — after a denial this returns false
 * without re-prompting. Call this when the user turns a reminder on.
 */
export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

async function scheduleDaily(
  identifier: string,
  content: { title: string; body: string },
  time: string,
): Promise<void> {
  const parsed = parseHHmm(time);
  if (!parsed) return;
  await Notifications.scheduleNotificationAsync({
    identifier,
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: parsed.hour,
      minute: parsed.minute,
    },
  });
}

async function reconcileCheckIns(
  morning: string | null,
  evening: string | null,
): Promise<void> {
  if (Platform.OS !== 'ios') return;

  await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(
    () => {},
  );
  await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(
    () => {},
  );

  if (morning === null && evening === null) return;

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  if (morning !== null) {
    await scheduleDaily(MORNING_ID, CHECKIN_CONTENT.morning, morning);
  }
  if (evening !== null) {
    await scheduleDaily(EVENING_ID, CHECKIN_CONTENT.evening, evening);
  }
}

async function reconcileHabitReminders(
  reminders: ReadonlyArray<HabitReminder>,
): Promise<void> {
  if (Platform.OS !== 'ios') return;

  // Cancel every habit reminder currently scheduled — the desired set
  // is rebuilt from scratch below. Listing then cancelling by prefix
  // (rather than cancelling a known id set) also sweeps reminders for
  // habits since paused, archived, or deleted, whose ids the caller no
  // longer passes.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(HABIT_ID_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(
        () => {},
      );
    }
  }

  if (reminders.length === 0) return;

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  for (const r of reminders) {
    await scheduleDaily(
      HABIT_ID_PREFIX + r.habitId,
      { title: r.name, body: 'Check in.' },
      r.time,
    );
  }
}

// Serializes reconcile runs. Each reconcile is a multi-step async
// cancel-then-reschedule; two interleaved can land a stale cancel
// after a fresh schedule and drop a just-enabled reminder. Callers
// (boot sync, debounced settings sync, post-permission sync, habit
// lifecycle changes) fire independently, so the boundary chains them
// here rather than asking every caller to coordinate. Check-in and
// habit reconciles share one chain — they touch disjoint identifiers,
// but serializing keeps getAllScheduledNotificationsAsync consistent.
let chain: Promise<unknown> = Promise.resolve();

function enqueue(run: () => Promise<void>): Promise<void> {
  const next = chain.then(run, run);
  // The internal chain swallows rejections so one failed reconcile
  // does not wedge every later one; callers still see `next` reject.
  chain = next.catch(() => {});
  return next;
}

/**
 * Reconcile the two check-in notifications against the given times.
 * Cancels both, then re-schedules each non-null time as a daily-
 * repeating trigger. Safe to call on every boot and on every settings
 * change, and safe to call concurrently — runs are serialized, so the
 * last call to enqueue wins with its own snapshot of the times.
 *
 * A null time means that reminder is off. With no permission, the
 * cancellation still runs but nothing is scheduled — so revoking
 * permission in iOS Settings cleanly leaves nothing pending.
 */
export function syncCheckInNotifications(
  morning: string | null,
  evening: string | null,
): Promise<void> {
  return enqueue(() => reconcileCheckIns(morning, evening));
}

/**
 * Reconcile per-habit reminders against the given set. The set should
 * be exactly the active habits that have a reminder time — paused,
 * archived, and deleted habits must be excluded by the caller, and
 * their stale reminders are swept here. Safe to call on boot, on a
 * reminder change, and on any habit lifecycle change; serialized
 * alongside the check-in reconcile.
 */
export function syncHabitReminders(
  reminders: ReadonlyArray<HabitReminder>,
): Promise<void> {
  return enqueue(() => reconcileHabitReminders(reminders));
}
