import { useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemeStore, type ThemeOverride } from '../theme';
import { colorsDark, colorsLight, type ColorPalette, type ColorRole } from '../theme/tokens';

const colorRoles: ColorRole[] = [
  'bg',
  'surface',
  'surfaceElev',
  'textPrimary',
  'textSecondary',
  'textTertiary',
  'accent',
  'divider',
];

const typeSamples: Array<{ role: keyof ReturnType<typeof useTheme>['type']; sample: string; tint?: 'accent' }> = [
  { role: 'display', sample: 'Today.' },
  { role: 'displayXL', sample: '24' },
  { role: 'displayItalic', sample: 'All held today.' },
  { role: 'heading', sample: 'Streaks' },
  { role: 'body', sample: 'Habit name on the left.' },
  { role: 'bodyMedium', sample: 'Today' },
  { role: 'label', sample: 'CURRENT STREAK' },
  { role: 'caption', sample: 'last · 82.5' },
  { role: 'streakAccent', sample: '24', tint: 'accent' },
];

const overrideOptions: ThemeOverride[] = ['system', 'dark', 'light'];

export default function DesignScreen() {
  const theme = useTheme();
  const override = useThemeStore((s) => s.override);
  const setOverride = useThemeStore((s) => s.setOverride);

  const motionOpacity = useRef(new Animated.Value(0)).current;

  const playMotion = () => {
    motionOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(motionOpacity, { toValue: 1, duration: theme.motion.durations.fast, useNativeDriver: true }),
      Animated.timing(motionOpacity, { toValue: 0, duration: theme.motion.durations.fast, useNativeDriver: true }),
      Animated.timing(motionOpacity, { toValue: 1, duration: theme.motion.durations.base, useNativeDriver: true }),
      Animated.timing(motionOpacity, { toValue: 0, duration: theme.motion.durations.base, useNativeDriver: true }),
      Animated.timing(motionOpacity, { toValue: 1, duration: theme.motion.durations.slow, useNativeDriver: true }),
      Animated.timing(motionOpacity, { toValue: 0, duration: theme.motion.durations.slow, useNativeDriver: true }),
    ]).start();
  };

  const sectionHeading: TextStyle = {
    ...theme.type.heading,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing[6],
    marginBottom: theme.spacing[3],
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing[5],
          paddingBottom: theme.spacing[8],
        }}
      >
        <Text style={[theme.type.display, { color: theme.colors.textPrimary, marginTop: theme.spacing[3] }]}>
          Design.
        </Text>
        <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: theme.spacing[1] }]}>
          Mode override.
        </Text>

        <View style={{ flexDirection: 'row', gap: theme.spacing[5], marginTop: theme.spacing[3] }}>
          {overrideOptions.map((opt) => {
            const active = override === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => setOverride(opt)}
                accessibilityRole="button"
                accessibilityLabel={`Set theme override to ${opt}`}
                accessibilityState={{ selected: active }}
                hitSlop={8}
              >
                <Text
                  style={[
                    theme.type.bodyMedium,
                    { color: active ? theme.colors.accent : theme.colors.textSecondary },
                  ]}
                >
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={sectionHeading}>Type.</Text>
        <View style={{ gap: theme.spacing[3] }}>
          {typeSamples.map(({ role, sample, tint }) => (
            <View
              key={role}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: theme.spacing[4],
              }}
            >
              <Text
                style={[
                  theme.type[role],
                  { color: tint === 'accent' ? theme.colors.accent : theme.colors.textPrimary, flexShrink: 1 },
                ]}
                numberOfLines={2}
              >
                {sample}
              </Text>
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{role}</Text>
            </View>
          ))}
        </View>

        <Text style={sectionHeading}>Color.</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing[4] }}>
          <ColorColumn label="Dark." palette={colorsDark} theme={theme} />
          <ColorColumn label="Light." palette={colorsLight} theme={theme} />
        </View>

        <Text style={sectionHeading}>Spacing.</Text>
        <View style={{ gap: theme.spacing[2] }}>
          {theme.spacing.map((value, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary, width: 110 }]}>
                {`spacing[${idx}] = ${value}`}
              </Text>
              <View
                style={{
                  width: value === 0 ? 1 : value,
                  height: value === 0 ? StyleSheet.hairlineWidth : 8,
                  backgroundColor: theme.colors.accent,
                  borderRadius: theme.radii.sm,
                }}
              />
            </View>
          ))}
        </View>

        <Text style={sectionHeading}>Radii.</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing[5] }}>
          {(Object.keys(theme.radii) as Array<keyof typeof theme.radii>).map((key) => (
            <View key={key} style={{ alignItems: 'center', gap: theme.spacing[2] }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: theme.colors.surfaceElev,
                  borderRadius: theme.radii[key],
                }}
              />
              <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{key}</Text>
            </View>
          ))}
        </View>

        <Text style={sectionHeading}>Motion.</Text>
        <Pressable
          onPress={playMotion}
          accessibilityRole="button"
          accessibilityLabel="Play motion sample"
          hitSlop={8}
        >
          <Text style={[theme.type.bodyMedium, { color: theme.colors.accent }]}>Tap to feel motion.</Text>
        </Pressable>
        <Animated.View
          style={{
            marginTop: theme.spacing[3],
            width: 32,
            height: 32,
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radii.sm,
            opacity: motionOpacity,
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ColorColumn({
  label,
  palette,
  theme,
}: {
  label: string;
  palette: ColorPalette;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flex: 1, gap: theme.spacing[3] }}>
      <Text style={[theme.type.bodyMedium, { color: theme.colors.textPrimary }]}>{label}</Text>
      {colorRoles.map((role) => (
        <View key={role} style={{ gap: theme.spacing[1] }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: theme.radii.sm,
              backgroundColor: palette[role],
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.divider,
            }}
          />
          <Text style={[theme.type.caption, { color: theme.colors.textPrimary }]}>{role}</Text>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{palette[role]}</Text>
        </View>
      ))}
    </View>
  );
}
