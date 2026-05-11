import { View } from 'react-native';
import { useTheme } from '../../theme';
import type { Mood } from '../../state/types';

type MoodDotsProps = {
  /**
   * 1 to 5 rating. Dots 1..mood are filled in amber, dots (mood+1)..5
   * are unfilled (hollow). null hides the row entirely.
   */
  mood: Mood | null;
  /** Diameter in pixels. Defaults to 8. */
  size?: number;
};

const ALL_DOTS: ReadonlyArray<Mood> = [1, 2, 3, 4, 5];

/**
 * Five-dot mood row used by the read-only journal previews — the
 * Yesterday card on Today, and the entry rows on Journal List. This is
 * a 1-to-5 RATING BAR, not a single-selected indicator — dots up to
 * and including the chosen value are filled, the rest are hollow rings.
 * A mood of 3 renders as filled-filled-filled-empty-empty.
 *
 * The editor-side tappable variant lives next to this file as
 * InteractiveMoodDots.
 */
export function MoodDots({ mood, size = 8 }: MoodDotsProps) {
  const theme = useTheme();
  if (mood === null) return null;

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing[2], alignItems: 'center' }}>
      {ALL_DOTS.map((n) => {
        const filled = n <= mood;
        return (
          <View
            key={n}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: filled ? theme.colors.accent : 'transparent',
              borderWidth: filled ? 0 : 1,
              borderColor: theme.colors.textTertiary,
            }}
          />
        );
      })}
    </View>
  );
}
