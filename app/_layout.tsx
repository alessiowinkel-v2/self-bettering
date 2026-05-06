import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  useFonts as useFraunces,
} from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, useFonts as useInter } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useThemeMode, useThemeStore } from '../theme';

export default function RootLayout() {
  const [fraunces] = useFraunces({ Fraunces_400Regular, Fraunces_400Regular_Italic });
  const [inter] = useInter({ Inter_400Regular, Inter_500Medium });
  const hasHydrated = useThemeStore((s) => s._hasHydrated);

  if (!fraunces || !inter || !hasHydrated) return null;

  return (
    <ThemeProvider>
      <RootStack />
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
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
