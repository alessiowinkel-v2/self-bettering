import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import {
  GymEmpty,
  NextWorkoutCard,
  RoutineRow,
} from '../../components/gym';
import {
  Screen,
  SectionHeader,
  Text,
  TextButton,
  WeekDots,
} from '../../components/primitives';
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

  const templates = useGymHomeStore((s) => s.templates);
  const nextTemplateId = useGymHomeStore((s) => s.nextTemplateId);
  const completedDatesThisWeek = useGymHomeStore(
    (s) => s.completedDatesThisWeek,
  );
  const referenceDate = useGymHomeStore((s) => s.referenceDate);
  const isHydrated = useGymHomeStore((s) => s.isHydrated);

  useFocusEffect(
    useCallback(() => {
      void useGymHomeStore.getState().hydrate();
    }, []),
  );

  const nextTemplate = useMemo(
    () =>
      templates.find((t) => t.template.id === nextTemplateId)?.template ?? null,
    [templates, nextTemplateId],
  );

  const nextPreviewLine = useMemo(
    () => (nextTemplate ? nextTemplate.exercises.slice(0, 3).join(', ') : ''),
    [nextTemplate],
  );

  const weekDots = useMemo(
    () =>
      buildGymWeekDots({
        today: referenceDate,
        completedDates: completedDatesThisWeek,
      }),
    [referenceDate, completedDatesThisWeek],
  );

  // "3 of 4 done this week" — denominator is total routine count, so a
  // four-routine week with three completions reads as on-pace. Hidden
  // when no completions yet (matches the design's "nothing logged this
  // week" frame).
  const weekDoneCount = completedDatesThisWeek.length;

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

      {nextTemplate ? (
        <>
          <SectionHeader marginTop={0}>Up next</SectionHeader>
          <NextWorkoutCard
            name={nextTemplate.name}
            previewLine={nextPreviewLine}
            onStart={() => console.log('[gym] start pressed', nextTemplate.id)}
          />
        </>
      ) : null}

      <SectionHeader>This week</SectionHeader>
      <WeekDots dots={weekDots} />
      {weekDoneCount > 0 ? (
        <Text
          variant="caption"
          tone="secondary"
          style={{ marginTop: theme.spacing[3] }}
        >
          {weekDoneCount} of {templates.length} done this week.
        </Text>
      ) : null}

      <SectionHeader>Routines</SectionHeader>
      <View>
        {templates.map((row, i) => {
          const lastPhrase = formatRelativeDate({
            fromDate: row.lastCompletedDate,
            today: referenceDate,
          });
          const exerciseCount = row.template.exercises.length;
          const exerciseLabel = exerciseCount === 1 ? 'exercise' : 'exercises';
          const subtitle = `Last · ${lastPhrase} · ${exerciseCount} ${exerciseLabel}`;
          return (
            <RoutineRow
              key={row.template.id}
              name={row.template.name}
              subtitle={subtitle}
              isNextUp={row.template.id === nextTemplateId}
              isLast={i === templates.length - 1}
              onPress={() =>
                console.log('[gym] routine pressed', row.template.id)
              }
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
