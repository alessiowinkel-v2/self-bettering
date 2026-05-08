import { useRef } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Pressable, Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../theme';
import { Text, TextButton } from '../primitives';
import type { Habit, HabitStatus } from '../../state/types';

type ActiveHabitRowProps = {
  habit: Habit;
  index: number;
  /**
   * Total number of rows in the active list. Used to suppress the trailing
   * divider on the last row. DraggableFlatList breaks ListGroup context, so
   * the count is threaded explicitly.
   */
  total: number;
  streak: number;
  todayStatus: HabitStatus | null;
  onPress: () => void;
  onPause: () => void;
  onArchive: () => void;
  /** From DraggableFlatList — call to start drag on long-press. */
  drag: () => void;
  /** From DraggableFlatList — true while this row is being dragged. */
  isActive: boolean;
};

/**
 * The swipeable, draggable row used in the active section of Habits List.
 * Builds the left/right lockup directly rather than reusing ListRow because
 * ListGroup context does not propagate through DraggableFlatList's render
 * tree.
 */
export function ActiveHabitRow({
  habit,
  index,
  total,
  streak,
  todayStatus,
  onPress,
  onPause,
  onArchive,
  drag,
  isActive,
}: ActiveHabitRowProps) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable | null>(null);

  const isLast = index === total - 1;

  const closeAndRun = (fn: () => void) => () => {
    swipeableRef.current?.close();
    fn();
  };

  // Pause and Archive both render quiet (secondary). Pause is a
  // daily-rare action and Archive is destructive-but-deliberate;
  // amber is reserved for the singular primary action of a screen
  // (filled-button rule's principle). Detail's action row uses the
  // same two-secondary lockup so the verbs read identically across
  // surfaces.
  const renderRightActions = () => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[3],
        gap: theme.spacing[2],
      }}
    >
      <TextButton
        label="Pause"
        tone="secondary"
        onPress={closeAndRun(onPause)}
        accessibilityLabel={`Pause ${habit.name}`}
      />
      <TextButton
        label="Archive"
        tone="secondary"
        onPress={closeAndRun(onArchive)}
        accessibilityLabel={`Archive ${habit.name}`}
      />
    </View>
  );

  const innerStyle: StyleProp<ViewStyle> = {
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
    minHeight: theme.touchTarget.minHeight,
    justifyContent: 'center',
    backgroundColor: isActive ? theme.colors.surfaceElev : theme.colors.bg,
  };

  const headerRowStyle: StyleProp<ViewStyle> = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing[3],
  };

  const todayCaption =
    todayStatus === 'held'
      ? 'Held today.'
      : todayStatus === 'slipped'
        ? 'Slipped today.'
        : null;

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions}>
      <Pressable
        onPress={onPress}
        onLongPress={drag}
        accessibilityRole="button"
        accessibilityLabel={`Open ${habit.name}`}
        style={({ pressed }) => [pressed && !isActive && { opacity: 0.85 }]}
      >
        <View style={innerStyle}>
          <View style={headerRowStyle}>
            <View style={{ flexShrink: 1 }}>
              <Text variant="body">{habit.name}</Text>
              {todayCaption !== null ? (
                <Text
                  variant="caption"
                  tone="secondary"
                  style={{ marginTop: theme.spacing[1] }}
                >
                  {todayCaption}
                </Text>
              ) : null}
            </View>
            <Text variant="streakAccent" tone="accent">
              {streak}
            </Text>
          </View>
        </View>
        {!isLast && !isActive ? (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.colors.divider,
            }}
          />
        ) : null}
      </Pressable>
    </Swipeable>
  );
}
