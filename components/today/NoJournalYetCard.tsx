import { Card, Text } from '../primitives';

type NoJournalYetCardProps = {
  onWrite: () => void;
  /**
   * Card body copy. Defaults to "No entry yet today." for Today's
   * Yesterday slot; the Journal tab's pinned Today card passes
   * "Write today." since it sits under a "TODAY" eyebrow that already
   * names the slot.
   */
  label?: string;
};

/**
 * Stand-in for a journal card when the day's entry hasn't been written
 * yet. Same outer dimensions as JournalPreviewCard so the screen
 * rhythm holds. Used by Today's Yesterday slot and the Journal tab's
 * pinned Today card.
 *
 * The whole card is the tap target — same pattern as the preview card.
 */
export function NoJournalYetCard({
  onWrite,
  label = 'No entry yet today.',
}: NoJournalYetCardProps) {
  return (
    <Card
      onPress={onWrite}
      accessibilityLabel="Write today's journal entry"
    >
      <Text variant="bodyMedium" tone="secondary" align="center">
        {label}
      </Text>
    </Card>
  );
}
