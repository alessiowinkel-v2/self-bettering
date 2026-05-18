import { format, parseISO } from 'date-fns';
import { View } from 'react-native';
import { Text } from '../primitives';
import { useTheme } from '../../theme';
import type { Theme } from '../../theme';
import { formatKg } from '../../utils/workout';
import type { RepPr } from '../../utils/exerciseHistory';

/**
 * The PR row on Exercise History — two columns, `5-REP` and `8-REP`,
 * each an eyebrow over a `{kg} · {Mon Day}` value.
 *
 * The screen only mounts this once `shouldShowPrRow` passes (10+
 * sessions with both rep counts represented), so in practice both
 * columns always have data. The null guard is defensive — the row
 * never shrinks to a single column, it hides entirely.
 */

type PrRowProps = {
  fiveRep: RepPr | null;
  eightRep: RepPr | null;
};

export function PrRow({ fiveRep, eightRep }: PrRowProps) {
  const theme = useTheme();
  if (fiveRep === null && eightRep === null) return null;
  return (
    <View style={{ flexDirection: 'row' }}>
      <PrColumn label="5-REP" pr={fiveRep} theme={theme} />
      <PrColumn label="8-REP" pr={eightRep} theme={theme} />
    </View>
  );
}

function PrColumn({
  label,
  pr,
  theme,
}: {
  label: string;
  pr: RepPr | null;
  theme: Theme;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text
        variant="label"
        tone="secondary"
        style={{ marginBottom: theme.spacing[2] }}
      >
        {label}
      </Text>
      {pr !== null ? (
        <Text variant="body">
          {`${formatKg(pr.kg) ?? pr.kg}kg · ${format(parseISO(pr.date), 'MMM d')}`}
        </Text>
      ) : (
        <Text variant="body" tone="tertiary">
          —
        </Text>
      )}
    </View>
  );
}
