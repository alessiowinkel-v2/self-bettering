import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../primitives';
import type { WeekDot } from '../../utils/habitDetail';

/**
 * THIS WEEK row — seven dots, M T W T F S S. Held dots fill amber,
 * slipped dots show as a hollow disc with a hairline divider border,
 * empty / not-yet-logged days render as the same hollow surface tile.
 * Today's dot gets a 1px accent ring around the outside regardless of
 * its fill state — the design's "today" affordance.
 *
 * This row is purely visual; no per-dot interaction. The brief reserves
 * future per-day editing for a later phase.
 */

const DOT_SIZE = 12;
const RING_PADDING = 3;
const RING_OUTER_SIZE = DOT_SIZE + RING_PADDING * 2;

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

function Dot({ status, theme }: { status: WeekDot['status']; theme: ThemeShape }) {
  const baseStyle = {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  } as const;

  if (status === 'held') {
    return <View style={[baseStyle, { backgroundColor: theme.colors.accent }]} />;
  }

  if (status === 'slipped') {
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
