import { useTheme } from '../../theme';
import { Text } from '../primitives';

type MonthHeaderProps = {
  /** Uppercase label, e.g. "MAY" or cross-year "MAY 2025". */
  label: string;
  /**
   * Top margin override in spacing-token units. Defaults to spacing[6]
   * so consecutive month groups stay legible — same canonical opening
   * margin as SectionHeader.
   */
  marginTop?: number;
};

/**
 * Month divider on Journal List. Inter `label` (small-caps, 11/14,
 * letter-spaced 0.9) in tone="secondary" — the muted grayscale that
 * carries "LAST 90 DAYS" on Habit Detail. Cross-year groups render
 * with the year appended: "MAY 2025" so it never reads as the wrong
 * May after Dec → Jan rollover.
 *
 * Headers are not bound to the SectionHeader primitive because that
 * lockup uses Fraunces — too loud for an in-list segment. The voice
 * for month dividers on long lists stays Inter small-caps.
 */
export function MonthHeader({ label, marginTop }: MonthHeaderProps) {
  const theme = useTheme();
  return (
    <Text
      variant="label"
      tone="secondary"
      style={{
        marginTop: marginTop ?? theme.spacing[6],
        marginBottom: theme.spacing[3],
      }}
    >
      {label}
    </Text>
  );
}
