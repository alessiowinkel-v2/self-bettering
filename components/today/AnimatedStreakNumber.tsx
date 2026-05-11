import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';

/**
 * Streak numeral on Today's habit cards. Animates an amber pulse on
 * increment (N → N+1). All other transitions render the value
 * statically: initial mount, no-change re-render, decrement (slip
 * → 0), or any non-+1 jump.
 *
 * Sequence (320ms total):
 *   Phase 1 — 0–120ms: outgoing number fades opacity 1 → 0
 *     (ease-out). The old digit clears the slot.
 *   Phase 2 — 100–320ms: incoming number fades opacity 0 → 1
 *     (ease-in-out) while its color interpolates accent → accentBright
 *     → accent. The pulse peaks at t=210ms (midpoint of Phase 2).
 *   The 20ms overlap (100–120ms) cross-fades the two layers so the
 *   slot never reads as empty between them.
 *
 * No scale change, no translate, no spring physics, no odometer roll.
 * A held habit is a quiet fact; the animation is the visual
 * equivalent of the period at the end of "All held today."
 *
 * Trigger semantics: previous-value tracked in a ref, animation
 * fires when prev + 1 === current. The ref starts undefined, so the
 * first paint never animates (prev=0 → 1 on a brand-new habit's
 * first held IS an increment and does animate, because prev becomes
 * 0 after the first render). Tuning duration / brightness happens
 * in this file's constants and theme.colors.accentBright.
 */

type AnimatedStreakNumberProps = {
  streak: number;
};

const PHASE_1_DURATION = 120;
const PHASE_2_DURATION = 220;
// Phase 2 starts 20ms before Phase 1 ends so the two layers
// cross-fade rather than handing off through an empty frame.
const PHASE_2_START_DELAY = 100;

export function AnimatedStreakNumber({ streak }: AnimatedStreakNumberProps) {
  const theme = useTheme();
  const prevRef = useRef<number | undefined>(undefined);

  // outgoingValue is the prior number rendered briefly into an
  // absolute layer above the in-flow incoming number, fading out
  // during Phase 1. Cleared once Phase 2's withTiming completes so
  // the layer unmounts.
  const [outgoingValue, setOutgoingValue] = useState<number | null>(null);

  const outgoingOpacity = useSharedValue(0);
  const incomingOpacity = useSharedValue(1);
  const colorProgress = useSharedValue(0);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = streak;

    // Animate only on N → N+1. Everything else (first mount, no-op
    // re-render, decrement, gap > 1) paints the new value statically.
    if (prev === undefined || prev + 1 !== streak) return;

    setOutgoingValue(prev);
    outgoingOpacity.value = 1;
    incomingOpacity.value = 0;
    colorProgress.value = 0;

    outgoingOpacity.value = withTiming(0, {
      duration: PHASE_1_DURATION,
      easing: Easing.out(Easing.ease),
    });

    incomingOpacity.value = withDelay(
      PHASE_2_START_DELAY,
      withTiming(
        1,
        {
          duration: PHASE_2_DURATION,
          easing: Easing.inOut(Easing.ease),
        },
        (finished) => {
          'worklet';
          if (finished) {
            runOnJS(setOutgoingValue)(null);
          }
        },
      ),
    );

    colorProgress.value = withDelay(
      PHASE_2_START_DELAY,
      withTiming(1, {
        duration: PHASE_2_DURATION,
        easing: Easing.inOut(Easing.ease),
      }),
    );
  }, [streak, outgoingOpacity, incomingOpacity, colorProgress]);

  const incomingStyle = useAnimatedStyle(() => ({
    opacity: incomingOpacity.value,
    color: interpolateColor(
      colorProgress.value,
      [0, 0.5, 1],
      [theme.colors.accent, theme.colors.accentBright, theme.colors.accent],
    ),
  }));

  const outgoingStyle = useAnimatedStyle(() => ({
    opacity: outgoingOpacity.value,
  }));

  return (
    <View>
      <Animated.Text style={[theme.type.streakAccent, incomingStyle]}>
        {streak}
      </Animated.Text>
      {outgoingValue !== null ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, outgoingStyle]}
        >
          <Animated.Text
            style={[theme.type.streakAccent, { color: theme.colors.accent }]}
          >
            {outgoingValue}
          </Animated.Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
