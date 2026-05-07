import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  useFonts as useFraunces,
} from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, useFonts as useInter } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { Screen } from '../components/primitives/Screen';
import { Text } from '../components/primitives/Text';
import { runMigrations } from '../db/migrate';
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

  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    runMigrations()
      .then(() => {
        if (!cancelled) setDbReady(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setDbError(message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fraunces || !inter || !hasHydrated) return null;

  return (
    <ThemeProvider>
      {dbError ? (
        <MigrationErrorScreen message={dbError} />
      ) : dbReady ? (
        <RootStack />
      ) : null}
    </ThemeProvider>
  );
}

function RootStack() {
  const mode = useThemeMode();
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="design" options={{ presentation: 'modal' }} />
      </Stack>
      {__DEV__ && DesignFloatingLink ? <DesignFloatingLink /> : null}
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

function MigrationErrorScreen({ message }: { message: string }) {
  const mode = useThemeMode();
  const { spacing } = useTheme();
  return (
    <>
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="displayItalic" italic align="center">
            Migration failed.
          </Text>
          <Text
            variant="caption"
            tone="secondary"
            align="center"
            style={{ marginTop: spacing[3] }}
          >
            {message}
          </Text>
          <Text
            variant="caption"
            tone="secondary"
            align="center"
            style={{ marginTop: spacing[3] }}
          >
            Force-quit and reopen.
          </Text>
        </View>
      </Screen>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
