// Dev-only state. Must not survive into production builds.
import { create } from 'zustand';
import { seedDev } from '../db/seedDev';
import type { SeedName } from '../dev/seedFixtures';
import { useTodayStore } from './todayStore';

type DevStoreState = {
  activeSeed: SeedName;
  /**
   * Wipe and reseed the DB to a named fixture, then re-hydrate the Today
   * store cache so the screen reflects the new rows. Remembers the choice
   * so the dev menu can highlight which seed is active.
   */
  applySeed: (name: SeedName) => Promise<void>;
};

export const useDevStore = create<DevStoreState>((set) => ({
  activeSeed: 'default',
  // Single-writer assumption: the user is the only writer
  // and double-taps under ~10ms are not realistic. If a
  // future phase introduces concurrent mutations (background
  // sync, multi-touch gestures), revisit for in-flight
  // guards.
  applySeed: async (name) => {
    await seedDev(name);
    await useTodayStore.getState().hydrate();
    set({ activeSeed: name });
  },
}));
