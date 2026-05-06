import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../primitives';
import { formatTodayHeaderDate } from '../../utils/dateFormat';
import { greet, greetingLabel } from '../../utils/greeting';

type TodayHeaderProps = {
  /**
   * Reference date for the greeting and date row. Defaults to now. Pass a
   * fixed Date from a dev hook to preview Morning / Evening / Night without
   * changing the phone clock.
   */
  now?: Date;
};

/**
 * The "Today." display + weekday-month-day caption + greeting line that
 * opens the Today screen. Mirrors the canonical lockup at the top of the
 * design PDF (page 1).
 */
export function TodayHeader({ now = new Date() }: TodayHeaderProps) {
  const theme = useTheme();
  const greeting = greet(now);
  const dateLine = formatTodayHeaderDate(now);

  return (
    <View style={{ marginTop: theme.spacing[3] }}>
      <Text variant="display">Today.</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: theme.spacing[3],
          marginTop: theme.spacing[1],
        }}
      >
        <Text variant="caption" tone="secondary">
          {dateLine}
        </Text>
        <Text variant="caption" tone="secondary">
          {greetingLabel(greeting)}
        </Text>
      </View>
    </View>
  );
}
