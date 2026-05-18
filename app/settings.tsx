import { useHeaderHeight } from '@react-navigation/elements';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, Switch, View } from 'react-native';
import { CheckInRow, ThemeChoice } from '../components/settings';
import {
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
  Stepper,
  Text,
} from '../components/primitives';
import { wipeAllData } from '../db/wipe';
import { useGymHomeStore } from '../state/gymHomeStore';
import { useHabitsListStore } from '../state/habitsListStore';
import { useSettingsStore } from '../state/settingsStore';
import { useTodayStore } from '../state/todayStore';
import { useTheme, useThemeStore } from '../theme';
import { runExportFlow } from '../utils/export';
import { haptics } from '../utils/haptics';
import { ensurePermission, syncCheckInNotifications } from '../utils/notifications';
import { formatRest } from '../utils/workout';
import type { ThemeOverride } from '../theme';

/**
 * Settings — stack route under root, reachable from Today's cog icon.
 *
 * Sections (Fraunces section heads, rows below):
 *   1. Appearance — theme selector (always-visible three-button row).
 *   2. Notifications — morning check-in, evening check-in, rest timer
 *      alerts switch, default rest duration. The two check-in times
 *      schedule daily local notifications via `utils/notifications`:
 *      enabling one requests OS permission, and any change reconciles
 *      the schedule (debounced against the picker's per-tick onChange).
 *      Default rest feeds workout exercises that have no per-exercise
 *      rest override.
 *   3. Data — Export to JSON, Clear all data (destructive). Import is
 *      omitted entirely until Phase 4 — no disabled-row stub.
 *   4. About — Version row. No credit line.
 *
 * The Clear-all-data flow uses `Alert.alert` for confirmation. After
 * wipe, every cross-screen store is re-hydrated so empty surfaces paint
 * correctly when the user navigates back. The wipe leaves `_migrations`
 * intact so schema state survives.
 *
 * Export uses the documents directory with a date-stamped filename and
 * hands off to expo-sharing so the user can route the JSON anywhere
 * iOS offers (Files, AirDrop, Mail).
 */

const STACK_OPTIONS = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
} as const;

export default function SettingsScreen() {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();

  const themeOverride = useThemeStore((s) => s.override);
  const setThemeOverride = useThemeStore((s) => s.setOverride);

  const morningCheckInTime = useSettingsStore((s) => s.morningCheckInTime);
  const setMorningCheckInTimeRaw = useSettingsStore((s) => s.setMorningCheckInTime);
  const eveningCheckInTime = useSettingsStore((s) => s.eveningCheckInTime);
  const setEveningCheckInTimeRaw = useSettingsStore((s) => s.setEveningCheckInTime);
  const restTimerAlerts = useSettingsStore((s) => s.restTimerAlerts);
  const setRestTimerAlertsRaw = useSettingsStore((s) => s.setRestTimerAlerts);
  const defaultRestDurationSeconds = useSettingsStore(
    (s) => s.defaultRestDurationSeconds,
  );
  const setDefaultRestDurationSeconds = useSettingsStore(
    (s) => s.setDefaultRestDurationSeconds,
  );

  // Haptic-wrapped commits. Theme tap, switch toggle, and the
  // null<->time transitions on check-in rows each fire light() — small,
  // deliberate state changes. Scroll-ticks inside the iOS time picker
  // are NOT haptic'd: the spinner has its own native tactile feel and
  // layering our own light() on every tick during a scroll would read
  // as buzzing noise. Only the enablement (null → first value) and
  // disablement (any → null, via "Turn off.") fire.
  const onChangeTheme = useCallback(
    (next: ThemeOverride) => {
      haptics.light();
      setThemeOverride(next);
    },
    [setThemeOverride],
  );

  // Notification reconcile is debounced. The CheckInRow spinner fires
  // onChange on every wheel tick; a cancel+reschedule per tick would
  // churn the OS scheduler and race to an unpredictable end state. We
  // reconcile 400ms after the last change instead — last value wins.
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSync = useCallback(() => {
    const { morningCheckInTime: m, eveningCheckInTime: e } =
      useSettingsStore.getState();
    void syncCheckInNotifications(m, e);
  }, []);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncTimer.current = null;
      runSync();
    }, 400);
  }, [runSync]);

  // Flush a pending reconcile on unmount so a change made right before
  // leaving Settings still takes effect without waiting for next boot.
  useEffect(
    () => () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
        runSync();
      }
    },
    [runSync],
  );

  // Permission is requested lazily — only when a reminder is turned on
  // (null -> time). A denial keeps the time saved; the schedule sync
  // then no-ops silently, and the alert points the user to iOS Settings.
  //
  // The prompt can outlast the debounced sync, which would then run
  // against a still-undetermined status and schedule nothing — so
  // reconcile once more here, after permission has settled.
  const requestCheckInPermission = useCallback(async () => {
    const granted = await ensurePermission();
    if (!granted) {
      Alert.alert(
        'Notifications are off.',
        'Turn them on for Lumen in iOS Settings to get check-in reminders.',
      );
    }
    runSync();
  }, [runSync]);

  const onChangeMorning = useCallback(
    (next: string | null) => {
      const turnedOn = morningCheckInTime === null && next !== null;
      if ((morningCheckInTime === null) !== (next === null)) haptics.light();
      setMorningCheckInTimeRaw(next);
      if (turnedOn) void requestCheckInPermission();
      scheduleSync();
    },
    [
      morningCheckInTime,
      setMorningCheckInTimeRaw,
      requestCheckInPermission,
      scheduleSync,
    ],
  );

  const onChangeEvening = useCallback(
    (next: string | null) => {
      const turnedOn = eveningCheckInTime === null && next !== null;
      if ((eveningCheckInTime === null) !== (next === null)) haptics.light();
      setEveningCheckInTimeRaw(next);
      if (turnedOn) void requestCheckInPermission();
      scheduleSync();
    },
    [
      eveningCheckInTime,
      setEveningCheckInTimeRaw,
      requestCheckInPermission,
      scheduleSync,
    ],
  );

  const onToggleRestTimerAlerts = useCallback(
    (next: boolean) => {
      haptics.light();
      setRestTimerAlertsRaw(next);
    },
    [setRestTimerAlertsRaw],
  );

  // Default rest duration: 30s steps, clamped to 30s–5:00. Used by any
  // workout exercise that has no per-exercise rest override.
  const onStepDefaultRest = useCallback(
    (delta: 1 | -1) => {
      haptics.light();
      const cur = useSettingsStore.getState().defaultRestDurationSeconds;
      const next = Math.min(300, Math.max(30, cur + delta * 30));
      if (next !== cur) setDefaultRestDurationSeconds(next);
    },
    [setDefaultRestDurationSeconds],
  );

  const version = useMemo(() => {
    return Constants.expoConfig?.version ?? '0.0.0';
  }, []);

  const titleTopPad = useMemo(
    () => headerHeight + theme.spacing[3],
    [headerHeight, theme.spacing],
  );

  const onExport = useCallback(async () => {
    try {
      await runExportFlow();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not export.', message);
    }
  }, []);

  const onClearAllData = useCallback(() => {
    // Two-step confirm via Alert.alert. The destructive copy uses the
    // app's voice: "Clear all data." / "Everything goes." — short
    // declaratives ending in periods.
    Alert.alert(
      'Clear all data.',
      'Habits, journal entries, workouts. Everything goes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            // Warning is the one non-Success notification haptic in the
            // app — reserved for irreversible actions. Fires the moment
            // the user commits the destructive choice, before the wipe
            // runs, so the device confirms the tap was received even if
            // the SQLite work takes a beat.
            haptics.warning();
            try {
              await wipeAllData();
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              Alert.alert('Could not clear data.', message);
              return;
            }
            // Re-hydrate every cache so empty surfaces paint on return.
            // Failures are non-fatal — the wipe succeeded, and each
            // screen's focus-effect picks up the empty state on next
            // visit. Swallow with a console.warn rather than surfacing
            // a misleading "could not clear" alert.
            void Promise.all([
              useTodayStore.getState().hydrate(),
              useHabitsListStore.getState().hydrate(),
              useGymHomeStore.getState().hydrate(),
            ]).catch((e) =>
              console.warn('[settings] rehydrate after wipe failed:', e),
            );
          },
        },
      ],
    );
  }, []);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={STACK_OPTIONS} />

      <View style={{ marginTop: titleTopPad, marginBottom: theme.spacing[5] }}>
        <Text variant="display">Settings.</Text>
      </View>

      {/* Appearance */}
      <SectionHeader marginTop={0}>Appearance</SectionHeader>
      <ListGroup>
        <ListRow
          index={0}
          left={<Text variant="body">Theme</Text>}
          right={
            <ThemeChoice current={themeOverride} onChange={onChangeTheme} />
          }
        />
      </ListGroup>

      {/* Notifications */}
      <SectionHeader>Notifications</SectionHeader>
      <ListGroup>
        <CheckInRow
          index={0}
          title="Morning check-in"
          value={morningCheckInTime}
          onChange={onChangeMorning}
          accessibilityLabel="Morning check-in time"
        />
        <CheckInRow
          index={1}
          title="Evening check-in"
          value={eveningCheckInTime}
          onChange={onChangeEvening}
          accessibilityLabel="Evening check-in time"
        />
        <ListRow
          index={2}
          left={<Text variant="body">Rest timer alerts</Text>}
          right={
            <Switch
              value={restTimerAlerts}
              onValueChange={onToggleRestTimerAlerts}
              trackColor={{
                false: theme.colors.surfaceElev,
                true: theme.colors.accent,
              }}
              thumbColor={theme.colors.textPrimary}
              ios_backgroundColor={theme.colors.surfaceElev}
              accessibilityLabel="Rest timer alerts"
            />
          }
        />
        <ListRow
          index={3}
          left={<Text variant="body">Default rest</Text>}
          right={
            <Stepper
              display={formatRest(defaultRestDurationSeconds)}
              onDecrement={() => onStepDefaultRest(-1)}
              onIncrement={() => onStepDefaultRest(1)}
              decrementDisabled={defaultRestDurationSeconds <= 30}
              incrementDisabled={defaultRestDurationSeconds >= 300}
              decrementAccessibilityLabel="Decrease default rest"
              incrementAccessibilityLabel="Increase default rest"
              valueMinWidth={48}
            />
          }
        />
      </ListGroup>

      {/* Data */}
      <SectionHeader>Data</SectionHeader>
      <ListGroup>
        <ListRow
          index={0}
          left={<Text variant="body">Export to JSON</Text>}
          onPress={() => {
            void onExport();
          }}
          accessibilityLabel="Export all data as JSON"
        />
        <ListRow
          index={1}
          left={
            <Text variant="body" tone="destructive">
              Clear all data
            </Text>
          }
          onPress={onClearAllData}
          accessibilityLabel="Clear all data"
        />
      </ListGroup>

      {/* About */}
      <SectionHeader>About</SectionHeader>
      <ListGroup>
        <ListRow
          index={0}
          left={<Text variant="body">Version</Text>}
          right={
            <Text variant="body" tone="secondary">
              {version}
            </Text>
          }
        />
      </ListGroup>
    </Screen>
  );
}
