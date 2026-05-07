import { View } from 'react-native';
import { useTheme } from '../../theme';
import {
  Card,
  ListGroup,
  ListRow,
  SectionHeader,
  Text,
} from '../primitives';
import type { Habit } from '../../state/types';

type PausedSectionProps = {
  habits: ReadonlyArray<Habit>;
  onRowPress: (id: string) => void;
  /**
   * When true and habits.length > 0, the canonical "All habits paused."
   * line renders above the section header.
   */
  activeIsEmpty: boolean;
};

/**
 * Paused habits section. Each row reads at half opacity to mark its
 * paused state without introducing a new color token. No swipe, no
 * drag — paused habits are read-only here; resume and archive flow
 * through Habit Detail in Phase 3b.
 */
export function PausedSection({
  habits,
  onRowPress,
  activeIsEmpty,
}: PausedSectionProps) {
  const theme = useTheme();
  if (habits.length === 0) return null;

  return (
    <View>
      {activeIsEmpty ? (
        <Text
          variant="displayItalic"
          align="center"
          style={{
            marginTop: theme.spacing[6],
            marginBottom: theme.spacing[3],
          }}
        >
          All habits paused.
        </Text>
      ) : null}
      <SectionHeader>Paused</SectionHeader>
      <Card padding={0} style={{ opacity: 0.5 }}>
        <ListGroup>
          {habits.map((habit, i) => (
            <ListRow
              key={habit.id}
              index={i}
              left={<Text variant="body">{habit.name}</Text>}
              right={
                <Text variant="streakAccent" tone="secondary">
                  —
                </Text>
              }
              onPress={() => onRowPress(habit.id)}
              accessibilityLabel={`Open ${habit.name}`}
              style={{ paddingHorizontal: theme.spacing[4] }}
            />
          ))}
        </ListGroup>
      </Card>
    </View>
  );
}
