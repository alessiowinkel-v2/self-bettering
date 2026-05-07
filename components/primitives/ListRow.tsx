import { Children, createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';

type ListGroupContextValue = {
  total: number;
};

const ListGroupContext = createContext<ListGroupContextValue | null>(null);

type ListGroupProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * ListGroup wraps a column of ListRow children and exposes the total row
 * count via context so each row can decide whether to render a trailing
 * divider. Callers pass the row's index explicitly via .map's second arg —
 * this keeps the count concurrent-safe (no register-on-mount counter).
 */
export function ListGroup({ children, style }: ListGroupProps) {
  const total = Children.count(children);
  const value = useMemo<ListGroupContextValue>(() => ({ total }), [total]);
  return (
    <ListGroupContext.Provider value={value}>
      <View style={style}>{children}</View>
    </ListGroupContext.Provider>
  );
}

type ListRowBaseProps = {
  /**
   * Zero-based row index within the parent ListGroup. Pass via .map's
   * second argument. Used to suppress the trailing divider on the last row.
   */
  index: number;
  /**
   * Left-side content. Typically a habit name or routine title rendered
   * via <Text variant="body" />.
   */
  left: ReactNode;
  /**
   * Right-side content. Typically a streak count, status, or chevron.
   */
  right?: ReactNode;
  /**
   * Optional content rendered below the left/right row — e.g. the
   * Held/Slipped twin buttons on a habit card.
   */
  below?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

type ListRowStaticProps = ListRowBaseProps & {
  onPress?: never;
  accessibilityLabel?: never;
};

type ListRowPressableProps = ListRowBaseProps & {
  onPress: () => void;
  accessibilityLabel: string;
};

export type ListRowProps = ListRowStaticProps | ListRowPressableProps;

/**
 * ListRow is the canonical row used in Habits List, Journal List, Gym Home,
 * and Settings. Renders a left/right lockup with vertical breathing room
 * and a hairline divider unless this is the last row in its ListGroup.
 *
 * If the row sits outside a ListGroup, no divider is rendered — wrap rows
 * in ListGroup whenever you want the row-with-divider rhythm.
 */
export function ListRow(props: ListRowProps) {
  const theme = useTheme();
  const ctx = useContext(ListGroupContext);
  const isLast = ctx ? props.index === ctx.total - 1 : true;

  const innerStyle: StyleProp<ViewStyle> = {
    paddingVertical: theme.spacing[4],
    minHeight: theme.touchTarget.minHeight,
    justifyContent: 'center',
  };

  const headerRowStyle: StyleProp<ViewStyle> = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing[3],
  };

  // props.style insets the row content but NOT the trailing divider — the
  // divider stays full-bleed within the outer container so it spans the
  // card edge-to-edge regardless of the row's horizontal padding.
  const content = (
    <View style={[innerStyle, props.style]}>
      <View style={headerRowStyle}>
        <View style={{ flexShrink: 1 }}>{props.left}</View>
        {props.right !== undefined ? <View>{props.right}</View> : null}
      </View>
      {props.below !== undefined ? (
        <View style={{ marginTop: theme.spacing[2] }}>{props.below}</View>
      ) : null}
    </View>
  );

  const wrapper = props.onPress ? (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      {content}
    </Pressable>
  ) : (
    content
  );

  return (
    <View>
      {wrapper}
      {!isLast ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.colors.divider,
          }}
        />
      ) : null}
    </View>
  );
}
