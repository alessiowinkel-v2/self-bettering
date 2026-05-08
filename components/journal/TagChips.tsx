import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../primitives';

type TagChipsProps = {
  tags: ReadonlyArray<string>;
  onChange: (next: ReadonlyArray<string>) => void;
};

/**
 * Inline tag chips for the journal editor.
 *
 * UX rules from the approved plan:
 * - Tap a chip to delete it. No x icon, no long-press, no confirm.
 * - The trailing "+ tag" affordance is a quiet text link (Inter caption,
 *   tone tertiary, NOT italic — Inter has no italic cut). Tapping it
 *   replaces the affordance with an inline TextInput styled identically
 *   to a chip so the row's rhythm holds.
 * - On submit or blur: trim. If the trimmed value is non-empty AND not
 *   already present (case-insensitive), append. Preserve the user's
 *   casing as typed. Empty submit/blur exits adding mode without
 *   modifying tags.
 *
 * iOS fires onSubmitEditing AND onBlur on a single Done-tap. Both are
 * wired to commit() because either path can land first depending on
 * input type and OS version, and the user wants the input to commit on
 * either gesture. committedRef short-circuits the second invocation
 * inside the same edit cycle. We can't read `adding` directly from the
 * second handler — it is closure-captured at handler-bind time, so even
 * after the first commit calls setAdding(false), the second call still
 * sees adding === true through its captured value.
 */
export function TagChips({ tags, onChange }: TagChipsProps) {
  const theme = useTheme();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const committedRef = useRef(false);

  function commit() {
    if (committedRef.current) return;
    committedRef.current = true;
    const next = draft.trim();
    setDraft('');
    setAdding(false);
    if (next === '') return;
    const exists = tags.some((t) => t.toLowerCase() === next.toLowerCase());
    if (exists) return;
    onChange([...tags, next]);
  }

  function startAdding() {
    // Reset the guard in the same branch that flips into adding mode,
    // so the next commit cycle starts clean. Do this before
    // setAdding(true) so a synchronous re-render can't observe the
    // ref still set from the prior cycle.
    committedRef.current = false;
    setAdding(true);
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  const chipPaddingH = theme.spacing[3];
  const chipPaddingV = theme.spacing[1];

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.spacing[2],
      }}
    >
      {tags.map((tag) => (
        <Pressable
          key={tag}
          onPress={() => removeTag(tag)}
          accessibilityRole="button"
          accessibilityLabel={`Remove tag ${tag}`}
          hitSlop={6}
          style={{
            paddingHorizontal: chipPaddingH,
            paddingVertical: chipPaddingV,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surfaceElev,
          }}
        >
          <Text variant="caption" tone="secondary">
            {tag}
          </Text>
        </Pressable>
      ))}

      {adding ? (
        <View
          style={{
            paddingHorizontal: chipPaddingH,
            paddingVertical: chipPaddingV,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surfaceElev,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={commit}
            onBlur={commit}
            autoFocus
            returnKeyType="done"
            placeholderTextColor={theme.colors.textTertiary}
            style={[
              theme.type.caption,
              {
                color: theme.colors.textPrimary,
                minWidth: 40,
                padding: 0,
              },
            ]}
          />
        </View>
      ) : (
        <Pressable
          onPress={startAdding}
          accessibilityRole="button"
          accessibilityLabel="Add tag"
          hitSlop={6}
        >
          <Text variant="caption" tone="tertiary">
            + tag
          </Text>
        </Pressable>
      )}
    </View>
  );
}
