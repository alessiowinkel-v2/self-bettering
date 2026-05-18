import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Text } from '../primitives/Text';
import { useTheme } from '../../theme';
import type { ChartPoint } from '../../utils/exerciseHistory';

/**
 * The top-set trend chart on Exercise History — top-set weight per
 * session, plotted oldest-to-newest left-to-right.
 *
 * Deliberately quiet, per the design: a 1px near-neutral line — a warm
 * grey, reads as a pencil mark, not a colored stroke — with no axis
 * lines, no grid, no y-axis. The only emphasis is on the recent end:
 * a filled accent dot on the latest session, hollow accent rings on the
 * two before it, nothing on the earlier points. X-axis labels appear
 * for the first, middle, and last session only.
 *
 * Renders nothing below two points — a line needs two points to read as
 * a line. That mirrors the screen-level `shouldShowChart` gate, so the
 * single-session state shows no chart whether the caller guards or not.
 *
 * Hand-drawn with react-native-svg rather than a chart library: the
 * design is specific and minimal enough that a library would be both
 * heavier and harder to bend to spec.
 */

/** Plot band height. Quiet — close to a habit-detail heatmap row band,
 *  not a hero element. Tune on-device against the heatmap. */
const PLOT_HEIGHT = 64;
/** Horizontal/vertical breathing room so edge dots are never clipped. */
const EDGE_INSET = 6;
const LINE_WIDTH = 1;
const FILLED_DOT_RADIUS = 3;
const RING_RADIUS = 3.5;
const RING_WIDTH = 1;

type TopSetChartProps = {
  /** Chart points oldest-first, as produced by `chartPoints`. */
  points: ReadonlyArray<ChartPoint>;
};

type DotKind = 'filled' | 'ring';
type Dot = { key: string; x: number; y: number; kind: DotKind };

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Project points into SVG coordinates: a polyline string for the line
 * and the dot list for the recent end. Weight maps to the full plot
 * band; a perfectly flat series sits on the mid-line rather than
 * collapsing to the floor.
 */
function geometry(
  points: ReadonlyArray<ChartPoint>,
  width: number
): { linePoints: string; dots: ReadonlyArray<Dot> } {
  const n = points.length;
  const kgs = points.map((p) => p.kg);
  const minKg = Math.min(...kgs);
  const maxKg = Math.max(...kgs);
  const range = maxKg - minKg;

  const innerW = width - 2 * EDGE_INSET;
  const innerH = PLOT_HEIGHT - 2 * EDGE_INSET;

  const xFor = (i: number): number => EDGE_INSET + innerW * (i / (n - 1));
  const yFor = (kg: number): number =>
    range === 0
      ? PLOT_HEIGHT / 2
      : EDGE_INSET + (1 - (kg - minKg) / range) * innerH;

  const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.kg) }));
  const linePoints = coords
    .map((c) => `${round(c.x)},${round(c.y)}`)
    .join(' ');

  const dots: Dot[] = [];
  points.forEach((p, i) => {
    // Latest session is the filled dot; the two before it are rings;
    // everything earlier is bare line.
    const kind: DotKind | null =
      i === n - 1 ? 'filled' : i === n - 2 || i === n - 3 ? 'ring' : null;
    if (kind !== null) {
      dots.push({ key: p.workoutId, x: coords[i].x, y: coords[i].y, kind });
    }
  });

  return { linePoints, dots };
}

/** Indices of the first, middle, and last point, de-duplicated — a
 *  two-point chart collapses the middle into the endpoints. */
function axisLabelIndices(n: number): ReadonlyArray<number> {
  return [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
}

export function TopSetChart({ points }: TopSetChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };

  // A line needs two points. Below that there is no chart — the
  // first-session state. Guard sits after hooks so the hook order
  // stays stable across renders.
  if (points.length < 2) return null;

  const labelIndices = axisLabelIndices(points.length);

  return (
    <View
      onLayout={onLayout}
      accessibilityRole="image"
      accessibilityLabel={`Top set trend across ${points.length} sessions.`}
      style={{
        minHeight:
          PLOT_HEIGHT +
          theme.spacing[2] +
          (theme.type.caption.lineHeight ?? 18),
      }}
    >
      {width > 0 ? (
        <ChartBody points={points} width={width} theme={theme} />
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          marginTop: theme.spacing[2],
        }}
      >
        {labelIndices.map((pointIndex, slot) => (
          <Text
            key={pointIndex}
            variant="caption"
            tone="secondary"
            style={{
              flex: 1,
              textAlign:
                slot === 0
                  ? 'left'
                  : slot === labelIndices.length - 1
                    ? 'right'
                    : 'center',
            }}
          >
            {format(parseISO(points[pointIndex].date), 'MMM d').toLowerCase()}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * The drawn band. Split out so the SVG only renders once `width` is
 * measured — geometry depends on the measured width.
 */
function ChartBody({
  points,
  width,
  theme,
}: {
  points: ReadonlyArray<ChartPoint>;
  width: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const { linePoints, dots } = geometry(points, width);

  return (
    <Svg width={width} height={PLOT_HEIGHT}>
      <Polyline
        points={linePoints}
        fill="none"
        stroke={theme.colors.textSecondary}
        strokeWidth={LINE_WIDTH}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {dots.map((dot) =>
        dot.kind === 'filled' ? (
          <Circle
            key={dot.key}
            cx={dot.x}
            cy={dot.y}
            r={FILLED_DOT_RADIUS}
            fill={theme.colors.accent}
          />
        ) : (
          <Circle
            key={dot.key}
            cx={dot.x}
            cy={dot.y}
            r={RING_RADIUS}
            // Filled with the background so the line does not show
            // through the ring's centre.
            fill={theme.colors.bg}
            stroke={theme.colors.accent}
            strokeWidth={RING_WIDTH}
          />
        )
      )}
    </Svg>
  );
}
