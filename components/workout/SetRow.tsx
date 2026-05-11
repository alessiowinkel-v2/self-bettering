import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Text, TextButton } from '../primitives';
import { formatKg } from '../../utils/workout';

export type SetRowStatus = 'logged' | 'active' | 'inactive';

type SetRowProps = {
  setNumber: number;
  status: SetRowStatus;
  kg: number | null;
  reps: number | null;
  /**
   * True when `kg` is a placeholder from lastSets, not a user-committed
   * or user-edited value. Drives the dim render for the active row's
   * untouched field.
   */
  isPlaceholderKg: boolean;
  isPlaceholderReps: boolean;
  /** Active rows only — taps open the numeric pad for that field. */
  onTapKg?: () => void;
  onTapReps?: () => void;
  /**
   * Active rows only — commits the set with the currently-displayed
   * values (draft if entered, placeholder otherwise). Hidden when null.
   *
   * Returning a Promise is supported and the row uses it for the
   * in-flight gate (see `isLogging` below). Returning void is fine when
   * the caller does its own gating.
   */
  onLog?: () => void | Promise<void>;
  /** Disables the Log button on the active row when kg or reps is null. */
  canLog?: boolean;
};

/**
 * One row of a set list inside the Active Workout exercise block.
 *
 * Columns:
 *   1. Set number          — small-caps tertiary, narrow gutter
 *   2. kg display          — "82.5" + small "kg" suffix
 *   3. reps display        — "6" + small "reps" suffix
 *   4. Action              — "Log" amber on active, checkmark on logged,
 *                            empty on inactive
 *
 * Active rows wrap kg/reps in a subtle surfaceElev pill to read as
 * input-like (PDF page 15 set 3). Inactive and logged rows render kg/reps
 * as plain text — no input chrome.
 *
 * Placeholder values (kg/reps from the prior workout's lastSets) render
 * in tone-tertiary on the active row. Committed-draft values render in
 * tone-primary. The visual difference signals "this is what last time
 * looked like" versus "this is what I just typed."
 */
export function SetRow({
  setNumber,
  status,
  kg,
  reps,
  isPlaceholderKg,
  isPlaceholderReps,
  onTapKg,
  onTapReps,
  onLog,
  canLog = true,
}: SetRowProps) {
  const theme = useTheme();
  const isActive = status === 'active';
  const isLogged = status === 'logged';

  // In-flight gate. While the store's logCurrentSet promise is
  // resolving, the Log affordance dims and stops responding to taps.
  // Prevents the double-tap race where two log calls would compute
  // the same `nextSetNumber` from pre-write state. The DB-side UNIQUE
  // constraint (migration 0004) is the safety net; this gate is the
  // ordinary UX path that keeps a slow tap from feeling broken.
  const [isLogging, setIsLogging] = useState(false);
  const handleLog = useCallback(async () => {
    if (!onLog || isLogging) return;
    setIsLogging(true);
    try {
      await onLog();
    } finally {
      setIsLogging(false);
    }
  }, [onLog, isLogging]);

  const kgStr = formatKg(kg) ?? '';
  const repsStr = reps !== null ? reps.toString() : '';

  // Value tone:
  //  - Active + placeholder: tertiary (dim "last time" preview)
  //  - Active + draft:       primary (user-committed)
  //  - Logged:               secondary (committed to DB but dim)
  //  - Inactive:             tertiary (not yet reachable)
  const kgTone =
    isLogged
      ? 'secondary'
      : isActive
        ? isPlaceholderKg
          ? 'tertiary'
          : 'primary'
        : 'tertiary';
  const repsTone =
    isLogged
      ? 'secondary'
      : isActive
        ? isPlaceholderReps
          ? 'tertiary'
          : 'primary'
        : 'tertiary';

  const fieldStyle = isActive
    ? {
        backgroundColor: theme.colors.surfaceElev,
        borderRadius: theme.radii.sm,
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        minWidth: 72,
      }
    : {
        paddingVertical: theme.spacing[2],
        minWidth: 72,
      };

  const rowOpacity = isLogged ? 0.65 : isActive ? 1 : 0.5;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing[3],
        opacity: rowOpacity,
        gap: theme.spacing[3],
      }}
    >
      <View style={{ width: 24 }}>
        <Text variant="caption" tone="tertiary">
          {setNumber}
        </Text>
      </View>

      <Pressable
        onPress={onTapKg}
        disabled={!isActive || !onTapKg}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Edit set ${setNumber} weight in kilograms`}
        style={fieldStyle}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text variant="body" tone={kgTone}>
            {kgStr || ' '}
          </Text>
          <Text variant="caption" tone="tertiary">
            kg
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onTapReps}
        disabled={!isActive || !onTapReps}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Edit set ${setNumber} reps`}
        style={fieldStyle}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text variant="body" tone={repsTone}>
            {repsStr || ' '}
          </Text>
          <Text variant="caption" tone="tertiary">
            reps
          </Text>
        </View>
      </Pressable>

      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {isLogged ? (
          <Check size={18} color={theme.colors.textSecondary} strokeWidth={1.5} />
        ) : isActive && onLog ? (
          <View
            pointerEvents={isLogging ? 'none' : 'auto'}
            style={{ opacity: isLogging ? 0.4 : 1 }}
          >
            <TextButton
              label="Log"
              onPress={handleLog}
              disabled={!canLog || isLogging}
              accessibilityLabel={`Log set ${setNumber}`}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
