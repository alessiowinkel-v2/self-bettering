import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import type { Mood } from '../../state/types';

type InteractiveMoodDotsProps = {
  mood: Mood | null;
  onChange: (next: Mood | null) => void;
};

const ALL_DOTS: ReadonlyArray<Mood> = [1, 2, 3, 4, 5];

const DOT_SIZE = 12;

/**
 * Editor-side mood selector. Separate from the read-only MoodDots in
 * components/today: that one returns null when mood is null; this one
 * must always render five tappable dots so the user can set or clear
 * a value.
 *
 * Tap behavior:
 * - Tap dot N where mood !== N -> onChange(N) (sets the rating).
 * - Tap dot N where mood === N -> onChange(null) (clears the rating).
 *
 * Visual: filled-up-to-and-including N in accent; the rest hollow rings.
 *
 * Each dot's Pressable extends its hit-target to ~44pt via hitSlop so
 * fingers don't need to land on the 12px circle.
 */
export function InteractiveMoodDots({ mood, onChange }: InteractiveMoodDotsProps) {
  const theme = useTheme();
  const fillThreshold = mood ?? 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing[3],
        alignItems: 'center',
      }}
    >
      {ALL_DOTS.map((n) => {
        const filled = n <= fillThreshold;
        const handlePress = () => {
          if (mood === n) {
            onChange(null);
          } else {
            onChange(n);
          }
        };
        return (
          <Pressable
            key={n}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel={`Mood ${n} of 5`}
            accessibilityState={{ selected: filled }}
            hitSlop={16}
          >
            <View
              style={{
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: DOT_SIZE / 2,
                backgroundColor: filled ? theme.colors.accent : 'transparent',
                borderWidth: filled ? 0 : 1,
                borderColor: theme.colors.textTertiary,
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
