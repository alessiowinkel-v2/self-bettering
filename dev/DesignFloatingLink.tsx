import { Link, usePathname } from 'expo-router';
import { Pressable, Text as RNText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

/**
 * Dev-only floating "DESIGN" link, pinned to the top-right safe-area edge.
 * Lives outside `app/` so expo-router does not register it as a route —
 * the router walks `EXPO_ROUTER_APP_ROOT` (./app/), and folders prefixed
 * with `_` inside that root are NOT ignored (only `_layout` filenames are
 * special). Imported behind __DEV__ in the root layout so the production
 * bundle never references this file.
 */
export function DesignFloatingLink() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  if (pathname === '/design') return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + theme.spacing[2],
        right: theme.spacing[5],
      }}
    >
      <Link href="/design" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open design system"
          hitSlop={12}
          style={({ pressed }) => ({
            opacity: pressed ? 0.5 : 0.85,
            paddingVertical: theme.spacing[1],
            paddingHorizontal: theme.spacing[3],
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surface,
          })}
        >
          <RNText style={[theme.type.label, { color: theme.colors.textTertiary }]}>
            DESIGN
          </RNText>
        </Pressable>
      </Link>
    </View>
  );
}
