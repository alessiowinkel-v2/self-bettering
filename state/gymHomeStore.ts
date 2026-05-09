import { create } from 'zustand';
import {
  getCompletedWorkoutDatesInRange,
  getNextWorkoutTemplate,
  getWorkoutTemplatesWithLastCompleted,
  type WorkoutTemplateWithLast,
} from '../db/workouts';
import { todayIso } from '../utils/dateFormat';
import { getWeekRange } from '../utils/gymHome';

/**
 * Gym Home store — a hydration cache for the Gym tab.
 *
 * Mirrors the pattern in `useTodayStore` and `useHabitsListStore`: the
 * SQLite layer is the source of truth, `hydrate()` reads everything
 * the screen needs in one pass, and components read primitives from
 * memory. The Gym screen calls `hydrate()` lazily via useFocusEffect,
 * so the cache stays cheap when the user is on other tabs.
 *
 * No mutations live here yet — Active Workout (Phase 3e+) will own
 * the start/complete writes and refresh this store + Today after
 * each. Until then, the screen is read-only.
 */

type GymHomeState = {
  templates: ReadonlyArray<WorkoutTemplateWithLast>;
  /** ID of the routine the user should start next (rotation_order, name). */
  nextTemplateId: string | null;
  /** ISO dates within the current Mon–Sun week that had a workout. */
  completedDatesThisWeek: ReadonlyArray<string>;
  /** Reference date the store was hydrated against. */
  referenceDate: string;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
};

export const useGymHomeStore = create<GymHomeState>((set) => ({
  templates: [],
  nextTemplateId: null,
  completedDatesThisWeek: [],
  referenceDate: todayIso(),
  isHydrated: false,

  // Single-writer assumption: see useTodayStore.hydrate() for the
  // epoch-guard reasoning. Same trade-off applies here.
  hydrate: async () => {
    const today = todayIso();
    const { start, end } = getWeekRange(today);

    const [templates, nextTemplate, completedDatesThisWeek] = await Promise.all([
      getWorkoutTemplatesWithLastCompleted(),
      getNextWorkoutTemplate(),
      getCompletedWorkoutDatesInRange({ startDate: start, endDate: end }),
    ]);

    set({
      templates,
      nextTemplateId: nextTemplate?.id ?? null,
      completedDatesThisWeek,
      referenceDate: today,
      isHydrated: true,
    });
  },
}));
