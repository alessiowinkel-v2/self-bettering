import { useHeaderHeight } from '@react-navigation/elements';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Screen, Text, TextButton } from '../../components/primitives';
import {
  InteractiveMoodDots,
  JournalPrompts,
  SavedIndicator,
  TagChips,
} from '../../components/journal';
import {
  deleteJournalEntry,
  getJournalEntryForDate,
  upsertJournalEntry,
} from '../../db/journal';
import { useTodayStore } from '../../state/todayStore';
import { useTheme } from '../../theme';
import { formatWeekdayWithDate, todayIso, yesterdayIso } from '../../utils/dateFormat';
import { useDebouncedSave } from '../../utils/useDebouncedSave';
import type { Mood } from '../../state/types';

/**
 * Journal Editor. Stack route under root, reachable from Today
 * (Yesterday card and "No entry yet today." card). Phase 3c builds
 * the full editor with debounced auto-save, mood selector, inline
 * tag chips, and the two italic prompts that hide when the body
 * has content.
 *
 * Hydration is screen-local: read the row for the date param once on
 * mount, then own the draft state in the screen. The debounced save
 * hook (utils/useDebouncedSave) writes the draft back to SQLite 500ms
 * after edits stop. The screen does NOT subscribe to the store for
 * journal content — Today's slice gets refreshed via
 * refreshJournalSlice() after each successful save and on Today's
 * focus effect.
 *
 * Layout choice: Screen scroll=true (default), no KeyboardAvoidingView.
 * The body TextInput is multiline; on iOS the keyboard automatically
 * scrolls a focused input into view inside a ScrollView. If phone
 * testing finds the keyboard covering content, switch to scroll=false
 * with KeyboardAvoidingView per the add-habit modal's pattern.
 */

const STACK_OPTIONS = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
} as const;

type Draft = {
  date: string | null;
  mood: Mood | null;
  tags: ReadonlyArray<string>;
  body: string;
};

// `a.date !== b.date` can't actually fire today: the date is a route
// param and route changes remount the screen with a fresh draft. Kept
// defensively for future reuse — if this equality were ever shared
// with a draft store that mutated date in-place, the short-circuit
// would catch it before treating two different days' drafts as equal.
function shallowJournalEqual(a: Draft, b: Draft): boolean {
  if (a.date !== b.date || a.mood !== b.mood || a.body !== b.body) return false;
  if (a.tags.length !== b.tags.length) return false;
  for (let i = 0; i < a.tags.length; i += 1) {
    if (a.tags[i] !== b.tags[i]) return false;
  }
  return true;
}

export default function JournalEditorScreen() {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  // expo-router's runtime contract is string | string[] | undefined —
  // narrow before passing to the data layer so an array can never slip
  // through to SQL parameter binding.
  const date = typeof params.date === 'string' ? params.date : null;

  const [hydrated, setHydrated] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  // Bumping this re-runs the hydrate effect; "Try again." increments
  // it. Mirrors the boot retry pattern in app/_layout.tsx.
  const [hydrateAttempt, setHydrateAttempt] = useState(0);
  const [mood, setMood] = useState<Mood | null>(null);
  const [tags, setTags] = useState<ReadonlyArray<string>>([]);
  const [body, setBody] = useState('');

  useEffect(() => {
    if (date === null) {
      setHydrated(true);
      return;
    }
    // Per-run local cancel token. A shared cancelledRef is the wrong
    // shape for this effect — across a retry (hydrateAttempt bump),
    // a prior failed run's reject handler can resolve AFTER the new
    // run has already cleared hydrateError, surfacing a stale error
    // against the successful retry. Each run owns its own `cancelled`
    // closure variable instead, so the prior run's continuations are
    // guaranteed to short-circuit no matter when they resolve.
    let cancelled = false;
    setHydrateError(null);
    setHydrated(false);
    void (async () => {
      try {
        const entry = await getJournalEntryForDate(date);
        if (cancelled) return;
        if (entry !== null) {
          setMood(entry.mood);
          setTags(entry.tags);
          setBody(entry.body);
        }
        setHydrated(true);
      } catch (e) {
        // Hydrate failure is destructive if we silently flip
        // hydrated=true: the screen would render an empty editor
        // against a date that already has a row, and the first
        // debounced save would clobber the unread row via the upsert.
        // Surface the failure so the user can retry instead of
        // overwriting unseen data.
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.warn('[journal] hydrate failed:', e);
        setHydrateError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, hydrateAttempt]);

  const retryHydrate = useCallback(() => {
    setHydrateAttempt((n) => n + 1);
  }, []);

  // Compose the draft each render; equality is structural so the
  // debounced save hook only fires when content actually changes.
  const draft: Draft = useMemo(
    () => ({ date, mood, tags, body }),
    [date, mood, tags, body],
  );

  const save = useCallback(async (d: Draft) => {
    // The null-date guard is the actual protection here, not the
    // hook's `enabled` flag. `enabled: hydrated` flips true even
    // when date === null (the hydrate effect early-returns and
    // sets hydrated=true synchronously), so the hook would happily
    // schedule a save against a null date if this guard weren't
    // here. Cheap defense-in-depth before any DB call.
    if (d.date === null) return;
    // Editor policy: an entry with no mood, no tags, and a blank body
    // shouldn't leave a row on disk. If the user opens a fresh date
    // and types nothing, no row is created (delete is idempotent).
    // If the user opens an existing entry and clears every field, the
    // row is deleted so the future Journal List doesn't render a
    // ghost preview. Either way, the hook's success path advances
    // persistedRef to the empty snapshot and the SAVED indicator
    // transitions to 'saved' — reading honestly as "nothing to save."
    const isEmpty =
      d.mood === null && d.tags.length === 0 && d.body.trim() === '';
    const today = todayIso();
    const yesterday = yesterdayIso();
    if (isEmpty) {
      await deleteJournalEntry(d.date);
    } else {
      await upsertJournalEntry({
        date: d.date,
        mood: d.mood,
        tags: d.tags,
        body: d.body,
      });
    }
    // Save-time refresh is the fast path: today's screen sees the new
    // entry immediately on next render. The focus-effect on Today is
    // the safety net for the unmount-flush path. Refresh runs for
    // both the upsert and delete branches so a clear-then-leave
    // updates Today's NoJournalYet card right away.
    if (d.date === today || d.date === yesterday) {
      await useTodayStore.getState().refreshJournalSlice();
    }
  }, []);

  // `enabled: hydrated` keeps the hook from firing a spurious save
  // when async hydration replaces the empty initial draft with the
  // loaded values. Pre-enable, the hook continually rebases its
  // persistedRef to the current draft; first edit after hydrate
  // triggers the first real save.
  const { status, errorMessage } = useDebouncedSave<Draft>({
    draft,
    isEqual: shallowJournalEqual,
    save,
    enabled: hydrated,
  });

  const wordCount = useMemo(() => {
    const trimmed = body.trim();
    if (trimmed.length === 0) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [body]);

  // Pad the top of the body so the title clears the system back
  // chevron under headerTransparent. Mirrors habit detail's pattern.
  const titleTopPad = useMemo(
    () => headerHeight + theme.spacing[3],
    [headerHeight, theme.spacing],
  );

  if (hydrateError !== null) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={STACK_OPTIONS} />
        <View
          style={{
            marginTop: titleTopPad,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="displayItalic" align="center">
            Could not load entry.
          </Text>
          <Text
            variant="body"
            tone="tertiary"
            align="center"
            numberOfLines={4}
            style={{ marginTop: theme.spacing[3] }}
          >
            {hydrateError}
          </Text>
          <View style={{ marginTop: theme.spacing[5] }}>
            <TextButton
              label="Try again"
              onPress={retryHydrate}
              accessibilityLabel="Try again"
            />
          </View>
        </View>
      </Screen>
    );
  }

  if (!hydrated) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={STACK_OPTIONS} />
      </Screen>
    );
  }

  if (date === null) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={STACK_OPTIONS} />
        <View style={{ marginTop: titleTopPad }}>
          <Text variant="displayItalic" tone="secondary">
            Entry not found.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={STACK_OPTIONS} />

      <View
        style={{
          position: 'absolute',
          top: titleTopPad,
          right: theme.spacing[5],
          alignItems: 'flex-end',
        }}
      >
        <SavedIndicator status={status} errorMessage={errorMessage} />
      </View>

      <View style={{ marginTop: titleTopPad }}>
        <Text variant="display">{formatWeekdayWithDate(date)}</Text>
      </View>

      <View
        style={{
          marginTop: theme.spacing[4],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[4],
          flexWrap: 'wrap',
        }}
      >
        <InteractiveMoodDots mood={mood} onChange={setMood} />
        <TagChips tags={tags} onChange={setTags} />
      </View>

      {body.length === 0 ? (
        <View style={{ marginTop: theme.spacing[6] }}>
          <JournalPrompts />
        </View>
      ) : null}

      <TextInput
        multiline
        value={body}
        onChangeText={setBody}
        placeholderTextColor={theme.colors.textTertiary}
        accessibilityLabel="Journal entry"
        style={[
          theme.type.body,
          {
            color: theme.colors.textPrimary,
            marginTop: theme.spacing[5],
            minHeight: 200,
            textAlignVertical: 'top',
          },
        ]}
      />

      {wordCount > 0 ? (
        <Text
          variant="label"
          tone="tertiary"
          style={{ marginTop: theme.spacing[5] }}
        >
          {wordCount === 1 ? '1 WORD' : `${wordCount} WORDS`}
        </Text>
      ) : null}
    </Screen>
  );
}
