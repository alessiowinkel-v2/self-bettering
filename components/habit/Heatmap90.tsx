import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { useTheme } from '../../theme';
import {
  buildHeatmapCells,
  HEATMAP_TOTAL_CELLS,
  heldCellOpacity,
  type HeatmapCell,
} from '../../utils/habitDetail';
import type { HabitLog } from '../../state/types';

/**
 * The "LAST 90 DAYS" heatmap. The user-facing label says 90; the grid
 * actually renders 91 cells (13 columns × 7 rows). The window is
 * Monday-aligned: the rightmost column is the current calendar week
 * with Monday at the top, today at the row matching its weekday, and
 * future days of this week as empty/future cells below today. Earlier
 * columns are full Monday-Sunday weeks going back. Cells before
 * createdOn render as pre-creation tiles.
 *
 * Held cells use the accent color with a graduated opacity tied to
 * each cell's position within its held run; standalone held days get
 * a fixed mid opacity so they still register without faking streak
 * shape. Slipped cells use the surface fill plus a hairline divider
 * border. Pre-creation and empty/missed/future days all render as a
 * flat surface tile.
 */

const COLUMNS = 13;
const ROWS = 7;
const GAP = 2;

type Heatmap90Props = {
  logs: ReadonlyArray<HabitLog>;
  /** YYYY-MM-DD; the screen passes today and the helper derives the
   *  Monday-aligned window from it. */
  today: string;
  /** Pre-creation cells render flat. */
  createdOn: string;
};

const TODAY_RING_WIDTH = 1;

export function Heatmap90({ logs, today, createdOn }: Heatmap90Props) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const cells = useMemo(
    () => buildHeatmapCells({ logs, today, createdOn }),
    [logs, today, createdOn]
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== containerWidth) setContainerWidth(w);
  };

  // cellSize is width-driven so the grid always fills the screen
  // gutter. Until layout is measured we render at zero size, which
  // collapses the grid container to its column-by-column flex
  // structure without flashing miscalculated cells.
  const cellSize =
    containerWidth > 0 ? Math.floor((containerWidth - GAP * (COLUMNS - 1)) / COLUMNS) : 0;

  // Column-major projection: cells[i] sits at row (i % ROWS), column
  // (i / ROWS). The cells array is chronological ASC (oldest Monday
  // top-left, current week's Sunday bottom-right), which places today
  // at the row matching its weekday inside the rightmost column.
  const columns = useMemo(() => {
    const cols: HeatmapCell[][] = [];
    for (let c = 0; c < COLUMNS; c += 1) {
      const start = c * ROWS;
      cols.push(cells.slice(start, start + ROWS));
    }
    return cols;
  }, [cells]);

  return (
    <View
      onLayout={onLayout}
      style={{
        flexDirection: 'row',
        gap: GAP,
        width: '100%',
      }}
    >
      {columns.map((column, ci) => (
        <View key={ci} style={{ gap: GAP }}>
          {column.map((cell) => (
            <Cell
              key={cell.date}
              cell={cell}
              size={cellSize}
              theme={theme}
              isToday={cell.date === today}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

type ThemeShape = ReturnType<typeof useTheme>;

/**
 * A single heatmap cell. Today's cell receives an accent-ring overlay
 * regardless of status — same affordance as WeekDots' today ring, so
 * today reads at a glance even when buried mid-column.
 *
 * The ring is a same-size accent-bordered View on top of the fill
 * tile. Stacking via absoluteFill keeps the layout dimensions stable
 * (cells stay perfectly square in the grid) and avoids inset issues
 * where a borderWidth on the held tile would visibly shrink it.
 */
function Cell({
  cell,
  size,
  theme,
  isToday,
}: {
  cell: HeatmapCell;
  size: number;
  theme: ThemeShape;
  isToday: boolean;
}) {
  const baseStyle = {
    width: size,
    height: size,
    borderRadius: 2,
  } as const;

  let fill;
  if (cell.status === 'held') {
    fill = (
      <View
        style={[
          baseStyle,
          {
            backgroundColor: theme.colors.accent,
            opacity: heldCellOpacity(cell.runPosition),
          },
        ]}
      />
    );
  } else if (cell.status === 'slipped') {
    fill = (
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
  } else {
    // 'pre-creation' | 'empty' (past or future) — flat surface tile.
    fill = <View style={[baseStyle, { backgroundColor: theme.colors.surface }]} />;
  }

  if (!isToday) return fill;

  return (
    <View style={baseStyle}>
      {fill}
      <View
        style={[
          baseStyle,
          {
            position: 'absolute',
            borderWidth: TODAY_RING_WIDTH,
            borderColor: theme.colors.accent,
            backgroundColor: 'transparent',
            // RN 0.81 still accepts the legacy `pointerEvents` prop
            // but logs a deprecation. Style-side declaration is the
            // current canonical form.
            pointerEvents: 'none',
          },
        ]}
      />
    </View>
  );
}

export { HEATMAP_TOTAL_CELLS };
