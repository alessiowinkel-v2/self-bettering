import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Text, TextButton } from '../primitives';
import { formatRest } from '../../utils/workout';

type RestTimerProps = {
  /** Seconds left on the rest. Caller computes from restEndsAt - now. */
  remainingSeconds: number;
  onSkip: () => void;
};

/**
 * Bottom-sheet countdown — PDF page 16.
 *
 *   REST   1:12                                       Skip
 *
 * Dim surface, full-width banner. Caller positions it absolutely at
 * the bottom of the workout screen. The countdown text is Fraunces;
 * "REST" is small-caps Inter; "Skip" is an amber TextButton.
 *
 * The component is presentational — it doesn't tick. The parent
 * computes `remainingSeconds` from `restEndsAt - now` and re-renders
 * once per second.
 */
export function RestTimer({ remainingSeconds, onSkip }: RestTimerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Banner sits flush to the physical bottom; absorb the home-indicator
  // inset into its own paddingBottom so the surface paints under the
  // indicator while the countdown stays clear of it.
  const bannerBottom = Math.max(insets.bottom + theme.spacing[2], theme.spacing[5]);
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[3],
        paddingBottom: bannerBottom,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'column', gap: theme.spacing[1] }}>
        <Text variant="label" tone="tertiary">
          REST
        </Text>
        <Text variant="display">{formatRest(remainingSeconds)}</Text>
      </View>
      <TextButton
        label="Skip"
        onPress={onSkip}
        accessibilityLabel="Skip rest"
      />
    </View>
  );
}
