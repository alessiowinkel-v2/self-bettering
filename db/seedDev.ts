import { parseISO, subDays } from 'date-fns';
import { seedFor, type SeedName } from '../state/mockData';
import { toIsoDate } from '../utils/dateFormat';
import { getDB } from './db';

/**
 * Dev-only seeder. Wipes the domain tables and reinserts rows built from
 * mockData's `seedFor()`, so the data layer can be exercised against the
 * exact shapes the Today screen already understands.
 *
 * The `_migrations` table is left untouched — schema state survives the
 * wipe so we don't reapply migrations on every seed.
 *
 * Not invoked on boot. A fresh install lands on an empty DB and the dev
 * menu drives seeding from there. There is no auto-seed on first launch.
 */

export async function seedDev(name: SeedName = 'default'): Promise<void> {
  const db = await getDB();
  const seed = seedFor(name);

  await db.withTransactionAsync(async () => {
    // FK-respecting wipe: children before parents. Order is dictated by
    // the ON DELETE RESTRICT on workouts.template_id and the foreign keys
    // on sets.workout_id and habit_logs.habit_id. Reorder at your peril.
    await db.execAsync(`
      DELETE FROM sets;
      DELETE FROM workouts;
      DELETE FROM workout_templates;
      DELETE FROM journal_entries;
      DELETE FROM habit_logs;
      DELETE FROM habits;
    `);

    // Habits.
    for (const h of seed.habits) {
      await db.runAsync(
        `INSERT INTO habits (id, name, created_on, paused_at, deleted_at)
         VALUES (?, ?, ?, NULL, NULL);`,
        [h.id, h.name, h.createdOn]
      );
    }

    // Habit logs. Yesterday + any today logs the seed produced, plus a
    // backfill of held days going back so getStreakForHabit returns the
    // canonical design-PDF streaks (24, 11, 3) instead of 1.
    const allLogs = [...seed.yesterdayLogs, ...seed.todayLogs];
    for (const log of allLogs) {
      const id = `hl-${log.habitId}-${log.date}`;
      await db.runAsync(
        `INSERT INTO habit_logs (id, habit_id, date, status, logged_at)
         VALUES (?, ?, ?, ?, ?);`,
        [id, log.habitId, log.date, log.status, new Date().toISOString()]
      );
    }

    // Streak backfill. For each habit with a target streak from the
    // design PDF, write `streak - 1` more held logs ending the day before
    // yesterday. Yesterday's log already exists from seedYesterdayLogs.
    // Stops if the cursor would precede the habit's createdOn.
    for (const h of seed.habits) {
      const targetStreak = seed.mockStreaksThroughYesterday[h.id] ?? 0;
      if (targetStreak < 2) continue;

      const yesterdayLog = seed.yesterdayLogs.find((l) => l.habitId === h.id);
      if (!yesterdayLog || yesterdayLog.status !== 'held') continue;

      const now = new Date().toISOString();
      let cursor = subDays(parseISO(yesterdayLog.date), 1);
      const cutoff = parseISO(h.createdOn);

      for (let i = 1; i < targetStreak; i += 1) {
        if (cursor < cutoff) break;
        const date = toIsoDate(cursor);
        const id = `hl-${h.id}-${date}`;
        await db.runAsync(
          `INSERT INTO habit_logs (id, habit_id, date, status, logged_at)
           VALUES (?, ?, ?, 'held', ?);`,
          [id, h.id, date, now]
        );
        cursor = subDays(cursor, 1);
      }
    }

    // Journal entries (yesterday + optional today).
    const journals = [seed.yesterdayJournal, seed.todayJournal].filter(
      (j): j is NonNullable<typeof j> => j !== null
    );
    for (const j of journals) {
      const id = `j-${j.date}`;
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO journal_entries (id, date, mood, tags, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [id, j.date, j.mood, JSON.stringify(j.tags), j.body, now, now]
      );
    }

    // Workout templates.
    for (const t of seed.workoutTemplates) {
      await db.runAsync(
        `INSERT INTO workout_templates (id, name, exercises) VALUES (?, ?, ?);`,
        [t.id, t.name, JSON.stringify(t.exercises)]
      );
    }

    // Completed workout (only present on the 'today-is-done' seed).
    if (seed.completedWorkoutDate && seed.workoutTemplates.length > 0) {
      // Pair to the first template; the seed doesn't carry an explicit
      // mapping and any choice is fine for a dev seed.
      const template = seed.workoutTemplates[0];
      const startedAt = `${seed.completedWorkoutDate}T08:00:00.000Z`;
      const completedAt = `${seed.completedWorkoutDate}T08:47:00.000Z`;
      await db.runAsync(
        `INSERT INTO workouts (id, template_id, started_at, completed_at, duration_seconds)
         VALUES (?, ?, ?, ?, ?);`,
        [`w-seed-${seed.completedWorkoutDate}`, template.id, startedAt, completedAt, 47 * 60]
      );
    }
  });
}
