import { useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemeStore, type ThemeOverride } from '../theme';
import { colorsDark, colorsLight, type ColorPalette, type ColorRole } from '../theme/tokens';
import {
  Card,
  Divider,
  FilledButton,
  ListGroup,
  ListRow,
  SectionHeader,
  Text,
  TextButton,
} from '../components/primitives';
import { useDevStore } from '../state/devStore';
import type { SeedName } from '../dev/seedFixtures';

// Match the DesignFloatingLink pattern in app/_layout.tsx — Metro
// dead-code-eliminates the require() and the entire transitive db/test
// dependency tree under !__DEV__, so production bundles do not ship the
// smoke-test runner or the seed-fixtures it pulls in.
const runDbTests: (() => Promise<unknown>) | null = __DEV__
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? (require('../db/test').runDbTests as () => Promise<unknown>)
  : null;

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
const seedOptions: SeedName[] = ['default', 'first-time', 'today-is-done'];

const habitRows: Array<{ name: string; streak: number }> = [
  { name: 'No nicotine', streak: 24 },
  { name: 'Walk before noon', streak: 11 },
  { name: 'Read 20 minutes', streak: 3 },
];

// Belt + suspenders gating. _layout.tsx omits this route from the Stack
// in production, but the file still exists in the bundle and could be
// reached via a deep link or stale navigation state. Returning null at
// the top of the component renders nothing and keeps the dev-only DB
// reset button out of any production-reachable surface.
export default function DesignScreen() {
  if (!__DEV__) return null;
  return <DesignScreenBody />;
}

function DesignScreenBody() {
  const theme = useTheme();
  const override = useThemeStore((s) => s.override);
  const setOverride = useThemeStore((s) => s.setOverride);
  const activeSeed = useDevStore((s) => s.activeSeed);
  const applySeed = useDevStore((s) => s.applySeed);

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
        <Text variant="display" style={{ marginTop: theme.spacing[3] }}>
          Design.
        </Text>
        <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing[1] }}>
          Mode override.
        </Text>

        <View style={{ flexDirection: 'row', gap: theme.spacing[5], marginTop: theme.spacing[3] }}>
          {overrideOptions.map((opt) => {
            const active = override === opt;
            return (
              <TextButton
                key={opt}
                label={opt}
                tone={active ? 'accent' : 'secondary'}
                onPress={() => setOverride(opt)}
                accessibilityLabel={`Set theme override to ${opt}`}
              />
            );
          })}
        </View>

        <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing[4] }}>
          Today seed.
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing[5], marginTop: theme.spacing[3] }}>
          {seedOptions.map((opt) => {
            const active = activeSeed === opt;
            return (
              <TextButton
                key={opt}
                label={opt}
                tone={active ? 'accent' : 'secondary'}
                onPress={() => applySeed(opt)}
                accessibilityLabel={`Switch Today seed to ${opt}`}
              />
            );
          })}
        </View>

        <View style={{ marginTop: theme.spacing[4] }}>
          <TextButton
            label="run db tests"
            onPress={async () => {
              if (!runDbTests) return;
              const r = await runDbTests();
              // eslint-disable-next-line no-console
              console.log('[db tests]', r);
            }}
            accessibilityLabel="Run database smoke tests"
          />
          <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing[1] }}>
            Output in Metro console.
          </Text>
        </View>

        <RNText style={sectionHeading}>Type.</RNText>
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
              <RNText
                style={[
                  theme.type[role],
                  { color: tint === 'accent' ? theme.colors.accent : theme.colors.textPrimary, flexShrink: 1 },
                ]}
                numberOfLines={2}
              >
                {sample}
              </RNText>
              <RNText style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{role}</RNText>
            </View>
          ))}
        </View>

        <RNText style={sectionHeading}>Color.</RNText>
        <View style={{ flexDirection: 'row', gap: theme.spacing[4] }}>
          <ColorColumn label="Dark." palette={colorsDark} theme={theme} />
          <ColorColumn label="Light." palette={colorsLight} theme={theme} />
        </View>

        <RNText style={sectionHeading}>Spacing.</RNText>
        <View style={{ gap: theme.spacing[2] }}>
          {theme.spacing.map((value, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
              <RNText style={[theme.type.caption, { color: theme.colors.textSecondary, width: 110 }]}>
                {`spacing[${idx}] = ${value}`}
              </RNText>
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

        <RNText style={sectionHeading}>Radii.</RNText>
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
              <RNText style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{key}</RNText>
            </View>
          ))}
        </View>

        <RNText style={sectionHeading}>Motion.</RNText>
        <Pressable
          onPress={playMotion}
          accessibilityRole="button"
          accessibilityLabel="Play motion sample"
          hitSlop={8}
        >
          <RNText style={[theme.type.bodyMedium, { color: theme.colors.accent }]}>Tap to feel motion.</RNText>
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

        {/* Primitives below — every variant labeled. */}

        <SectionHeader>Screen.</SectionHeader>
        <Text variant="caption" tone="secondary">
          The Screen primitive wraps this whole route. Defaults: scroll true,
          edges top, horizontal padding spacing[5], bottom padding spacing[8].
        </Text>

        <SectionHeader>Text.</SectionHeader>
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="display">Today.</Text>
          <Text variant="display" italic>
            All held today.
          </Text>
          <Text variant="displayXL">24</Text>
          <Text variant="displayItalic">Done. 47 minutes.</Text>
          <Text variant="heading">Streaks.</Text>
          <Text variant="body">Body. Habit name on the left.</Text>
          <Text variant="bodyMedium">Body medium.</Text>
          <Text variant="label">CURRENT STREAK</Text>
          <Text variant="caption">last · 82.5</Text>
          <Text variant="streakAccent" tone="accent">
            24
          </Text>
          <Text variant="body" tone="secondary">
            Body, secondary tone — used as body muted.
          </Text>
          <Text variant="body" tone="tertiary">
            Body, tertiary tone.
          </Text>
          <Text variant="body" tone="accent">
            Body, accent tone.
          </Text>
        </View>

        <SectionHeader>SectionHeader.</SectionHeader>
        <Text variant="caption" tone="secondary">
          Above this paragraph is the SectionHeader primitive. Default top
          margin spacing[6], bottom spacing[3]. Same lockup as "Streaks" or
          "Yesterday" on Today.
        </Text>

        <SectionHeader>Card.</SectionHeader>
        <View style={{ gap: theme.spacing[3] }}>
          <Card>
            <Text variant="body">Static card, surface tone.</Text>
            <Text variant="caption" tone="secondary">
              No border, just a surface step above the background.
            </Text>
          </Card>
          <Card surface="surfaceElev">
            <Text variant="body">Static card, surfaceElev tone.</Text>
            <Text variant="caption" tone="secondary">
              One step brighter — used for active inputs and current rows.
            </Text>
          </Card>
          <Card
            onPress={() => {}}
            accessibilityLabel="Pressable card sample"
          >
            <Text variant="body">Pressable card.</Text>
            <Text variant="caption" tone="secondary">
              Tap dims to 0.85 opacity.
            </Text>
          </Card>
        </View>

        <SectionHeader>ListRow.</SectionHeader>
        <Card padding={0}>
          <ListGroup>
            {habitRows.map((row, index) => (
              <ListRow
                key={row.name}
                index={index}
                style={{ paddingHorizontal: theme.spacing[4] }}
                left={<Text variant="body">{row.name}</Text>}
                right={
                  <Text variant="streakAccent" tone="accent">
                    {row.streak}
                  </Text>
                }
              />
            ))}
          </ListGroup>
        </Card>

        <Text variant="caption" tone="secondary" style={{ marginTop: theme.spacing[3] }}>
          Pressable variant.
        </Text>
        <Card padding={0} style={{ marginTop: theme.spacing[2] }}>
          <ListGroup>
            {habitRows.map((row, index) => (
              <ListRow
                key={`p-${row.name}`}
                index={index}
                onPress={() => {}}
                accessibilityLabel={`Open ${row.name}`}
                style={{ paddingHorizontal: theme.spacing[4] }}
                left={<Text variant="body">{row.name}</Text>}
                right={
                  <Text variant="caption" tone="secondary">
                    HELD
                  </Text>
                }
              />
            ))}
          </ListGroup>
        </Card>

        <SectionHeader>TextButton.</SectionHeader>
        <View style={{ flexDirection: 'row', gap: theme.spacing[5], flexWrap: 'wrap' }}>
          <TextButton label="Held" onPress={() => {}} />
          <TextButton label="Slipped" tone="secondary" onPress={() => {}} />
          <TextButton label="Start" onPress={() => {}} />
          <TextButton label="Skip" onPress={() => {}} />
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing[5], marginTop: theme.spacing[3] }}>
          <TextButton label="Edit" tone="primary" onPress={() => {}} />
          <TextButton label="Delete" tone="destructive" onPress={() => {}} />
          <TextButton label="Disabled" onPress={() => {}} disabled />
        </View>

        <SectionHeader>FilledButton.</SectionHeader>
        <Text variant="caption" tone="secondary" style={{ marginBottom: theme.spacing[3] }}>
          Reserved use only. Empty-state CTAs and Save workout.
        </Text>
        <FilledButton label="Add a habit" onPress={() => {}} />
        <View style={{ height: theme.spacing[3] }} />
        <FilledButton label="Save workout" onPress={() => {}} />

        <SectionHeader>Divider.</SectionHeader>
        <Text variant="caption" tone="secondary">
          Full-bleed.
        </Text>
        <Divider marginVertical={theme.spacing[2]} />
        <Text variant="caption" tone="secondary">
          Inset by spacing[4].
        </Text>
        <Divider inset={theme.spacing[4]} marginVertical={theme.spacing[2]} />
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
      <RNText style={[theme.type.bodyMedium, { color: theme.colors.textPrimary }]}>{label}</RNText>
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
          <RNText style={[theme.type.caption, { color: theme.colors.textPrimary }]}>{role}</RNText>
          <RNText style={[theme.type.caption, { color: theme.colors.textSecondary }]}>{palette[role]}</RNText>
        </View>
      ))}
    </View>
  );
}
