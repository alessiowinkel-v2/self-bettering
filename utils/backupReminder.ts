/**
 * Pure logic for the Today-screen backup reminder card.
 *
 * The reminder fires when 30+ days have passed since the user last
 * opened the Export share sheet AND they have not snoozed within the
 * last 7 days. First-ever launch (lastExportedAt === null) suppresses
 * the reminder — the card phrasing "It has been a while" only makes
 * sense once there has been a prior export to be "a while" since.
 *
 * Cadence is hardcoded:
 *   BACKUP_INTERVAL_DAYS = 30  Time between reminders.
 *   SNOOZE_DAYS = 7            Quiet window after tapping Later.
 *
 * No escalation: a 60-day overdue user sees the same card as a 31-day
 * overdue one. The point is calm, not pressure.
 */

export const BACKUP_INTERVAL_DAYS = 30;
export const SNOOZE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function shouldShowReminder(
  lastExportedAt: string | null,
  lastSnoozedAt: string | null,
  now: Date = new Date(),
): boolean {
  if (lastExportedAt === null) return false;

  const exportedMs = Date.parse(lastExportedAt);
  if (!Number.isFinite(exportedMs)) return false;

  const daysSinceExport = (now.getTime() - exportedMs) / DAY_MS;
  if (daysSinceExport < BACKUP_INTERVAL_DAYS) return false;

  if (lastSnoozedAt !== null) {
    const snoozedMs = Date.parse(lastSnoozedAt);
    if (Number.isFinite(snoozedMs)) {
      const daysSinceSnooze = (now.getTime() - snoozedMs) / DAY_MS;
      if (daysSinceSnooze < SNOOZE_DAYS) return false;
    }
  }

  return true;
}
