import { create } from 'zustand';
import {
  getCompletedWorkoutDatesInRange,
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
  /** ISO dates within the current Mon–Sun week that had a workout. */
  completedDatesThisWeek: ReadonlyArray<string>;
  /**
   * Count of distinct workouts whose most recent completion falls within
   * the current Mon–Sun week. Drives the "X of N done this week." caption.
   * A workout done Mon and Fri still counts as one — the metric tracks
   * how much of the list has been touched, not session frequency.
   */
  routinesCompletedThisWeek: number;
  /** Reference date the store was hydrated against. */
  referenceDate: string;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
};

export const useGymHomeStore = create<GymHomeState>((set) => ({
  templates: [],
  completedDatesThisWeek: [],
  routinesCompletedThisWeek: 0,
  referenceDate: todayIso(),
  isHydrated: false,

  // Single-writer assumption: see useTodayStore.hydrate() for the
  // epoch-guard reasoning. Same trade-off applies here.
  hydrate: async () => {
    const today = todayIso();
    const { start, end } = getWeekRange(today);

    const [templates, completedDatesThisWeek] = await Promise.all([
      getWorkoutTemplatesWithLastCompleted(),
      getCompletedWorkoutDatesInRange({ startDate: start, endDate: end }),
    ]);

    const routinesCompletedThisWeek = templates.reduce(
      (count, row) =>
        row.lastCompletedDate !== null &&
        row.lastCompletedDate >= start &&
        row.lastCompletedDate <= end
          ? count + 1
          : count,
      0,
    );

    set({
      templates,
      completedDatesThisWeek,
      routinesCompletedThisWeek,
      referenceDate: today,
      isHydrated: true,
    });
  },
}));
