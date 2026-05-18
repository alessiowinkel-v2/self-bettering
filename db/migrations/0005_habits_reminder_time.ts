/**
 * Migration 0005 — habits reminder time.
 *
 * Adds a per-habit reminder column so Habit Detail can schedule a daily
 * local notification for a single habit. Stores an "HH:mm" 24h string
 * when set; NULL means no reminder. Read by getActiveHabitReminders,
 * which feeds the notification reconcile in utils/notifications.ts.
 *
 * Forward-only. Nullable with no default — existing rows take NULL and
 * schedule nothing until the user sets a time. Streak math is unaffected.
 */
const sql = `
ALTER TABLE habits
  ADD COLUMN reminder_time TEXT;
`;

export default sql;
