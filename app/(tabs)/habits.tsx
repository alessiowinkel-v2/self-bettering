import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Screen, Text, TextButton } from '../../components/primitives';
import {
  ActiveHabitRow,
  ArchivedSection,
  HabitsEmpty,
  PausedSection,
} from '../../components/habits';
import { useHabitsListStore } from '../../state/habitsListStore';
import { useTheme } from '../../theme';
import type { Habit } from '../../state/types';

/**
 * Habits tab — the canonical list of every habit, segmented by state.
 *
 * Architecture:
 * - DraggableFlatList owns scrolling. Putting a virtualized list inside
 *   the Screen primitive's ScrollView triggers React Native's
 *   "virtualization-inside-scrollview" warning, so the screen runs in
 *   `scroll={false}` mode and the list provides its own scroll surface.
 * - Header (title) and footer (add link, paused, archived) are passed via
 *   the list's own slots so they scroll together with the active rows.
 * - Hydration runs on every focus via useFocusEffect; the store is shared
 *   with Today and other entry points may have mutated rows out of band
 *   (Phase 3b's Habit Detail among others).
 */
export default function HabitsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const active = useHabitsListStore((s) => s.active);
  const paused = useHabitsListStore((s) => s.paused);
  const archived = useHabitsListStore((s) => s.archived);
  const streaksThroughYesterday = useHabitsListStore(
    (s) => s.streaksThroughYesterday,
  );
  const todayStatus = useHabitsListStore((s) => s.todayStatus);
  const isHydrated = useHabitsListStore((s) => s.isHydrated);

  useFocusEffect(
    useCallback(() => {
      void useHabitsListStore.getState().hydrate();
    }, []),
  );

  const onOpenHabit = useCallback((_id: string) => {}, []);

  const onAddHabit = useCallback(() => {
    router.push('/add-habit');
  }, [router]);

  const onReorder = useCallback((data: ReadonlyArray<Habit>) => {
    void useHabitsListStore.getState().reorder(data.map((h) => h.id));
  }, []);

  const onPause = useCallback((id: string) => {
    void useHabitsListStore.getState().pause(id);
  }, []);

  const onArchive = useCallback((id: string) => {
    void useHabitsListStore.getState().archive(id);
  }, []);

  const onEdit = useCallback((_id: string) => {}, []);

  const renderActiveItem = ({
    item,
    drag,
    isActive,
    getIndex,
  }: RenderItemParams<Habit>) => {
    const i = getIndex() ?? 0;
    return (
      <ActiveHabitRow
        habit={item}
        index={i}
        total={active.length}
        streak={streaksThroughYesterday[item.id] ?? 0}
        todayStatus={todayStatus[item.id] ?? null}
        onPress={() => onOpenHabit(item.id)}
        onPause={() => onPause(item.id)}
        onEdit={() => onEdit(item.id)}
        onArchive={() => onArchive(item.id)}
        drag={drag}
        isActive={isActive}
      />
    );
  };

  const Title = (
    <View style={{ marginTop: theme.spacing[3], marginBottom: theme.spacing[5] }}>
      <Text variant="display">Habits.</Text>
    </View>
  );

  // Loading: render only the title so the page does not flash an empty
  // state during the first hydrate. Mirrors the Today first-render gap.
  if (!isHydrated) {
    return (
      <Screen scroll={false}>
        {Title}
      </Screen>
    );
  }

  const isEmptyAcrossSections =
    active.length === 0 && paused.length === 0 && archived.length === 0;

  if (isEmptyAcrossSections) {
    return (
      <Screen scroll={false}>
        {Title}
        <HabitsEmpty onAdd={onAddHabit} />
      </Screen>
    );
  }

  const Footer = (
    <View>
      <View style={{ marginTop: theme.spacing[2] }}>
        <TextButton
          label="+ Add habit"
          onPress={onAddHabit}
          accessibilityLabel="Add a habit"
        />
      </View>

      <PausedSection
        habits={paused}
        onRowPress={onOpenHabit}
        activeIsEmpty={active.length === 0}
      />

      <ArchivedSection habits={archived} onRowPress={onOpenHabit} />
    </View>
  );

  return (
    <Screen scroll={false}>
      {/* `active` is ReadonlyArray<Habit> from the store; DraggableFlatList
          types `data` as mutable T[]. The library copies via [...data]
          before any internal splice (verified in v4.0.3 source), so the
          cast is sound — preserves the store's stable reference across
          renders without forcing an O(N) allocation per render. */}
      <DraggableFlatList<Habit>
        data={active as Habit[]}
        keyExtractor={(item) => item.id}
        renderItem={renderActiveItem}
        onDragEnd={({ data }) => onReorder(data)}
        activationDistance={20}
        ListHeaderComponent={Title}
        ListFooterComponent={Footer}
        contentContainerStyle={{ paddingBottom: theme.spacing[8] }}
      />
    </Screen>
  );
}
