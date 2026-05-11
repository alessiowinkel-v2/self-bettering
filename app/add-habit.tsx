import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  TextInput,
  View,
} from 'react-native';
import {
  FilledButton,
  Screen,
  Text,
  TextButton,
} from '../components/primitives';
import { useHabitsListStore } from '../state/habitsListStore';
import { useTheme } from '../theme';

/**
 * Add-habit modal. Presented from the Habits tab via `+ Add habit`.
 *
 * Voice rules: the placeholder reads "Habit name." (period, no
 * exclamation). The primary action is the only filled button on the
 * screen — Add — because this modal exists to take a single action
 * (per the design system's filled-button rule). Cancel is a quiet
 * text affordance top-right.
 */
export default function AddHabitModal() {
  const theme = useTheme();
  const router = useRouter();
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const canSubmit = trimmed !== '' && !submitting;

  async function submit() {
    if (trimmed === '' || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await useHabitsListStore.getState().create(trimmed);
      router.back();
    } catch (e) {
      // Voice-aligned fixed copy. Raw error to console for debug.
      // eslint-disable-next-line no-console
      console.warn('[add-habit] create failed:', e);
      setError('Could not add.');
      setSubmitting(false);
    }
  }

  function handleChangeText(next: string) {
    setValue(next);
    // Clear any stale error the moment the user edits — never leave
    // it stuck on screen across attempts.
    if (error !== null) setError(null);
  }

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing[3],
          }}
        >
          <Text variant="display">New habit.</Text>
          <TextButton
            label="Cancel"
            tone="secondary"
            onPress={() => router.back()}
            accessibilityLabel="Cancel"
          />
        </View>

        <TextInput
          value={value}
          onChangeText={handleChangeText}
          placeholder="Habit name"
          placeholderTextColor={theme.colors.textTertiary}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          style={[
            theme.type.body,
            {
              color: theme.colors.textPrimary,
              paddingVertical: theme.spacing[3],
              marginTop: theme.spacing[6],
            },
          ]}
        />

        {error !== null ? (
          <Text
            variant="caption"
            tone="tertiary"
            style={{ marginTop: theme.spacing[2] }}
          >
            {error}
          </Text>
        ) : null}

        <View
          style={{
            marginTop: 'auto',
            paddingBottom: theme.spacing[6],
          }}
        >
          <FilledButton
            label="Add"
            onPress={submit}
            disabled={!canSubmit}
            accessibilityLabel="Add habit"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
