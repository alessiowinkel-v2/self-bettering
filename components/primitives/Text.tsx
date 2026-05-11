import type { ReactNode } from 'react';
import {
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../theme';
import type { TypeRole } from '../../theme/tokens';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'destructive';

type TextProps = Omit<RNTextProps, 'style'> & {
  children?: ReactNode;
  /**
   * Type role from the theme scale. Defaults to 'body'.
   */
  variant?: TypeRole;
  /**
   * Color token. Defaults to 'primary'. Use 'secondary' for metadata,
   * 'tertiary' for the quietest labels, 'accent' for amber.
   */
  tone?: Tone;
  /**
   * Italicizes Fraunces variants only. On Inter-based variants this is a
   * no-op — the design system reserves italic for Fraunces ("Last one.",
   * "All held today.", "Done. 47 minutes."). Inter does not ship an italic
   * cut in this project.
   */
  italic?: boolean;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
};

const FRAUNCES_VARIANTS: ReadonlyArray<TypeRole> = [
  'display',
  'displayXL',
  'displayItalic',
  'heading',
  'streakAccent',
  'bodyItalicFraunces',
];

function isFrauncesVariant(variant: TypeRole): boolean {
  return FRAUNCES_VARIANTS.includes(variant);
}

/**
 * Text is the typography primitive. Every visible string in the app should
 * route through it so the type scale and tone palette stay locked.
 */
export function Text({
  children,
  variant = 'body',
  tone = 'primary',
  italic = false,
  align,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();

  const color =
    tone === 'accent'
      ? theme.colors.accent
      : tone === 'destructive'
        ? theme.colors.destructive
        : tone === 'secondary'
          ? theme.colors.textSecondary
          : tone === 'tertiary'
            ? theme.colors.textTertiary
            : theme.colors.textPrimary;

  const base: TextStyle = { ...theme.type[variant], color };

  if (italic && isFrauncesVariant(variant)) {
    base.fontFamily = 'Fraunces_400Regular_Italic';
  }

  if (align) {
    base.textAlign = align;
  }

  return (
    <RNText style={[base, style]} {...rest}>
      {children}
    </RNText>
  );
}

type SectionHeaderProps = {
  children: ReactNode;
  /**
   * Top margin override in spacing-token units. Defaults to spacing[6].
   */
  marginTop?: number;
  /**
   * Bottom margin override in spacing-token units. Defaults to spacing[3].
   */
  marginBottom?: number;
  style?: StyleProp<TextStyle>;
};

/**
 * SectionHeader is the Fraunces "Streaks" / "Yesterday" / "Next workout"
 * lockup that opens each section on Today and the list screens. It carries
 * the canonical top/bottom margins so callers don't redefine them.
 */
export function SectionHeader({
  children,
  marginTop,
  marginBottom,
  style,
}: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <Text
      variant="heading"
      tone="primary"
      style={[
        {
          marginTop: marginTop ?? theme.spacing[6],
          marginBottom: marginBottom ?? theme.spacing[3],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
