import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ListGroup,
  ListRow,
  Text,
  TextButton,
} from '../../../components/primitives';
import { useGymHomeStore } from '../../../state/gymHomeStore';
import { useTheme } from '../../../theme';
import { formatRelativeDate } from '../../../utils/gymHome';

/**
 * Workout detail — the Start / Edit choice screen.
 *
 * Reached by tapping a workout row on the Gym tab. Shows the workout
 * name, when it was last done, and its exercise list, with two
 * affordances: "Start workout" (the screen's reason to exist) and
 * "Edit". A pushed screen, not a modal — the native back chevron
 * returns to the Gym tab, and the Active Workout / editor modals stack
 * cleanly on top.
 *
 * The template is read from the Gym Home store, so an edit-save (which
 * re-hydrates that store) re-renders this screen with the new name and
 * exercises without a refresh of its own. On a cold start the store is
 * not yet hydrated; the effect below kicks a hydrate so the row
 * resolves. An id that never resolves (deleted workout) pops back.
 */
export default function WorkoutDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const id = typeof idParam === 'string' ? idParam : '';

  const isHydrated = useGymHomeStore((s) => s.isHydrated);
  const referenceDate = useGymHomeStore((s) => s.referenceDate);
  const row = useGymHomeStore(
    (s) => s.templates.find((t) => t.template.id === id) ?? null,
  );

  // Cold start / deep link: the Gym tab never mounted, so the store is
  // empty. Hydrate once so the row resolves.
  useEffect(() => {
    if (!isHydrated) void useGymHomeStore.getState().hydrate();
  }, [isHydrated]);

  // The id does not match any workout (deleted between tap and mount).
  // Wait for hydration to settle before deciding, then pop back.
  useEffect(() => {
    if (isHydrated && row === null) router.back();
  }, [isHydrated, row, router]);

  const Header = (
    <View
      style={{
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        justifyContent: 'center',
      }}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [pressed && { opacity: 0.6 }]}
      >
        <ChevronLeft
          size={24}
          color={theme.colors.textSecondary}
          strokeWidth={1.5}
        />
      </Pressable>
    </View>
  );

  if (row === null) {
    // Loading (pre-hydrate) or about-to-pop (unresolved id). Render the
    // header alone so the back chevron stays usable either way.
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        edges={['top']}
      >
        {Header}
      </SafeAreaView>
    );
  }

  const { template, lastCompletedDate } = row;
  const relative = formatRelativeDate({
    fromDate: lastCompletedDate,
    today: referenceDate,
  });
  const lastLabel =
    relative === 'never' ? 'NEVER DONE' : `LAST · ${relative.toUpperCase()}`;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      edges={['top']}
    >
      {Header}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing[5],
          paddingBottom: theme.spacing[8],
        }}
      >
        <Text
          variant="display"
          style={{ fontSize: 40, lineHeight: 46, marginTop: theme.spacing[3] }}
        >
          {template.name}
        </Text>
        <Text
          variant="label"
          tone="secondary"
          style={{ marginTop: theme.spacing[2] }}
        >
          {lastLabel}
        </Text>

        <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[1] }}>
          <TextButton
            label="Start workout"
            onPress={() =>
              router.push({
                pathname: '/workout',
                params: { templateId: template.id },
              })
            }
            accessibilityLabel={`Start ${template.name}`}
          />
          <TextButton
            label="Edit"
            tone="secondary"
            onPress={() => router.push(`/routine/${template.id}/edit`)}
            accessibilityLabel={`Edit ${template.name}`}
          />
        </View>

        <View style={{ marginTop: theme.spacing[7] }}>
          <Text
            variant="label"
            tone="secondary"
            style={{ marginBottom: theme.spacing[3] }}
          >
            EXERCISES
          </Text>
          <ListGroup>
            {template.exercises.map((exercise, index) => (
              <ListRow
                key={`${exercise.name}-${index}`}
                index={index}
                left={<Text variant="body">{exercise.name}</Text>}
                right={
                  <Text variant="caption" tone="secondary">
                    {`${exercise.setCount} × ${exercise.repRange[0]}–${exercise.repRange[1]}`}
                  </Text>
                }
              />
            ))}
          </ListGroup>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
