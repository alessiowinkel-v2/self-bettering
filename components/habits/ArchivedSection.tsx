import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { Card, ListGroup, ListRow, Text } from '../primitives';
import type { Habit } from '../../state/types';

type ArchivedSectionProps = {
  habits: ReadonlyArray<Habit>;
  onRowPress: (id: string) => void;
};

/**
 * Archived habits section. Collapsed by default; the header itself is
 * the toggle affordance — the heading on the left and count on the
 * right form the lockup. Renders nothing when there are no archived
 * habits.
 *
 * The header is a custom composition rather than the SectionHeader
 * primitive because SectionHeader does not expose a right side or a
 * tone override. Top/bottom margins mirror SectionHeader's defaults.
 */
export function ArchivedSection({ habits, onRowPress }: ArchivedSectionProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (habits.length === 0) return null;

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide archived.' : 'Show archived.'}
        accessibilityState={{ expanded }}
        hitSlop={8}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginTop: theme.spacing[6],
            marginBottom: theme.spacing[3],
            minHeight: theme.touchTarget.minHeight,
            gap: theme.spacing[3],
          },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text variant="heading" tone="secondary">
          Archived
        </Text>
        <Text variant="caption" tone="secondary">
          {habits.length} {expanded ? 'shown.' : 'hidden.'}
        </Text>
      </Pressable>

      {expanded ? (
        <Card padding={0} style={{ opacity: 0.4 }}>
          <ListGroup>
            {habits.map((habit, i) => (
              <ListRow
                key={habit.id}
                index={i}
                left={<Text variant="body">{habit.name}</Text>}
                onPress={() => onRowPress(habit.id)}
                accessibilityLabel={`Open ${habit.name}`}
                style={{ paddingHorizontal: theme.spacing[4] }}
              />
            ))}
          </ListGroup>
        </Card>
      ) : null}
    </View>
  );
}
