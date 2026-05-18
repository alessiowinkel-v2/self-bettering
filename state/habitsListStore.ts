import { create } from 'zustand';
import {
  backfillHeldLogs as dbBackfillHeldLogs,
  getLogsForDate,
  getStreakForHabit,
} from '../db/habitLogs';
import {
  archiveHabit as dbArchiveHabit,
  createHabit as dbCreateHabit,
  pauseHabit as dbPauseHabit,
  reorderHabits as dbReorderHabits,
  restoreHabit as dbRestoreHabit,
  resumeHabit as dbResumeHabit,
  setHabitCreatedOn as dbSetHabitCreatedOn,
  getActiveHabits,
  getArchivedHabits,
  getPausedHabits,
} from '../db/habits';
import { todayIso, yesterdayIso } from '../utils/dateFormat';
import { useTodayStore } from './todayStore';
import type { Habit, HabitStatus } from './types';

/**
 * Habits List store — a hydration cache for the Habits tab.
 *
 * Mirrors the pattern in `useTodayStore`: the SQLite layer is the source
 * of truth, `hydrate()` reads the rows the screen needs in one pass, and
 * components read primitives from memory. The Habits screen calls
 * `hydrate()` lazily via useFocusEffect, so the cache stays cheap when
 * the user is on other tabs.
 *
 * Mutations dual-hydrate: pause/archive/create/reorder all change rows
 * that Today also reads (active habits drive the Today cards, sort order
 * drives chip ordering, paused/archived habits drop out of Today
 * entirely). After every mutation we refresh both stores so the two
 * caches stay coherent. Single-writer assumption holds — see notes on
 * each action.
 */

type HabitsListState = {
  active: ReadonlyArray<Habit>;
  paused: ReadonlyArray<Habit>;
  archived: ReadonlyArray<Habit>;
  /** Per-active-habit streak as of end-of-yesterday. */
  streaksThroughYesterday: Readonly<Record<string, number>>;
  /**
   * Per-active-habit today's status. Used for the "Held today." /
   * "Slipped today." caption under each row's name.
   */
  todayStatus: Readonly<Record<string, HabitStatus>>;
  /**
   * True after the first hydrate completes. Screen reads this to
   * distinguish "loading" from "loaded empty".
   */
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  pause: (id: string) => Promise<void>;
  resume: (id: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  create: (name: string) => Promise<void>;
  setStreakStart: (id: string, startDate: string) => Promise<void>;
  reorder: (orderedIds: ReadonlyArray<string>) => Promise<void>;
};

export const useHabitsListStore = create<HabitsListState>((set) => ({
  active: [],
  paused: [],
  archived: [],
  streaksThroughYesterday: {},
  todayStatus: {},
  isHydrated: false,

  // Single-writer assumption: see useTodayStore.hydrate() for the
  // epoch-guard reasoning. Same trade-off applies here. Day-rollover
  // refreshes in Phase 4 may force the issue.
  hydrate: async () => {
    const now = new Date();
    const today = todayIso(now);
    const yesterday = yesterdayIso(now);

    const [active, paused, archived, todayLogs] = await Promise.all([
      getActiveHabits(),
      getPausedHabits(),
      getArchivedHabits(),
      getLogsForDate(today),
    ]);

    const streakValues = await Promise.all(
      active.map((h) =>
        getStreakForHabit({ habitId: h.id, throughDate: yesterday })
      )
    );
    const streaksThroughYesterday: Record<string, number> = {};
    active.forEach((h, i) => {
      streaksThroughYesterday[h.id] = streakValues[i];
    });

    const todayStatus: Record<string, HabitStatus> = {};
    for (const log of todayLogs) todayStatus[log.habitId] = log.status;

    set({
      active,
      paused,
      archived,
      streaksThroughYesterday,
      todayStatus,
      isHydrated: true,
    });
  },

  // dual-hydrate: each mutation refreshes both stores
  // (habits-list and today). Single-writer assumption holds.
  pause: async (id) => {
    await dbPauseHabit(id);
    await useHabitsListStore.getState().hydrate();
    await useTodayStore.getState().hydrate();
  },

  // dual-hydrate: resume reactivates the row + recomputes sort_order at
  // the data layer. Both stores re-read so the row reappears in active
  // (Habits List) and shows up among Today's habit cards.
  resume: async (id) => {
    await dbResumeHabit(id);
    await useHabitsListStore.getState().hydrate();
    await useTodayStore.getState().hydrate();
  },

  // dual-hydrate: each mutation refreshes both stores
  // (habits-list and today). Single-writer assumption holds.
  archive: async (id) => {
    await dbArchiveHabit(id);
    await useHabitsListStore.getState().hydrate();
    await useTodayStore.getState().hydrate();
  },

  // dual-hydrate: restore clears deleted_at + recomputes sort_order at
  // the data layer (mirroring resume). The habit returns to the bottom
  // of the active list. Today re-reads so the chip + card return too.
  restore: async (id) => {
    await dbRestoreHabit(id);
    await useHabitsListStore.getState().hydrate();
    await useTodayStore.getState().hydrate();
  },

  // dual-hydrate: each mutation refreshes both stores
  // (habits-list and today). Single-writer assumption holds.
  create: async (name) => {
    await dbCreateHabit({ name, createdOn: todayIso() });
    await useHabitsListStore.getState().hydrate();
    await useTodayStore.getState().hydrate();
  },

  // dual-hydrate: backfillHeldLogs materializes the run and
  // setHabitCreatedOn widens the streak-walk lower bound. Backfill runs
  // first, in its own transaction — if it fails, created_on is left
  // untouched so the habit never points at a start with no logs behind
  // it. Both touch rows Today also reads (streaks, today's logs), so
  // both stores re-read; Habit Detail re-reads via its own focus effect.
  setStreakStart: async (id, startDate) => {
    const today = todayIso();
    await dbBackfillHeldLogs({ habitId: id, startDate, endDate: today });
    await dbSetHabitCreatedOn({ id, createdOn: startDate });
    await useHabitsListStore.getState().hydrate();
    await useTodayStore.getState().hydrate();
  },

  // dual-hydrate: each mutation refreshes both stores
  // (habits-list and today). Single-writer assumption holds.
  reorder: async (orderedIds) => {
    // Optimistic reorder: active is set synchronously to the new order,
    // then DB write + hydrate run in background. Single-writer assumption:
    // drags faster than ~50ms apart (hydrate cycle) are not realistic. If
    // overlapping drags ever surface, hydrate's set({ active }) can briefly
    // clobber the newer optimistic order — revisit with epoch guard then.
    // Same pattern as useTodayStore.hydrate's deferred race comment.
    const current = useHabitsListStore.getState().active;
    const byId = new Map(current.map((h) => [h.id, h]));
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((h): h is Habit => h !== undefined);
    set({ active: reordered });

    await dbReorderHabits(orderedIds);
    await useHabitsListStore.getState().hydrate();
    // Today reads habits via getActiveHabits and the chip row renders in
    // that order, so a reorder must refresh Today too.
    await useTodayStore.getState().hydrate();
  },
}));
