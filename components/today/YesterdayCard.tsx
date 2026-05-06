import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Card, Text } from '../primitives';
import type { JournalEntry } from '../../state/types';
import { formatWeekday } from '../../utils/dateFormat';
import { MoodDots } from './MoodDots';

type YesterdayCardProps = {
  entry: JournalEntry;
  onPress: () => void;
};

/**
 * The Yesterday peek card on Today. Shows the prior day's journal entry
 * as a tappable preview — weekday + mood-dot rating bar on top, first
 * line or two of body, tag chips at the bottom. Tapping opens the
 * Journal editor for that date (Phase 1d wires the route).
 */
export function YesterdayCard({ entry, onPress }: YesterdayCardProps) {
  const theme = useTheme();
  const weekday = formatWeekday(entry.date);

  return (
    <Card onPress={onPress} accessibilityLabel={`Open journal entry for ${weekday}`}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing[3],
        }}
      >
        <Text variant="bodyMedium">{weekday}</Text>
        <MoodDots mood={entry.mood} />
      </View>

      {entry.body.length > 0 ? (
        <Text
          variant="body"
          tone="secondary"
          numberOfLines={2}
          style={{ marginTop: theme.spacing[3] }}
        >
          {entry.body}
        </Text>
      ) : null}

      {entry.tags.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing[2],
            marginTop: theme.spacing[3],
            flexWrap: 'wrap',
          }}
        >
          {entry.tags.map((tag) => (
            <View
              key={tag}
              style={{
                paddingHorizontal: theme.spacing[3],
                paddingVertical: theme.spacing[1],
                borderRadius: theme.radii.pill,
                backgroundColor: theme.colors.surfaceElev,
              }}
            >
              <Text variant="caption" tone="secondary">
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
