import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeOverride = 'system' | 'dark' | 'light';

type ThemeStoreState = {
  override: ThemeOverride;
  _hasHydrated: boolean;
  setOverride: (next: ThemeOverride) => void;
  _setHasHydrated: (value: boolean) => void;
};

export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set) => ({
      override: 'system',
      _hasHydrated: false,
      setOverride: (next) => set({ override: next }),
      _setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: 'lumen.theme.override',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ override: state.override }),
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
    },
  ),
);
