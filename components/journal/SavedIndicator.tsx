import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../primitives';
import type { SaveStatus } from '../../utils/useDebouncedSave';

type SavedIndicatorProps = {
  status: SaveStatus;
  errorMessage: string | null;
};

/**
 * The "SAVED" indicator that sits top-right of the Journal Editor.
 *
 * Dot rendering:
 * - 'idle' or 'saved' -> filled accent dot (the persisted state).
 * - 'pending' or 'error' -> hollow ring (work outstanding or failed).
 *
 * Error caption ("Could not save.") renders directly below the SAVED
 * row in caption tertiary, only in the error state. The caption clears
 * automatically the moment the user edits again because the debounced
 * save hook re-enters 'pending' and the screen reads
 * errorMessage === null.
 */
export function SavedIndicator({ status, errorMessage }: SavedIndicatorProps) {
  const theme = useTheme();

  const filled = status === 'idle' || status === 'saved';
  const dotSize = 6;

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[2],
        }}
      >
        <Text variant="label" tone="tertiary">
          SAVED
        </Text>
        <View
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: filled ? theme.colors.accent : 'transparent',
            borderWidth: filled ? 0 : 1,
            borderColor: theme.colors.textTertiary,
          }}
        />
      </View>
      {status === 'error' && errorMessage !== null ? (
        <Text
          variant="caption"
          tone="tertiary"
          style={{ marginTop: theme.spacing[1] }}
        >
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}
