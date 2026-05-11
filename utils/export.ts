import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { Alert } from 'react-native';
import { buildExportPayload } from '../db/export';
import { useBackupReminderStore } from '../state/backupReminderStore';
import { todayIso } from './dateFormat';
import { haptics } from './haptics';

/**
 * Centralized Export flow used by both the Settings → Export row and
 * the Today-screen BackupReminderCard. Two call sites, one
 * implementation, so the success state (share sheet) and the
 * reminder bookkeeping (lastExportedAt) stay coupled.
 *
 * Sequence:
 *   1. Fire haptics.medium() — same weight as Save workout. Deliberate,
 *      data-preserving action.
 *   2. Build the JSON payload from db/export.ts (existing schema —
 *      schemaVersion + exportedAt + the six domain arrays).
 *   3. Write to documents/lumen-export-YYYY-MM-DD.json. Overwrite any
 *      prior export from today (single-user, no risk of clobbering
 *      someone else's file; same-day re-exports are intended to win).
 *   4. Open the iOS share sheet via expo-sharing. The sheet IS the
 *      success state — no "Saved." alert on the happy path.
 *   5. After the sheet closes (shared or dismissed), call recordExport()
 *      so the reminder card stands down for another 30 days. Surfacing
 *      the sheet counts; the user can route the file or not.
 *
 * Fallback: when expo-sharing.isAvailableAsync() is false (rare on iOS
 * but the API exposes the check), surface the file URI via Alert so
 * the user can still recover the data. recordExport() still runs —
 * the export happened, the share path just didn't.
 *
 * Errors throw with a humanized message. Callers surface them via the
 * existing "Could not export." alert.
 */
export async function runExportFlow(): Promise<void> {
  haptics.medium();

  const payload = await buildExportPayload();
  const json = JSON.stringify(payload, null, 2);
  const filename = `lumen-export-${todayIso()}.json`;

  const file = new File(Paths.document, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(json);

  const available = await isAvailableAsync();
  if (!available) {
    Alert.alert('Sharing not available.', `Saved to ${file.uri}.`);
    useBackupReminderStore.getState().recordExport();
    return;
  }

  await shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Lumen export',
    UTI: 'public.json',
  });

  // shareAsync resolves on sheet close regardless of whether the user
  // actually shared. That's intentional: opening the sheet is the act
  // we're tracking, not the choice the user makes inside it.
  useBackupReminderStore.getState().recordExport();
}
