import { format, parseISO } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListGroup, Text } from '../../components/primitives';
import { PrRow, SessionRow, TopSetChart } from '../../components/exercise';
import { useTheme } from '../../theme';
import { getSessionRowsForExercise } from '../../db/exercises';
import {
  chartPoints,
  prsByRep,
  prSessionIds,
  sessionsByWorkout,
  shouldShowChart,
  shouldShowPrRow,
  topSet,
  type ExerciseSetRow,
} from '../../utils/exerciseHistory';
import { formatExerciseLastUsed, todayIso } from '../../utils/dateFormat';
import { formatKg } from '../../utils/workout';

/**
 * Exercise History — per-exercise top-set progress, PRs, and a
 * reverse-chronological session list.
 *
 * Reads the set log via getSessionRowsForExercise and runs it through
 * the pure derivation layer in utils/exerciseHistory.ts. The exercise
 * name is the route's `[name]` segment, URL-decoded — exercise names
 * carry spaces.
 *
 * The query is a local SQLite read, near-instant. The loader renders
 * the title immediately and slots the rest in when rows resolve, so
 * there is no skeleton — just a one-frame gap below the title.
 *
 * The Active Workout entry point is wired in a later step; for now the
 * route is reached by navigating to /exercise/{name} directly.
 */

type LoadState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'ready'; rows: ReadonlyArray<ExerciseSetRow> };

/**
 * Decode the `[name]` route segment. expo-router hands params as
 * string | string[] | undefined; a malformed percent-escape falls back
 * to the raw segment rather than throwing out of the param read.
 */
function decodeName(raw: string | string[] | undefined): string {
  const value =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw) && raw.length > 0
        ? raw[0]
        : '';
  if (value.length === 0) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Reshape the flat set rows into everything the screen renders. Pure —
 * the same call the mock-backed step-3 build used, now fed by SQLite.
 * Assumes `rows` is non-empty (the 'ready' branch guarantees it).
 */
function buildViewModel(rows: ReadonlyArray<ExerciseSetRow>) {
  const today = todayIso();
  const sessions = sessionsByWorkout(rows);
  const latest = sessions[0];
  const oldest = sessions[sessions.length - 1];
  return {
    today,
    sessions,
    latest,
    oldest,
    latestTopSet: topSet(latest.sets),
    points: chartPoints(sessions),
    prIds: prSessionIds(sessions),
    showChart: shouldShowChart(sessions),
    showPrRow: shouldShowPrRow(sessions),
    fiveRepPr: prsByRep(sessions, 5),
    eightRepPr: prsByRep(sessions, 8),
  };
}

export default function ExerciseHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string | string[] }>();

  const exerciseName = useMemo(() => decodeName(params.name), [params.name]);

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  // Guards setState against a resolve that lands after the screen has
  // unmounted or the name changed — same pattern as Habit Detail.
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setState({ kind: 'loading' });
    void (async () => {
      try {
        const rows =
          exerciseName.length > 0
            ? await getSessionRowsForExercise(exerciseName)
            : [];
        if (cancelledRef.current) return;
        setState(
          rows.length === 0 ? { kind: 'empty' } : { kind: 'ready', rows }
        );
      } catch {
        // A failed local read degrades to the empty state rather than
        // crashing the screen. SQLite errors here are near-impossible
        // post-migration; this is the floor, not an expected path.
        if (!cancelledRef.current) setState({ kind: 'empty' });
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, [exerciseName]);

  const vm = useMemo(
    () => (state.kind === 'ready' ? buildViewModel(state.rows) : null),
    [state]
  );

  // Breadcrumb eyebrow — centered in the header bar, on the back-chevron
  // row. Blank while loading; falls back to a bare "EXERCISE" when there
  // is no routine name (or no sessions at all).
  let breadcrumb = ' ';
  if (state.kind === 'empty') {
    breadcrumb = 'EXERCISE';
  } else if (vm !== null) {
    breadcrumb = vm.latest.templateName
      ? `${vm.latest.templateName} · ${formatExerciseLastUsed({
          fromIso: vm.latest.date,
          todayIso: vm.today,
        })}`.toUpperCase()
      : 'EXERCISE';
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      edges={['top']}
    >
      {/* Header bar — back chevron pinned left, breadcrumb eyebrow
          centered on the same row. The chevron is absolute so the
          eyebrow sits on the true horizontal midline. */}
      <View
        style={{
          paddingHorizontal: theme.spacing[5],
          paddingVertical: theme.spacing[3],
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [
            {
              position: 'absolute',
              left: theme.spacing[5],
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            },
            pressed && { opacity: 0.6 },
          ]}
        >
          <ChevronLeft
            size={24}
            color={theme.colors.textSecondary}
            strokeWidth={1.5}
          />
        </Pressable>
        <Text variant="label" tone="secondary">
          {breadcrumb}
        </Text>
      </View>

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
          {exerciseName}
        </Text>

        {state.kind === 'empty' ? (
          <Text
            variant="bodyItalicFraunces"
            tone="secondary"
            style={{ marginTop: theme.spacing[2] }}
          >
            No sessions yet.
          </Text>
        ) : null}

        {vm !== null ? (
          <ExerciseHistoryContent vm={vm} theme={theme} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The populated body — subtitle, top set, chart, PR row, and history.
 * Mounted only once rows have resolved into a view model.
 */
function ExerciseHistoryContent({
  vm,
  theme,
}: {
  vm: NonNullable<ReturnType<typeof buildViewModel>>;
  theme: ReturnType<typeof useTheme>;
}) {
  const relativeLatest = formatExerciseLastUsed({
    fromIso: vm.latest.date,
    todayIso: vm.today,
  });
  const isFirstSession = vm.sessions.length === 1;
  const subtitle = isFirstSession
    ? 'First session.'
    : `${vm.sessions.length} sessions since ${format(parseISO(vm.oldest.date), 'MMM')}.`;

  const ts = vm.latestTopSet;

  return (
    <>
      <Text
        variant="bodyItalicFraunces"
        tone="secondary"
        style={{ marginTop: theme.spacing[2] }}
      >
        {subtitle}
      </Text>

      {/* TOP SET — hidden in the single-session state, per spec. The kg
          unit and the relative-date tail render quieter than the value. */}
      {!isFirstSession ? (
        <View style={{ marginTop: theme.spacing[7] }}>
          <Text
            variant="label"
            tone="secondary"
            style={{ marginBottom: theme.spacing[2] }}
          >
            TOP SET
          </Text>
          {ts !== null ? (
            <Text variant="body">
              {formatKg(ts.kg) ?? ts.kg}
              <Text variant="caption" tone="secondary">
                kg
              </Text>
              {` × ${ts.reps ?? '—'} `}
              <Text variant="caption" tone="secondary">
                {`· ${relativeLatest}`}
              </Text>
            </Text>
          ) : (
            <Text variant="body">—</Text>
          )}
        </View>
      ) : null}

      {vm.showChart ? (
        <View style={{ marginTop: theme.spacing[6] }}>
          <TopSetChart points={vm.points} />
        </View>
      ) : null}

      {vm.showPrRow ? (
        <View style={{ marginTop: theme.spacing[6] }}>
          <PrRow fiveRep={vm.fiveRepPr} eightRep={vm.eightRepPr} />
        </View>
      ) : null}

      <View style={{ marginTop: theme.spacing[7] }}>
        <Text
          variant="label"
          tone="secondary"
          style={{ marginBottom: theme.spacing[3] }}
        >
          HISTORY
        </Text>
        <ListGroup>
          {vm.sessions.map((session, index) => (
            <SessionRow
              key={session.workoutId}
              session={session}
              index={index}
              isPR={vm.prIds.has(session.workoutId)}
              defaultExpanded={index === 0 && vm.showPrRow}
            />
          ))}
        </ListGroup>
        {isFirstSession ? (
          <Text
            variant="bodyItalicFraunces"
            tone="tertiary"
            style={{ marginTop: theme.spacing[4] }}
          >
            More sessions, more shape.
          </Text>
        ) : null}
      </View>
    </>
  );
}
