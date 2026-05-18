import { format, parseISO } from 'date-fns';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { ListRow, Text } from '../primitives';
import { useTheme } from '../../theme';
import type { Theme } from '../../theme';
import {
  restsForSession,
  topSet,
  type ExerciseSession,
} from '../../utils/exerciseHistory';
import { formatKg, formatLastSetsLine, formatRest } from '../../utils/workout';
import { PrPill } from './PrPill';

/**
 * One session row in the Exercise History list.
 *
 * Collapsed: weekday + date on the left; top-set weight, an inline PR
 * pill when the session set a record, and an expand chevron on the
 * right.
 *
 * Expanded: the full set list ("82.5kg × 6, 6, 5, 4") and a RESTS block
 * — one line per set, rest time in tabular numerals, an em-dash for the
 * last set, which has no rest after it.
 *
 * The expand toggle is local to the row, so opening one row never
 * re-renders the screen or its siblings.
 */

type SessionRowProps = {
  session: ExerciseSession;
  /** Zero-based index within the parent ListGroup. */
  index: number;
  /** Session set a top-set record — render the inline PR pill. */
  isPR: boolean;
  /** Start expanded. The default-state frame opens its most recent row. */
  defaultExpanded?: boolean;
};

export function SessionRow({
  session,
  index,
  isPR,
  defaultExpanded = false,
}: SessionRowProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const dateLabel = format(parseISO(session.date), 'EEE, MMM d');
  const ts = topSet(session.sets);
  const weightLabel = ts !== null ? `${formatKg(ts.kg) ?? ts.kg}kg` : '—';

  return (
    <ListRow
      index={index}
      onPress={() => setExpanded((e) => !e)}
      accessibilityLabel={
        `${dateLabel}, top set ${weightLabel}` +
        `${isPR ? ', personal record' : ''}. ` +
        `${expanded ? 'Collapse' : 'Expand'}.`
      }
      left={<Text variant="body">{dateLabel}</Text>}
      right={
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}
        >
          {ts !== null ? (
            <Text variant="body" tone="secondary">
              {formatKg(ts.kg) ?? ts.kg}
              <Text variant="caption" tone="tertiary">
                kg
              </Text>
            </Text>
          ) : (
            <Text variant="body" tone="secondary">
              —
            </Text>
          )}
          {isPR ? <PrPill /> : null}
          {/* Chevron points down when collapsed, up when expanded. */}
          <View
            style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
          >
            <ChevronDown
              size={16}
              color={theme.colors.textTertiary}
              strokeWidth={1.5}
            />
          </View>
        </View>
      }
      below={
        expanded ? (
          <SessionExpansion session={session} theme={theme} />
        ) : undefined
      }
    />
  );
}

function SessionExpansion({
  session,
  theme,
}: {
  session: ExerciseSession;
  theme: Theme;
}) {
  const rests = restsForSession(session.sets);
  const setLine = formatLastSetsLine(session.sets) ?? '';

  return (
    <View>
      <Text variant="body" tone="secondary">
        {setLine}
      </Text>
      <View style={{ marginTop: theme.spacing[3] }}>
        <Text
          variant="label"
          tone="tertiary"
          style={{ marginBottom: theme.spacing[2] }}
        >
          RESTS
        </Text>
        {rests.map((rest) => (
          <View
            key={rest.setNumber}
            style={{ flexDirection: 'row', paddingVertical: 2 }}
          >
            <Text variant="caption" tone="tertiary" style={{ width: 48 }}>
              set {rest.setNumber}
            </Text>
            <Text
              variant="caption"
              tone="secondary"
              style={{
                minWidth: 44,
                textAlign: 'right',
                fontVariant: ['tabular-nums'],
              }}
            >
              {rest.restSeconds === null ? '—' : formatRest(rest.restSeconds)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
