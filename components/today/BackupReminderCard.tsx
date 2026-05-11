import { View } from 'react-native';
import { Card, Text, TextButton } from '../primitives';
import { useTheme } from '../../theme';

type BackupReminderCardProps = {
  onExport: () => void;
  onSnooze: () => void;
};

/**
 * Quiet, dismissible card surfaced at the top of Today's body when
 * shouldShowReminder() returns true. Designed as a polite note, not
 * an Alert — Alerts read as errors, this is a friendly nudge.
 *
 * Layout:
 *   BACKUP                    (small-caps secondary eyebrow)
 *   It has been a while.      (Fraunces italic body)
 *   Export your data.
 *                Export  Later  (right-aligned action row)
 *
 * Voice notes (per the three-bucket rule in design-system.md):
 *   - "BACKUP" is a label, no period.
 *   - "It has been a while. Export your data." is two sentences; each
 *     ends with a period. The phrasing is descriptive — stating a fact
 *     about elapsed time — not performing concern.
 *   - "Export" / "Later" are actions, no period.
 *
 * No × close glyph: Export and Later are the two paths the user takes,
 * and the dismissal lives on the Later button. A third "ignore"
 * affordance would dilute the choice.
 */
export function BackupReminderCard({ onExport, onSnooze }: BackupReminderCardProps) {
  const theme = useTheme();

  return (
    <Card>
      <Text variant="label" tone="secondary">
        BACKUP
      </Text>
      <View style={{ marginTop: theme.spacing[2] }}>
        <Text variant="bodyItalicFraunces">It has been a while.</Text>
        <Text variant="bodyItalicFraunces">Export your data.</Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: theme.spacing[4],
          marginTop: theme.spacing[3],
        }}
      >
        <TextButton label="Later" tone="secondary" onPress={onSnooze} />
        <TextButton label="Export" tone="accent" onPress={onExport} />
      </View>
    </Card>
  );
}
