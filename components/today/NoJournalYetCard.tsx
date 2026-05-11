import { Card, Text } from '../primitives';

type NoJournalYetCardProps = {
  onWrite: () => void;
};

/**
 * Stand-in for the Yesterday card when today's journal hasn't been
 * written yet. Same outer dimensions as JournalPreviewCard so the
 * screen rhythm holds.
 *
 * The whole card is the tap target — same pattern as the preview
 * card. The parent suppresses the "Yesterday" section header above
 * this card; the header belongs to the yesterday slot only, not to
 * this empty state.
 */
export function NoJournalYetCard({ onWrite }: NoJournalYetCardProps) {
  return (
    <Card
      onPress={onWrite}
      accessibilityLabel="Write today's journal entry"
    >
      <Text variant="bodyMedium" tone="secondary" align="center">
        No entry yet today.
      </Text>
    </Card>
  );
}
