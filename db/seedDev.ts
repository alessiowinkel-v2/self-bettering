import { parseISO, subDays } from 'date-fns';
import { seedFor, type SeedName } from '../dev/seedFixtures';
import { toIsoDate } from '../utils/dateFormat';
import { getDB } from './db';
import { createHabit } from './habits';
import { setId } from './ids';

/**
 * Dev-only seeder. Wipes the domain tables and reinserts rows built from
 * seedFixtures' `seedFor()`, so the data layer can be exercised against
 * the exact shapes the Today screen already understands.
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

    // Habits. Routed through createHabit so each row lands at the
    // production-path sort_order (COALESCE(MAX)+1, scoped to active),
    // exercising the same write the Habits List uses. The trade-off is
    // generated ts36-suffixed ids — we keep a fixture-to-real map so
    // downstream logs and streak backfills still resolve correctly.
    const fixtureIdToRealId = new Map<string, string>();
    for (const h of seed.habits) {
      const created = await createHabit({ name: h.name, createdOn: h.createdOn });
      fixtureIdToRealId.set(h.id, created.id);
    }

    // Habit logs. Yesterday + any today logs the seed produced, plus a
    // backfill of held days going back so getStreakForHabit returns the
    // canonical design-PDF streaks (24, 11, 3) instead of 1.
    const allLogs = [...seed.yesterdayLogs, ...seed.todayLogs];
    for (const log of allLogs) {
      const realHabitId = fixtureIdToRealId.get(log.habitId);
      if (!realHabitId) continue;
      const id = `hl-${realHabitId}-${log.date}`;
      await db.runAsync(
        `INSERT INTO habit_logs (id, habit_id, date, status, logged_at)
         VALUES (?, ?, ?, ?, ?);`,
        [id, realHabitId, log.date, log.status, new Date().toISOString()]
      );
    }

    // Streak backfill. For each habit with a target streak from the
    // design PDF, write `streak - 1` more held logs ending the day before
    // yesterday. Yesterday's log already exists from seedYesterdayLogs.
    // Stops if the cursor would precede the habit's createdOn.
    for (const h of seed.habits) {
      const targetStreak = seed.targetStreaks[h.id] ?? 0;
      if (targetStreak < 2) continue;

      const yesterdayLog = seed.yesterdayLogs.find((l) => l.habitId === h.id);
      if (!yesterdayLog || yesterdayLog.status !== 'held') continue;

      const realHabitId = fixtureIdToRealId.get(h.id);
      if (!realHabitId) continue;

      const now = new Date().toISOString();
      let cursor = subDays(parseISO(yesterdayLog.date), 1);
      const cutoff = parseISO(h.createdOn);

      for (let i = 1; i < targetStreak; i += 1) {
        if (cursor < cutoff) break;
        const date = toIsoDate(cursor);
        const id = `hl-${realHabitId}-${date}`;
        await db.runAsync(
          `INSERT INTO habit_logs (id, habit_id, date, status, logged_at)
           VALUES (?, ?, ?, 'held', ?);`,
          [id, realHabitId, date, now]
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
        `INSERT INTO workout_templates (id, name, exercises, rotation_order)
         VALUES (?, ?, ?, ?);`,
        [t.id, t.name, JSON.stringify(t.exercises), t.rotationOrder]
      );
    }

    // Per-template prior workout. One completed workout per template,
    // staggered backwards from today by `(rotationOrder - 1) * 2 + 7`
    // days so each template has its own "last" date that doesn't fall
    // inside the current Mon–Sun week (Gym Home's THIS WEEK strip would
    // otherwise show seeded workouts as completed-this-week, which
    // contradicts the 'default' seed's "nothing logged this week"
    // frame).
    //
    // Each workout's sets are pulled from the template's `priorSets`
    // map so Active Workout's "LAST 82.5kg × 6, 6, 5, 4" line and the
    // numeric-pad "last · X" pill populate on first run-through. Without
    // these seeds, every exercise on every first-of-the-day workout
    // would render as a first-ever session.
    //
    // Workouts with no completed_at are orphans (force-quit
    // mid-workout). Boot-time cleanup deletes any older than 24h. Resume-
    // in-progress would require surfacing them; deferred to Phase 4.
    const nowIso = new Date().toISOString();
    for (const t of seed.workoutTemplates) {
      const daysBack = (t.rotationOrder - 1) * 2 + 7;
      const completedDate = toIsoDate(subDays(new Date(), daysBack));
      const startedAt = `${completedDate}T08:00:00.000Z`;
      const completedAt = `${completedDate}T08:47:00.000Z`;
      const priorWorkoutId = `w-seed-prior-${t.id}`;
      await db.runAsync(
        `INSERT INTO workouts (id, template_id, started_at, completed_at, duration_seconds)
         VALUES (?, ?, ?, ?, ?);`,
        [priorWorkoutId, t.id, startedAt, completedAt, 47 * 60]
      );

      for (const exercise of t.exercises) {
        const prior = t.priorSets[exercise.name] ?? [];
        for (let i = 0; i < prior.length; i += 1) {
          const s = prior[i];
          const setNumber = i + 1;
          const id = setId(setNumber);
          await db.runAsync(
            `INSERT INTO sets (id, workout_id, exercise_name, set_number, kg, reps, logged_at)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [id, priorWorkoutId, exercise.name, setNumber, s.kg, s.reps, nowIso]
          );
        }
      }
    }

    // 'today-is-done' seed: an additional completed workout dated today
    // so Today's Next-workout slot rolls into the "done" branch. Sets
    // for this workout aren't seeded — the takeover doesn't render them
    // and any future Exercise History view would treat the prior
    // template-seeded sets as the source of truth anyway.
    if (seed.completedWorkoutDate && seed.workoutTemplates.length > 0) {
      const template = seed.workoutTemplates[0];
      const startedAt = `${seed.completedWorkoutDate}T08:00:00.000Z`;
      const completedAt = `${seed.completedWorkoutDate}T08:47:00.000Z`;
      await db.runAsync(
        `INSERT INTO workouts (id, template_id, started_at, completed_at, duration_seconds)
         VALUES (?, ?, ?, ?, ?);`,
        [
          `w-seed-today-${seed.completedWorkoutDate}`,
          template.id,
          startedAt,
          completedAt,
          47 * 60,
        ]
      );
    }
  });
}
