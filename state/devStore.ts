// Dev-only state. Must not survive into Phase 2's SQLite layer.
import { create } from 'zustand';
import { seedFor, type SeedName } from './mockData';
import { useTodayStore } from './todayStore';

type DevStoreState = {
  activeSeed: SeedName;
  /** Replace today-store slice from a named seed and remember the choice. */
  applySeed: (name: SeedName) => void;
};

export const useDevStore = create<DevStoreState>((set) => ({
  activeSeed: 'default',
  applySeed: (name) => {
    const seed = seedFor(name, new Date());
    useTodayStore.setState({ ...seed });
    set({ activeSeed: name });
  },
}));
