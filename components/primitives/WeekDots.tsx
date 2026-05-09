import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

/**
 * THIS WEEK row — seven dots, M T W T F S S. Generic primitive shared
 * by Habit Detail and Gym Home. The status union is intentionally
 * domain-agnostic:
 *
 *   'filled'   — solid amber dot. Habit Detail's "held". Gym Home's
 *                "workout completed this day".
 *   'outlined' — hollow disc with a hairline border. Habit Detail's
 *                "slipped". Workouts have no slipped concept, so Gym
 *                Home never emits this.
 *   'empty'    — flat surface tile. Both surfaces use this for
 *                not-yet-logged past days and future days within the
 *                current week.
 *
 * Today's dot gets a 1px accent ring around the outside regardless of
 * its fill state — the design's "today" affordance.
 *
 * This row is purely visual; no per-dot interaction.
 */

const DOT_SIZE = 12;
const RING_PADDING = 3;
const RING_OUTER_SIZE = DOT_SIZE + RING_PADDING * 2;

export type WeekDotStatus = 'filled' | 'outlined' | 'empty';

export type WeekDot = {
  /** ISO date the dot represents. */
  date: string;
  /** "M" | "T" | "W" | "T" | "F" | "S" | "S" — letter under the dot. */
  letter: string;
  status: WeekDotStatus;
  /** True when this dot represents today (gets a ring overlay). */
  isToday: boolean;
};

type WeekDotsProps = {
  dots: ReadonlyArray<WeekDot>;
};

export function WeekDots({ dots }: WeekDotsProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {dots.map((dot, i) => (
        <View key={`${dot.date}-${i}`} style={{ alignItems: 'center', gap: theme.spacing[2] }}>
          <View
            style={{
              width: RING_OUTER_SIZE,
              height: RING_OUTER_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: RING_OUTER_SIZE / 2,
              borderWidth: dot.isToday ? 1 : 0,
              borderColor: dot.isToday ? theme.colors.accent : 'transparent',
            }}
          >
            <Dot status={dot.status} theme={theme} />
          </View>
          <Text variant="label" tone="secondary">
            {dot.letter}
          </Text>
        </View>
      ))}
    </View>
  );
}

type ThemeShape = ReturnType<typeof useTheme>;

function Dot({ status, theme }: { status: WeekDotStatus; theme: ThemeShape }) {
  const baseStyle = {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  } as const;

  if (status === 'filled') {
    return <View style={[baseStyle, { backgroundColor: theme.colors.accent }]} />;
  }

  if (status === 'outlined') {
    return (
      <View
        style={[
          baseStyle,
          {
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.divider,
          },
        ]}
      />
    );
  }

  return <View style={[baseStyle, { backgroundColor: theme.colors.surface }]} />;
}
