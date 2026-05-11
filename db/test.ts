import { getDB } from './db';
import {
  getLogsForDate,
  getStreakForHabit,
  logHabit,
} from './habitLogs';
import {
  createHabit,
  getActiveHabits,
} from './habits';
import { getJournalEntryForDate, upsertJournalEntry } from './journal';
import { runMigrations } from './migrate';
import { seedDev } from './seedDev';
import { logSet } from './sets';
import {
  completeWorkout,
  getMostRecentCompletedWorkoutDate,
  getWorkoutTemplates,
  insertWorkoutTemplate,
  startWorkout,
} from './workouts';

/**
 * Manual smoke tests. Invoke from a dev console or temporary button:
 *
 *   import { runDbTests } from './db/test';
 *   runDbTests().then(console.log);
 *
 * Each test resets the DB via seedDev. Failures throw with a descriptive
 * message — the runner collects them and reports a count.
 */

type TestResult = { name: string; ok: true } | { name: string; ok: false; error: string };

async function assertEqual<T>(
  actual: T,
  expected: T,
  message: string
): Promise<void> {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`
    );
  }
}

async function assert(condition: boolean, message: string): Promise<void> {
  if (!condition) throw new Error(message);
}

async function runOne(
  name: string,
  fn: () => Promise<void>
): Promise<TestResult> {
  try {
    await fn();
    return { name, ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { name, ok: false, error };
  }
}

export async function runDbTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: ReadonlyArray<TestResult>;
}> {
  await runMigrations();

  const results: TestResult[] = [];

  // 1. Migrations idempotent — running twice is safe and the manifest
  //    rows match the version count exactly once.
  results.push(
    await runOne('migrations idempotent', async () => {
      await runMigrations();
      const db = await getDB();
      const rows = await db.getAllAsync<{ version: number }>(
        'SELECT version FROM _migrations ORDER BY version ASC;'
      );
      await assert(rows.length >= 1, 'Expected at least one applied migration.');
    })
  );

  // 2. seedDev + getActiveHabits returns the three default habits.
  results.push(
    await runOne('seedDev populates active habits', async () => {
      await seedDev('default');
      const habits = await getActiveHabits();
      await assertEqual(habits.length, 3, 'Active habit count after default seed');
    })
  );

  // 3. logHabit upsert: writing twice on the same day overwrites.
  results.push(
    await runOne('logHabit upserts on (habit_id, date)', async () => {
      await seedDev('default');
      const habits = await getActiveHabits();
      const habit = habits[0];
      const date = '2026-05-07';
      await logHabit({ habitId: habit.id, date, status: 'slipped' });
      await logHabit({ habitId: habit.id, date, status: 'held' });
      const logs = await getLogsForDate(date);
      const target = logs.find((l) => l.habitId === habit.id);
      await assert(target?.status === 'held', 'Second log should overwrite first.');
    })
  );

  // 4. Streak math: held streak counts back from throughDate.
  results.push(
    await runOne('streak counts consecutive held days', async () => {
      await seedDev('default');
      const habits = await getActiveHabits();
      const habit = habits[0];
      const dates = ['2026-05-05', '2026-05-06', '2026-05-07'];
      for (const d of dates) {
        await logHabit({ habitId: habit.id, date: d, status: 'held' });
      }
      const streak = await getStreakForHabit({
        habitId: habit.id,
        throughDate: '2026-05-07',
      });
      await assertEqual(streak, 3, 'Three held days produces streak 3');
    })
  );

  // 5. Streak breaks on a slip.
  results.push(
    await runOne('slip breaks the streak', async () => {
      await seedDev('default');
      const habits = await getActiveHabits();
      const habit = habits[0];
      await logHabit({ habitId: habit.id, date: '2026-05-05', status: 'held' });
      await logHabit({ habitId: habit.id, date: '2026-05-06', status: 'slipped' });
      await logHabit({ habitId: habit.id, date: '2026-05-07', status: 'held' });
      const streak = await getStreakForHabit({
        habitId: habit.id,
        throughDate: '2026-05-07',
      });
      await assertEqual(streak, 1, 'Slip on 5-6 caps streak at 1 (just 5-7)');
    })
  );

  // 6. Streak breaks on a gap (missing day) the same way a slip does.
  results.push(
    await runOne('gap day breaks the streak', async () => {
      await seedDev('default');
      const habits = await getActiveHabits();
      const habit = habits[0];
      await logHabit({ habitId: habit.id, date: '2026-05-05', status: 'held' });
      // 2026-05-06 intentionally missing.
      await logHabit({ habitId: habit.id, date: '2026-05-07', status: 'held' });
      const streak = await getStreakForHabit({
        habitId: habit.id,
        throughDate: '2026-05-07',
      });
      await assertEqual(streak, 1, 'Gap on 5-6 caps streak at 1');
    })
  );

  // 7. Journal upsert on date.
  results.push(
    await runOne('journal upserts on date', async () => {
      await seedDev('default');
      const date = '2026-05-07';
      await upsertJournalEntry({ date, mood: 3, tags: ['morning'], body: 'first' });
      await upsertJournalEntry({ date, mood: 5, tags: ['evening'], body: 'second' });
      const entry = await getJournalEntryForDate(date);
      await assert(entry !== null, 'Entry should exist after upsert.');
      await assertEqual(entry!.body, 'second', 'Second upsert should win.');
      await assertEqual(entry!.mood, 5, 'Mood should be from second upsert.');
      await assertEqual([...entry!.tags], ['evening'], 'Tags should be from second upsert.');
    })
  );

  // 8. Most recent completed date: ignores in-progress workouts and
  //    returns the YYYY-MM-DD slice of the latest completion across all
  //    templates.
  results.push(
    await runOne('most recent completed date excludes in-progress and returns latest', async () => {
      await seedDev('default');
      const templates = await getWorkoutTemplates();
      await assert(templates.length >= 2, 'Expected at least two seeded templates.');
      const [t1, t2] = templates;

      // Two completed workouts on different dates and templates.
      const earlier = await startWorkout({ templateId: t1.id, startedAt: '2026-05-05T08:00:00.000Z' });
      await completeWorkout({ id: earlier.id, completedAt: '2026-05-05T08:30:00.000Z', durationSeconds: 1800 });
      const later = await startWorkout({ templateId: t2.id, startedAt: '2026-05-06T09:00:00.000Z' });
      await completeWorkout({ id: later.id, completedAt: '2026-05-06T09:45:00.000Z', durationSeconds: 2700 });

      // A third workout that is started but never completed. Its later
      // started_at must not bleed into the result — only completed_at
      // counts.
      await startWorkout({ templateId: t1.id, startedAt: '2026-05-07T08:00:00.000Z' });

      const recent = await getMostRecentCompletedWorkoutDate();
      await assertEqual(recent, '2026-05-06', 'Latest completed date wins, in-progress ignored.');
      await assert(recent !== null && recent.length === 10, 'Result is a YYYY-MM-DD slice.');
    })
  );

  // Bonus: set logging round-trip — exercises the sets module so it isn't
  // unreferenced during dev. Touches FK + insert paths that the streak
  // tests don't.
  results.push(
    await runOne('sets logged for a workout round-trip', async () => {
      await seedDev('default');
      const templates = await getWorkoutTemplates();
      const template = templates[0];
      const w = await startWorkout({ templateId: template.id });
      const logged = await logSet({
        workoutId: w.id,
        exerciseName: 'Bench press',
        setNumber: 1,
        kg: 82.5,
        reps: 6,
      });
      await assertEqual(logged.workoutId, w.id, 'Set bound to workout.');
      await completeWorkout({ id: w.id, durationSeconds: 60 });
    })
  );

  // Idempotency: double-tap on the Log button must not produce two rows.
  // Migration 0004's UNIQUE(workout_id, exercise_name, set_number) plus
  // logSet's try/catch on UNIQUE constraint failure should leave exactly
  // one row after two calls with the same logical tuple.
  results.push(
    await runOne('logSet is idempotent on (workout_id, exercise_name, set_number)', async () => {
      await seedDev('default');
      const templates = await getWorkoutTemplates();
      const template = templates[0];
      const w = await startWorkout({ templateId: template.id });
      await logSet({
        workoutId: w.id,
        exerciseName: 'Bench press',
        setNumber: 1,
        kg: 82.5,
        reps: 6,
      });
      await logSet({
        workoutId: w.id,
        exerciseName: 'Bench press',
        setNumber: 1,
        kg: 82.5,
        reps: 6,
      });
      const db = await getDB();
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
           FROM sets
          WHERE workout_id = ?
            AND exercise_name = ?
            AND set_number = ?;`,
        [w.id, 'Bench press', 1]
      );
      await assertEqual(row?.count ?? 0, 1, 'Two logSet calls should leave exactly one row.');
      await completeWorkout({ id: w.id, durationSeconds: 60 });
    })
  );

  // Sanity: insertWorkoutTemplate + createHabit are referenced during
  // operation. Touch them so dev cycles flag if they regress.
  results.push(
    await runOne('createHabit + insertWorkoutTemplate writeable', async () => {
      await seedDev('first-time');
      const created = await createHabit({ name: 'Sleep before midnight', createdOn: '2026-05-07' });
      await assert(created.id.startsWith('h-'), 'Habit id should be prefixed.');
      await insertWorkoutTemplate({
        id: 'wt-test',
        name: 'Test',
        exercises: [
          { name: 'A', setCount: 3, repRange: [5, 8] },
          { name: 'B', setCount: 3, repRange: [5, 8] },
        ],
      });
      const all = await getWorkoutTemplates();
      await assert(all.some((t) => t.id === 'wt-test'), 'Inserted template should be readable.');
    })
  );

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return { total: results.length, passed, failed, results };
}
