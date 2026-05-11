import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Card, Text } from '../primitives';
import type { JournalEntry } from '../../state/types';
import { formatWeekdayWithDate } from '../../utils/dateFormat';
import { MoodDots } from './MoodDots';

type JournalPreviewCardProps = {
  entry: JournalEntry;
  onPress: () => void;
};

/**
 * Read-only preview of a journal entry. The whole card is the tap target.
 *
 * Used in two places:
 *   1. The Yesterday slot on Today (entry = yesterday's journal).
 *   2. Each row on Journal List (entry = the listed day's journal).
 *
 * Layout: weekday + mood-dot rating bar on top, first one or two lines
 * of body, tag chips at the bottom. Mirrors the YesterdayCard pattern
 * the design system already validated — Phase 3e promoted it here so
 * Journal List could share the exact same surface without duplicating
 * the lockup.
 */
export function JournalPreviewCard({ entry, onPress }: JournalPreviewCardProps) {
  const theme = useTheme();
  const weekday = formatWeekdayWithDate(entry.date);

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
