import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Thin wrapper around expo-haptics. The whole app uses these four
 * verbs only — no direct expo-haptics imports anywhere else.
 *
 * Weights:
 *   light()    — routine commits (Held/Slipped, Log a set, settings toggles)
 *   medium()   — deliberate session-enders (Save workout, End workout)
 *   success()  — completions and arrivals (rest-timer done, workout done)
 *   warning()  — destructive confirmations (Clear all data, future Archive)
 *
 * Each call:
 *   - No-ops on non-iOS. Android is out of scope, but the early return
 *     means future cross-platform expansion can drop in here.
 *   - Swallows errors silently (simulator, missing permission, OS API
 *     change). Haptics are a "nice if it fires" enhancement — never a
 *     correctness path. The .catch keeps the unawaited promise from
 *     surfacing as an unhandled rejection in dev.
 *   - Returns void — the caller fires-and-forgets. Don't `await` these.
 */

function safeImpact(style: Haptics.ImpactFeedbackStyle): void {
  if (Platform.OS !== 'ios') return;
  Haptics.impactAsync(style).catch(() => {});
}

function safeNotification(type: Haptics.NotificationFeedbackType): void {
  if (Platform.OS !== 'ios') return;
  Haptics.notificationAsync(type).catch(() => {});
}

export const haptics = {
  light: () => safeImpact(Haptics.ImpactFeedbackStyle.Light),
  medium: () => safeImpact(Haptics.ImpactFeedbackStyle.Medium),
  success: () => safeNotification(Haptics.NotificationFeedbackType.Success),
  warning: () => safeNotification(Haptics.NotificationFeedbackType.Warning),
};
