import { Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import {
  getAllExercises,
  getRecentExercises,
  type CatalogExercise,
} from '../../db/exercises';
import { todayIso, formatExerciseLastUsed } from '../../utils/dateFormat';
import { haptics } from '../../utils/haptics';
import { Text } from '../primitives';

/**
 * ExercisePicker — full-height modal sheet for choosing or adding an
 * exercise.
 *
 * Two modes:
 *   mode='pick'  — invoked from Add/Edit Routine. Eyebrow "PICK EXERCISE",
 *                  no swap-context line.
 *   mode='swap'  — invoked from the mid-workout swap flow. Eyebrow
 *                  "SWAP EXERCISE", and if `swappingFrom` is non-null
 *                  the "Replacing {name}." line shows above the search
 *                  field, with a "{N} sets logged so far are kept."
 *                  subline when `loggedSetsCount` > 0. In swap mode the
 *                  row matching the current name renders greyed with an
 *                  italic "current" label on the right where the date
 *                  would be.
 *
 * Selection: tap a row → onPick fires synchronously with the chosen
 * name, then the picker calls onClose so the parent doesn't need to
 * flip `visible` from inside onPick. The parent's onPick handler
 * receives the name and updates its own state; onClose flips visible.
 *
 * Add-new path: if the trimmed query has no case-insensitive exact match
 * in the loaded catalog, a two-line "Add {query} as new." entry renders
 * at the top of the results. Tapping it picks the query verbatim
 * (trimmed) — onPick downstream is responsible for any normalization.
 */

export type ExercisePickerMode = 'pick' | 'swap';

type ExercisePickerProps = {
  visible: boolean;
  mode: ExercisePickerMode;
  /**
   * In swap mode, the name being replaced. Renders the "Replacing
   * {name}." line and greys the matching row in the list. Pass null in
   * pick mode (or simply omit).
   */
  swappingFrom?: string | null;
  /**
   * In swap mode, how many sets are already logged for `swappingFrom`
   * in the current workout. When > 0 the picker renders a subline
   * reassuring the user those sets are kept. Ignored in pick mode.
   */
  loggedSetsCount?: number;
  onPick: (name: string) => void;
  onClose: () => void;
};

const RECENT_LIMIT = 6;

export function ExercisePicker({
  visible,
  mode,
  swappingFrom,
  loggedSetsCount,
  onPick,
  onClose,
}: ExercisePickerProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<ReadonlyArray<CatalogExercise>>([]);
  const [all, setAll] = useState<ReadonlyArray<CatalogExercise>>([]);
  const [loading, setLoading] = useState(true);
  // Snapshot today on each open so a long-lived picker session doesn't
  // drift past midnight without refreshing its right-column labels.
  const [today, setToday] = useState(() => todayIso());

  // Hydrate on each open. The picker is short-lived enough that we don't
  // bother memoizing across opens — between sessions a new exercise may
  // have been logged elsewhere and the recency ordering can shift.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setQuery('');
    setToday(todayIso());
    void Promise.all([getRecentExercises(RECENT_LIMIT), getAllExercises()])
      .then(([r, a]) => {
        if (cancelled) return;
        setRecent(r);
        setAll(a);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRecent([]);
        setAll([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const trimmedQuery = query.trim();
  const lcQuery = trimmedQuery.toLowerCase();
  const isFirstUse = !loading && all.length === 0;

  const exactMatch = useMemo(
    () => all.some((e) => e.name.toLowerCase() === lcQuery),
    [all, lcQuery]
  );

  const filteredRecent = useMemo(
    () =>
      lcQuery.length === 0
        ? recent
        : recent.filter((e) => e.name.toLowerCase().includes(lcQuery)),
    [recent, lcQuery]
  );

  const filteredAll = useMemo(
    () =>
      lcQuery.length === 0
        ? all
        : all.filter((e) => e.name.toLowerCase().includes(lcQuery)),
    [all, lcQuery]
  );

  // Flatten into a single typed list for FlatList. Each row carries the
  // kind discriminator so renderItem stays a switch — no nested
  // SectionList contortions for this small dataset.
  type Row =
    | { kind: 'add-new'; query: string }
    | { kind: 'section'; label: string; caption: string }
    | { kind: 'exercise'; section: 'recent' | 'all'; exercise: CatalogExercise }
    | { kind: 'empty-first-use' };

  const rows = useMemo<ReadonlyArray<Row>>(() => {
    if (loading) return [];
    if (isFirstUse) {
      if (trimmedQuery.length === 0) {
        return [{ kind: 'empty-first-use' }];
      }
      return [{ kind: 'add-new', query: trimmedQuery }];
    }
    const list: Row[] = [];
    if (trimmedQuery.length > 0 && !exactMatch) {
      list.push({ kind: 'add-new', query: trimmedQuery });
    }
    if (filteredRecent.length > 0) {
      list.push({
        kind: 'section',
        label: 'Recent',
        caption: 'From your last few workouts.',
      });
      for (const e of filteredRecent)
        list.push({ kind: 'exercise', section: 'recent', exercise: e });
    }
    if (filteredAll.length > 0) {
      list.push({
        kind: 'section',
        label: 'All',
        caption: "Everything you've logged.",
      });
      for (const e of filteredAll)
        list.push({ kind: 'exercise', section: 'all', exercise: e });
    }
    return list;
  }, [
    loading,
    isFirstUse,
    trimmedQuery,
    exactMatch,
    filteredRecent,
    filteredAll,
  ]);

  function pickAndClose(name: string) {
    haptics.light();
    onPick(name);
    onClose();
  }

  const placeholder =
    isFirstUse && trimmedQuery.length === 0
      ? 'Type an exercise.'
      : 'Find or add an exercise.';

  const eyebrow = mode === 'swap' ? 'SWAP EXERCISE' : 'PICK EXERCISE';

  function renderItem({ item }: ListRenderItemInfo<Row>) {
    switch (item.kind) {
      case 'empty-first-use':
        return (
          <View style={{ paddingVertical: theme.spacing[5] }}>
            <Text variant="bodyItalicFraunces" tone="secondary">
              No exercises yet.
            </Text>
            <Text
              variant="caption"
              tone="tertiary"
              style={{ marginTop: theme.spacing[2] }}
            >
              {'Type one to begin. They’ll live here after.'}
            </Text>
          </View>
        );
      case 'add-new':
        return (
          <Pressable
            onPress={() => pickAndClose(item.query)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.query} as a new exercise`}
            style={({ pressed }) => [
              {
                paddingVertical: theme.spacing[3],
                minHeight: theme.touchTarget.minHeight,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text variant="bodyItalicFraunces" tone="accent">
              {`Add “${item.query}” as new.`}
            </Text>
            <Text
              variant="caption"
              tone="tertiary"
              style={{ marginTop: theme.spacing[1] }}
            >
              {'It’ll show up here next time.'}
            </Text>
          </Pressable>
        );
      case 'section':
        return (
          <View
            style={{
              marginTop: theme.spacing[5],
              marginBottom: theme.spacing[2],
            }}
          >
            <Text variant="heading" tone="primary">
              {item.label}
            </Text>
            <Text
              variant="caption"
              tone="tertiary"
              style={{ marginTop: theme.spacing[1] }}
            >
              {item.caption}
            </Text>
          </View>
        );
      case 'exercise': {
        const isCurrent =
          mode === 'swap' &&
          swappingFrom !== null &&
          swappingFrom !== undefined &&
          item.exercise.name.toLowerCase() === swappingFrom.toLowerCase();
        return (
          <Pressable
            disabled={isCurrent}
            onPress={() => pickAndClose(item.exercise.name)}
            accessibilityRole="button"
            accessibilityLabel={`Pick ${item.exercise.name}`}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: theme.spacing[3],
                minHeight: theme.touchTarget.minHeight,
                gap: theme.spacing[3],
              },
              pressed && !isCurrent && { opacity: 0.7 },
              isCurrent && { opacity: 0.5 },
            ]}
          >
            <HighlightedName
              name={item.exercise.name}
              query={lcQuery}
              dimmed={isCurrent}
            />
            {isCurrent ? (
              <Text variant="bodyItalicFraunces" tone="tertiary">
                current
              </Text>
            ) : (
              <Text
                variant="caption"
                tone="tertiary"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatExerciseLastUsed({
                  fromIso: item.exercise.lastUsedAt.slice(0, 10),
                  todayIso: today,
                })}
              </Text>
            )}
          </Pressable>
        );
      }
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        edges={['top', 'bottom']}
      >
        {/* pageSheet renders its own grabber on iOS — we don't draw one. */}
        <View
          style={{
            paddingHorizontal: theme.spacing[5],
            paddingTop: theme.spacing[4],
          }}
        >
          <Text variant="label" tone="secondary">
            {eyebrow}
          </Text>
          <Text variant="display" style={{ marginTop: theme.spacing[2] }}>
            Exercise.
          </Text>
          {mode === 'swap' && swappingFrom ? (
            <Text
              variant="bodyItalicFraunces"
              tone="secondary"
              style={{ marginTop: theme.spacing[2] }}
            >
              Replacing <Text variant="bodyMedium">{swappingFrom}</Text>.
            </Text>
          ) : null}
          {/* Reassurance subline — mirrors the "End workout." Alert's
              "Sets logged so far are kept." in the same voice. Only in
              swap mode, only when the outgoing exercise has logged
              sets. */}
          {mode === 'swap' && (loggedSetsCount ?? 0) > 0 ? (
            <Text
              variant="bodyItalicFraunces"
              tone="secondary"
              style={{ marginTop: theme.spacing[1] }}
            >
              {loggedSetsCount === 1
                ? '1 set logged so far is kept.'
                : `${loggedSetsCount} sets logged so far are kept.`}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing[2],
              marginTop: theme.spacing[4],
              paddingHorizontal: theme.spacing[3],
              paddingVertical: theme.spacing[2],
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.md,
            }}
          >
            <Search size={18} color={theme.colors.textTertiary} strokeWidth={1.5} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
              placeholderTextColor={theme.colors.textTertiary}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="done"
              style={[
                theme.type.body,
                {
                  flex: 1,
                  color: theme.colors.textPrimary,
                  paddingVertical: theme.spacing[1],
                },
              ]}
            />
          </View>
        </View>

        {loading ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator color={theme.colors.textTertiary} />
          </View>
        ) : (
          <FlatList
            data={rows as Row[]}
            keyExtractor={(item) => {
              // Section-scoped: an exercise that appears in BOTH Recent
              // and All (the common case — Recent is recency, All is
              // full history) must yield two distinct keys.
              if (item.kind === 'exercise')
                return `${item.section}-${item.exercise.name}`;
              if (item.kind === 'section') return `header-${item.label}`;
              if (item.kind === 'add-new') return 'add-new';
              return 'empty-first-use';
            }}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: theme.spacing[5],
              paddingBottom: theme.spacing[8],
              paddingTop: theme.spacing[3],
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

type HighlightedNameProps = {
  name: string;
  query: string;
  dimmed: boolean;
};

/**
 * Splits `name` around the lowercase `query` substring and renders the
 * matching span with an accent-soft background highlight. Empty query
 * renders the name verbatim. Case-insensitive match.
 */
function HighlightedName({ name, query, dimmed }: HighlightedNameProps) {
  const theme = useTheme();
  const tone = dimmed ? 'tertiary' : 'primary';
  if (query.length === 0) {
    return <Text variant="body" tone={tone}>{name}</Text>;
  }
  const idx = name.toLowerCase().indexOf(query);
  if (idx === -1) {
    return <Text variant="body" tone={tone}>{name}</Text>;
  }
  const before = name.slice(0, idx);
  const match = name.slice(idx, idx + query.length);
  const after = name.slice(idx + query.length);
  return (
    <Text variant="body" tone={tone}>
      {before}
      <Text
        variant="body"
        tone={tone}
        style={{ backgroundColor: theme.colors.surfaceElev }}
      >
        {match}
      </Text>
      {after}
    </Text>
  );
}
