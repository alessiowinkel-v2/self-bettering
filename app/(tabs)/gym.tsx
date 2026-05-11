import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { GymEmpty, RoutineRow } from '../../components/gym';
import {
  Screen,
  SectionHeader,
  Text,
  TextButton,
  WeekDots,
} from '../../components/primitives';
import { NextWorkoutCard } from '../../components/workout';
import { getMostRecentOrphan, type ResumableOrphan } from '../../db/workouts';
import { useGymHomeStore } from '../../state/gymHomeStore';
import { useTheme } from '../../theme';
import { buildGymWeekDots, formatRelativeDate } from '../../utils/gymHome';

/**
 * Gym tab — Gym Home. Vertical order from the design PDF:
 *   1. "Gym." title
 *   2. "Up next" section: NextWorkoutCard (when a next routine exists)
 *   3. "This week" section: WeekDots + "X of N done this week" caption
 *   4. "Routines" section: RoutineRow list + "+ Add routine" link
 *
 * First-time empty (no routines anywhere) replaces the body with
 * GymEmpty's "No routines yet." / "Add one." pair.
 *
 * Hydration runs on focus — the store is populated via SQLite. No
 * mutations live here; Active Workout (Phase 3e+) will own the
 * start/complete writes and refresh this store + Today after each.
 *
 * Wiring into the Active Workout route is deferred to Phase 3e+.
 * Routine taps, Start, "+ Add routine", and "Add one." all log to
 * the console for now.
 */
export default function GymScreen() {
  const theme = useTheme();
  const router = useRouter();

  const startWorkout = useCallback(
    (templateId: string) => {
      router.push({ pathname: '/workout', params: { templateId } });
    },
    [router],
  );

  const templates = useGymHomeStore((s) => s.templates);
  const nextTemplateId = useGymHomeStore((s) => s.nextTemplateId);
  const completedDatesThisWeek = useGymHomeStore(
    (s) => s.completedDatesThisWeek,
  );
  const routinesCompletedThisWeek = useGymHomeStore(
    (s) => s.routinesCompletedThisWeek,
  );
  const referenceDate = useGymHomeStore((s) => s.referenceDate);
  const isHydrated = useGymHomeStore((s) => s.isHydrated);

  // Orphan state is screen-local: source of truth is the DB, no other
  // screen needs it, and re-reading on focus is the right cadence
  // (Active Workout writes to the workouts table on abandon/resume —
  // by the time the user lands back on Gym Home, focus fires and the
  // snapshot is current). Static read on mount/focus also matches the
  // design intent: elapsed minutes are a glance, not a tick.
  const [orphan, setOrphan] = useState<ResumableOrphan | null>(null);

  useFocusEffect(
    useCallback(() => {
      void useGymHomeStore.getState().hydrate();
      let cancelled = false;
      void getMostRecentOrphan().then((o) => {
        if (!cancelled) setOrphan(o);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const nextTemplate = useMemo(
    () =>
      templates.find((t) => t.template.id === nextTemplateId)?.template ?? null,
    [templates, nextTemplateId],
  );

  const nextPreviewLine = useMemo(
    () =>
      nextTemplate
        ? nextTemplate.exercises
            .slice(0, 3)
            .map((e) => e.name)
            .join(', ')
        : '',
    [nextTemplate],
  );

  // The orphan's template — looked up from the hydrated templates list
  // so we have its display name without an extra read. If the orphan
  // points at a template the user just deleted, fall through to the
  // next-up card.
  const orphanTemplate = useMemo(
    () =>
      orphan
        ? templates.find((t) => t.template.id === orphan.templateId)?.template ??
          null
        : null,
    [orphan, templates],
  );

  const weekDots = useMemo(
    () =>
      buildGymWeekDots({
        today: referenceDate,
        completedDates: completedDatesThisWeek,
      }),
    [referenceDate, completedDatesThisWeek],
  );

  // "2 of 4 done this week" — numerator is distinct routines completed
  // this week (one routine done Mon and Fri still reads as 1), not
  // distinct days. Denominator is total routine count, so the caption
  // tracks "how much of the rotation has been touched." Hidden when
  // zero (matches the design's "nothing logged this week" frame).

  const Title = (
    <View style={{ marginTop: theme.spacing[3], marginBottom: theme.spacing[5] }}>
      <Text variant="display">Gym.</Text>
    </View>
  );

  if (!isHydrated) {
    return <Screen>{Title}</Screen>;
  }

  if (templates.length === 0) {
    return (
      <Screen>
        {Title}
        <GymEmpty onAdd={() => console.log('[gym] add routine pressed')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {Title}

      {orphan && orphanTemplate ? (
        <>
          <SectionHeader marginTop={0}>Up next</SectionHeader>
          <NextWorkoutCard
            mode="in-progress"
            name={orphanTemplate.name}
            currentExerciseName={orphan.currentExerciseName}
            currentSetNumber={orphan.currentSetNumber}
            totalSetsForExercise={orphan.totalSetsForExercise}
            elapsedMinutes={orphan.elapsedMinutes}
            onResume={() => startWorkout(orphan.templateId)}
          />
        </>
      ) : nextTemplate ? (
        <>
          <SectionHeader marginTop={0}>Up next</SectionHeader>
          <NextWorkoutCard
            name={nextTemplate.name}
            previewLine={nextPreviewLine}
            onStart={() => startWorkout(nextTemplate.id)}
          />
        </>
      ) : null}

      <View style={{ marginTop: theme.spacing[7] }}>
        <Text
          variant="label"
          tone="secondary"
          style={{ marginBottom: theme.spacing[3] }}
        >
          THIS WEEK
        </Text>
        <WeekDots dots={weekDots} />
        {routinesCompletedThisWeek > 0 ? (
          <Text
            variant="caption"
            tone="secondary"
            style={{ marginTop: theme.spacing[3] }}
          >
            {routinesCompletedThisWeek} of {templates.length} done this week.
          </Text>
        ) : null}
      </View>

      <SectionHeader>Routines</SectionHeader>
      <View>
        {templates.map((row, i) => {
          const lastPhrase = formatRelativeDate({
            fromDate: row.lastCompletedDate,
            today: referenceDate,
          });
          const exerciseCount = row.template.exercises.length;
          const exerciseLabel = exerciseCount === 1 ? 'exercise' : 'exercises';
          const subtitle = `Last · ${lastPhrase} · ${exerciseCount} ${exerciseLabel}.`;
          return (
            <RoutineRow
              key={row.template.id}
              name={row.template.name}
              subtitle={subtitle}
              isNextUp={row.template.id === nextTemplateId}
              isLast={i === templates.length - 1}
              onPress={() => startWorkout(row.template.id)}
            />
          );
        })}
      </View>
      <View style={{ marginTop: theme.spacing[2] }}>
        <TextButton
          label="+ Add routine"
          onPress={() => console.log('[gym] add routine pressed')}
          accessibilityLabel="Add a routine"
        />
      </View>
    </Screen>
  );
}
