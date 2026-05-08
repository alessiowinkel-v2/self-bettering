import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, View } from 'react-native';
import { useTheme } from '../../theme';
import { StreakChip } from '../primitives';

export type StreaksRowItem = {
  habitId: string;
  name: string;
  streak: number;
  active: boolean;
};

type StreaksRowProps = {
  items: ReadonlyArray<StreaksRowItem>;
};

/**
 * Horizontal scroll of streak chips. The trailing edge gets a linear
 * gradient fade to the screen background so the row reads as scrollable
 * rather than clipped — addresses the known issue from the design pass.
 */
export function StreaksRow({ items }: StreaksRowProps) {
  const theme = useTheme();

  // The fade fades from transparent (left) to the screen bg (right) so
  // the chips bleed under it convincingly. Width sized to one chip — wide
  // enough to read as a fade, narrow enough not to mask too much content.
  const fadeWidth = theme.spacing[7];
  const transparent = `${theme.colors.bg}00`;
  const opaque = theme.colors.bg;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: theme.spacing[2],
          paddingRight: fadeWidth,
        }}
      >
        {items.map((item) => (
          <StreakChip
            key={item.habitId}
            name={item.name}
            streak={item.streak}
            active={item.active}
          />
        ))}
      </ScrollView>
      <LinearGradient
        colors={[transparent, opaque]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: fadeWidth,
          pointerEvents: 'none',
        }}
      />
    </View>
  );
}
