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
 * Persisted via AsyncStorage. Rendering is not gated on hydration — a
 * one-frame flicker through the in-memory defaults on Settings is
 * acceptable. But `_hasHydrated` IS exposed: the root layout's
 * boot-time notification sync must wait for the persisted check-in
 * times, not act on the in-memory `null` defaults (which would cancel
 * every reminder on each cold start). It flips true once via
 * `onRehydrateStorage`, mirroring the theme store's pattern.
 */

export type CheckInTime = string | null;

type SettingsStoreState = {
  morningCheckInTime: CheckInTime;
  eveningCheckInTime: CheckInTime;
  restTimerAlerts: boolean;
  _hasHydrated: boolean;
  setMorningCheckInTime: (next: CheckInTime) => void;
  setEveningCheckInTime: (next: CheckInTime) => void;
  setRestTimerAlerts: (next: boolean) => void;
  _setHasHydrated: (value: boolean) => void;
};

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      morningCheckInTime: null,
      eveningCheckInTime: null,
      restTimerAlerts: true,
      _hasHydrated: false,
      setMorningCheckInTime: (next) => set({ morningCheckInTime: next }),
      setEveningCheckInTime: (next) => set({ eveningCheckInTime: next }),
      setRestTimerAlerts: (next) => set({ restTimerAlerts: next }),
      _setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: 'lumen.settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        morningCheckInTime: state.morningCheckInTime,
        eveningCheckInTime: state.eveningCheckInTime,
        restTimerAlerts: state.restTimerAlerts,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
    },
  ),
);
