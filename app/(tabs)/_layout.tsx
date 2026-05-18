import { Tabs } from 'expo-router';
import { BookOpen, CircleDot, Dumbbell, Sun } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
          letterSpacing: 0.2,
        },
      }}
    >
      {/* Tab icons are quiet markers above the labels — 20px, 1.5
          stroke, matching the back chevron's weight. `color` is passed
          by expo-router from tabBarActiveTintColor / InactiveTintColor
          above, so active = accent (amber), inactive = textSecondary
          fall out without an override. */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            <Sun size={20} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          tabBarIcon: ({ color }) => (
            <CircleDot size={20} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color }) => (
            <BookOpen size={20} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="gym"
        options={{
          title: 'Gym',
          tabBarIcon: ({ color }) => (
            <Dumbbell size={20} color={color} strokeWidth={1.5} />
          ),
        }}
      />
    </Tabs>
  );
}
