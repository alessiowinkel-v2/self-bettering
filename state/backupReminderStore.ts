import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Backup reminder store — tracks when the user last opened the
 * Export share sheet and when they last snoozed the reminder card.
 *
 * Two persisted ISO timestamps and one transient counter:
 *   - lastExportedAt: null until the user has opened the share sheet
 *     at least once. recordExport() runs whether the user shared or
 *     dismissed — surfacing the sheet counts as "you reviewed the
 *     backup affordance recently."
 *   - lastSnoozedAt: set when the user taps Later on the reminder
 *     card. shouldShowReminder suppresses the card for 7 days from
 *     this timestamp.
 *   - foregroundTick: in-memory counter bumped by the root AppState
 *     listener on each background→active transition. Today subscribes
 *     to it so the BackupReminderCard re-evaluates visibility when
 *     the app returns to foreground, not just on tab focus.
 *
 * Persistence: AsyncStorage via Zustand persist, mirroring the
 * pattern in settingsStore.ts. Only the two timestamps persist;
 * foregroundTick is partialized out so it resets to 0 on cold boot.
 */

type BackupReminderState = {
  lastExportedAt: string | null;
  lastSnoozedAt: string | null;
  foregroundTick: number;
  recordExport: () => void;
  recordSnooze: () => void;
  bumpForegroundTick: () => void;
};

export const useBackupReminderStore = create<BackupReminderState>()(
  persist(
    (set) => ({
      lastExportedAt: null,
      lastSnoozedAt: null,
      foregroundTick: 0,
      // Clearing lastSnoozedAt on export keeps shouldShowReminder a
      // pure function of "did you export recently" — the snooze window
      // only applies between exports, not after one.
      recordExport: () =>
        set({
          lastExportedAt: new Date().toISOString(),
          lastSnoozedAt: null,
        }),
      recordSnooze: () =>
        set({ lastSnoozedAt: new Date().toISOString() }),
      bumpForegroundTick: () =>
        set((s) => ({ foregroundTick: s.foregroundTick + 1 })),
    }),
    {
      name: 'lumen.backup',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lastExportedAt: state.lastExportedAt,
        lastSnoozedAt: state.lastSnoozedAt,
      }),
    },
  ),
);
