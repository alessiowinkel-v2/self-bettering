import { Text } from '../primitives';
import type { HabitLifecycleVariant } from '../../utils/habitDetail';

/**
 * Small-caps fg-secondary label that sits below the big streak number
 * on Habit Detail. Maps the lifecycle variant (computed once at the
 * screen level via getHabitLifecycleVariant) to the right copy. The
 * decision tree itself lives in utils/habitDetail.ts so the screen
 * and the label can never disagree on which variant a habit is in.
 */

type StatusLabelProps = {
  variant: HabitLifecycleVariant;
};

export function StatusLabel({ variant }: StatusLabelProps) {
  return (
    <Text variant="label" tone="secondary">
      {labelFor(variant)}
    </Text>
  );
}

export function labelFor(variant: HabitLifecycleVariant): string {
  switch (variant) {
    case 'archived':
      return 'ARCHIVED.';
    case 'paused':
      return 'PAUSED.';
    case 'just-slipped':
      return 'STARTED OVER TODAY.';
    case 'day-one':
      return 'DAY ONE.';
    case 'normal':
      return 'CURRENT STREAK';
  }
}
