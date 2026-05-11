import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Settings store — user preferences that survive boot but don't
 * belong in SQLite (they're per-install, not per-row domain data).
 *
 * Theme override stays in its own store (theme/useThemeStore) so the
 * ThemeProvider can subscribe to it without pulling everything else
 * in. This store carries the rest:
 *
 *   - morningCheckInTime / eveningCheckInTime: "HH:mm" strings or
 *     null when the reminder is off. Phase 3e ships the UI to set
 *     them; actual notification scheduling lives in Phase 4 (the
 *     store is the configuration surface, not the scheduler).
 *   - restTimerAlerts: boolean, defaults true. Active Workout's rest
 *     sheet reads this to decide whether to fire a haptic + sound at
 *     completion.
 *
 * Persisted via AsyncStorage. No boot-gate dependency: Settings is a
 * tab destination read post-boot, and a one-frame flicker through the
 * in-memory defaults during the first AsyncStorage resolve is
 * acceptable. Phase 4's notification scheduler can add a hydration
 * gate when it arrives with a real boot-time consumer.
 */

export type CheckInTime = string | null;

type SettingsStoreState = {
  morningCheckInTime: CheckInTime;
  eveningCheckInTime: CheckInTime;
  restTimerAlerts: boolean;
  setMorningCheckInTime: (next: CheckInTime) => void;
  setEveningCheckInTime: (next: CheckInTime) => void;
  setRestTimerAlerts: (next: boolean) => void;
};

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      morningCheckInTime: null,
      eveningCheckInTime: null,
      restTimerAlerts: true,
      setMorningCheckInTime: (next) => set({ morningCheckInTime: next }),
      setEveningCheckInTime: (next) => set({ eveningCheckInTime: next }),
      setRestTimerAlerts: (next) => set({ restTimerAlerts: next }),
    }),
    {
      name: 'lumen.settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        morningCheckInTime: state.morningCheckInTime,
        eveningCheckInTime: state.eveningCheckInTime,
        restTimerAlerts: state.restTimerAlerts,
      }),
    },
  ),
);
