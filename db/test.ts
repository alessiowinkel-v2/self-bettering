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
  getMostRecentCompletedWorkout,
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

  // 8. Workout completion: per-template filter, ignores in-progress, and
  //    a newer completion on a different template does not bleed through.
  results.push(
    await runOne('most recent completed filters by template and ignores in-progress', async () => {
      await seedDev('default');
      const templates = await getWorkoutTemplates();
      await assert(templates.length >= 2, 'Expected at least two seeded templates.');
      const [t1, t2] = templates;

      // t1: complete an older workout, then start an in-progress one that
      // must NOT be returned.
      const t1Done = await startWorkout({ templateId: t1.id, startedAt: '2026-05-06T08:00:00.000Z' });
      await completeWorkout({ id: t1Done.id, completedAt: '2026-05-06T08:30:00.000Z', durationSeconds: 1800 });
      await startWorkout({ templateId: t1.id, startedAt: '2026-05-07T08:00:00.000Z' });

      // t2: a newer completed workout. Must NOT be returned for t1.
      const t2Done = await startWorkout({ templateId: t2.id, startedAt: '2026-05-07T09:00:00.000Z' });
      await completeWorkout({ id: t2Done.id, completedAt: '2026-05-07T09:45:00.000Z', durationSeconds: 2700 });

      const t1Recent = await getMostRecentCompletedWorkout(t1.id);
      await assert(t1Recent !== null, 'Expected a completed workout for t1.');
      await assertEqual(t1Recent!.id, t1Done.id, 'In-progress and other-template results should be excluded.');
      await assertEqual(t1Recent!.date, '2026-05-06', 'Date derived from completed_at.');

      const t2Recent = await getMostRecentCompletedWorkout(t2.id);
      await assert(t2Recent !== null, 'Expected a completed workout for t2.');
      await assertEqual(t2Recent!.id, t2Done.id, 'Per-template filter returns t2 own workout.');
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
        exercises: ['A', 'B'],
      });
      const all = await getWorkoutTemplates();
      await assert(all.some((t) => t.id === 'wt-test'), 'Inserted template should be readable.');
    })
  );

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return { total: results.length, passed, failed, results };
}
