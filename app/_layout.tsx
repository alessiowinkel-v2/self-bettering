import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  useFonts as useFraunces,
} from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, useFonts as useInter } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TextButton } from '../components/primitives/Button';
import { Screen } from '../components/primitives/Screen';
import { Text } from '../components/primitives/Text';
import { runMigrations } from '../db/migrate';
import { useTodayStore } from '../state/todayStore';
import { ThemeProvider, useTheme, useThemeMode, useThemeStore } from '../theme';

// Dev-only floating affordance for /design. Conditional require so Metro
// dead-code-eliminates both the import and the module body in production —
// nothing dev-flavored reaches the shipped bundle. The module lives at
// project-root `dev/`, outside `app/`, so expo-router (which walks
// `EXPO_ROUTER_APP_ROOT = ./app/`) does not register it as a route.
// Underscore-prefix folders are NOT ignored by the router — only `_layout`
// filenames are special.
const DesignFloatingLink: ComponentType | null = __DEV__
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? (require('../dev/DesignFloatingLink').DesignFloatingLink as ComponentType)
  : null;

export default function RootLayout() {
  const [fraunces] = useFraunces({ Fraunces_400Regular, Fraunces_400Regular_Italic });
  const [inter] = useInter({ Inter_400Regular, Inter_500Medium });
  const hasHydrated = useThemeStore((s) => s._hasHydrated);

  const [bootReady, setBootReady] = useState(false);
  const [bootError, setBootError] = useState<{ message: string } | null>(null);
  // Bumping this re-runs the boot effect. Retry from BootErrorScreen
  // increments it.
  //
  // cancelled (below) guards the React state updates (setBootReady /
  // setBootError) from stale resolutions on unmount or retry. It does
  // NOT cancel the work itself or guard the store's set() inside
  // hydrate(). Today this is safe because hydrate() only runs after
  // migrations succeed, and once boot has errored, the prior chain has
  // already rejected before reaching hydrate. If a future caller runs
  // hydrate() while another is in flight (e.g. day-rollover refresh in
  // Phase 4), revisit with an epoch guard inside hydrate().
  const [bootAttempt, setBootAttempt] = useState(0);

  useEffect(() => {
    setBootError(null);
    setBootReady(false);
    let cancelled = false;
    runMigrations()
      .then(() => useTodayStore.getState().hydrate())
      .then(() => {
        if (!cancelled) setBootReady(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setBootError({ message });
      });
    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  const retry = useCallback(() => {
    setBootAttempt((n) => n + 1);
  }, []);

  if (!fraunces || !inter || !hasHydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        {bootError ? (
          <BootErrorScreen message={bootError.message} onRetry={retry} />
        ) : bootReady ? (
          <RootStack />
        ) : null}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const mode = useThemeMode();
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-habit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="habit/[id]" />
        <Stack.Screen name="journal/[date]" />
        <Stack.Screen name="settings" />
        {__DEV__ ? (
          <Stack.Screen name="design" options={{ presentation: 'modal' }} />
        ) : null}
      </Stack>
      {__DEV__ && DesignFloatingLink ? <DesignFloatingLink /> : null}
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

function BootErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const mode = useThemeMode();
  const { spacing } = useTheme();
  return (
    <>
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="displayItalic" align="center">
            Something broke.
          </Text>
          <Text
            variant="body"
            tone="tertiary"
            align="center"
            numberOfLines={4}
            style={{ marginTop: spacing[3] }}
          >
            {message}
          </Text>
          <View style={{ marginTop: spacing[5] }}>
            <TextButton
              label="Try again."
              onPress={onRetry}
              accessibilityLabel="Try again."
            />
          </View>
        </View>
      </Screen>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
