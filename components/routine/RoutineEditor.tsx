import { GripVertical, Minus, Plus } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Pressable, Swipeable } from 'react-native-gesture-handler';
import { Screen, Text, TextButton } from '../primitives';
import { ExercisePicker } from '../workout/ExercisePicker';
import type { WorkoutTemplateExercise } from '../../state/types';
import { useTheme } from '../../theme';
import { haptics } from '../../utils/haptics';

/**
 * RoutineEditor — shared body of the Add Routine and Edit Routine modal
 * routes. The two routes are thin wrappers that load data (edit case),
 * provide save handlers, and pass `mode` in; everything else — header,
 * title, name input, exercise list, picker, stepper, reorder mode, and
 * swipe-to-remove — lives here.
 *
 * Mode differences are kept to two strings: the title ("New routine."
 * vs "Edit routine.") and the accessibility labels for those headers.
 * Save behavior is delegated upward via `onSave`, so the editor doesn't
 * need to know whether it's INSERTing or UPDATEing.
 *
 * State held locally:
 *   - name              the routine name buffer
 *   - exercises         the working draft array
 *   - isReorderMode     toggle for the long-press reorder UI
 *   - pickerVisible     ExercisePicker modal flag
 *   - submitting        gates a double-tap on Save
 *
 * The draft is never persisted incrementally — Save commits the whole
 * thing in one shot, Cancel discards. Mirrors Add Habit's modal
 * semantics for the same reason: routines aren't an in-progress object
 * the way an active workout is.
 */

export type RoutineEditorMode = 'create' | 'edit';

export type RoutineDraft = {
  name: string;
  exercises: ReadonlyArray<WorkoutTemplateExercise>;
};

type RoutineEditorProps = {
  mode: RoutineEditorMode;
  initialRoutine: RoutineDraft | null;
  onSave: (routine: RoutineDraft) => Promise<void>;
  onCancel: () => void;
};

const MIN_SETS = 1;
const MAX_SETS = 10;
const DEFAULT_SET_COUNT = 3;
// Sensible default for exercises added in the editor. The editor itself
// doesn't expose rep range — only set count — but the data model
// requires the field. The design-system PDF uses 5–8 as the canonical
// example ("4 × 5–8" subtitle on Active Workout), so we adopt it as the
// default seed. Future polish can let users tune this per exercise if
// the need surfaces; deferred.
const DEFAULT_REP_RANGE: readonly [number, number] = [5, 8];

export function RoutineEditor({
  mode,
  initialRoutine,
  onSave,
  onCancel,
}: RoutineEditorProps) {
  const theme = useTheme();
  const [name, setName] = useState(initialRoutine?.name ?? '');
  const [exercises, setExercises] = useState<
    ReadonlyArray<WorkoutTemplateExercise>
  >(initialRoutine?.exercises ?? []);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && exercises.length > 0 && !submitting;

  const title = mode === 'create' ? 'New routine.' : 'Edit routine.';

  const onAddExercise = useCallback((exerciseName: string) => {
    setExercises((prev) => [
      ...prev,
      {
        name: exerciseName,
        setCount: DEFAULT_SET_COUNT,
        repRange: DEFAULT_REP_RANGE,
      },
    ]);
  }, []);

  const onStep = useCallback(
    (index: number, delta: 1 | -1) => {
      haptics.light();
      setExercises((prev) =>
        prev.map((ex, i) => {
          if (i !== index) return ex;
          const next = Math.min(
            MAX_SETS,
            Math.max(MIN_SETS, ex.setCount + delta)
          );
          if (next === ex.setCount) return ex;
          return { ...ex, setCount: next };
        })
      );
    },
    []
  );

  const onRemove = useCallback((index: number) => {
    haptics.light();
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onReorderEnd = useCallback(
    ({ data }: { data: WorkoutTemplateExercise[] }) => {
      haptics.light();
      setExercises(data);
    },
    []
  );

  const onDone = useCallback(() => {
    haptics.light();
    setIsReorderMode(false);
  }, []);

  const onSavePress = useCallback(async () => {
    if (!canSave) return;
    setSubmitting(true);
    haptics.medium();
    try {
      await onSave({ name: trimmedName, exercises });
    } catch (e) {
      haptics.warning();
      // eslint-disable-next-line no-console
      console.warn('[routine-editor] save failed:', e);
      Alert.alert('Could not save.', '', [{ text: 'OK', style: 'cancel' }]);
      setSubmitting(false);
    }
  }, [canSave, exercises, onSave, trimmedName]);

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<WorkoutTemplateExercise>) => {
      const index = getIndex();
      // getIndex returns undefined in the brief window during a drag
      // where the cell is detached from the data array. Bail rather than
      // silently route taps to row 0.
      if (index === undefined) return null;
      return (
        <ExerciseEditorRow
          item={item}
          index={index}
          isReorderMode={isReorderMode}
          isActiveDrag={isActive}
          onEnterReorderMode={() => {
            haptics.medium();
            setIsReorderMode(true);
          }}
          onLongPressInReorder={drag}
          onStep={onStep}
          onRemove={onRemove}
        />
      );
    },
    [isReorderMode, onStep, onRemove]
  );

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing[3],
            minHeight: theme.touchTarget.minHeight,
          }}
        >
          {isReorderMode ? (
            <View />
          ) : (
            <TextButton
              label="Cancel"
              tone="secondary"
              onPress={onCancel}
              accessibilityLabel="Cancel"
            />
          )}
          {isReorderMode ? (
            <TextButton
              label="Done"
              onPress={onDone}
              accessibilityLabel="Done reordering"
            />
          ) : (
            <TextButton
              label="Save"
              onPress={onSavePress}
              disabled={!canSave}
              accessibilityLabel={
                mode === 'create' ? 'Save routine' : 'Save changes'
              }
            />
          )}
        </View>

        <Text variant="display" style={{ marginTop: theme.spacing[3] }}>
          {title}
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Routine name"
          placeholderTextColor={theme.colors.textTertiary}
          autoFocus={mode === 'create' && exercises.length === 0}
          returnKeyType="done"
          editable={!isReorderMode}
          style={[
            theme.type.heading,
            {
              color: theme.colors.textPrimary,
              paddingVertical: theme.spacing[3],
              marginTop: theme.spacing[5],
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.colors.divider,
            },
          ]}
        />

        <View
          style={{
            marginTop: theme.spacing[6],
            marginBottom: theme.spacing[2],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {isReorderMode ? (
            <Text variant="bodyItalicFraunces" tone="accent">
              Drag to reorder. Tap Done when set.
            </Text>
          ) : (
            <Text variant="label" tone="secondary">
              EXERCISES
            </Text>
          )}
        </View>

        {exercises.length === 0 ? (
          <View style={{ paddingVertical: theme.spacing[3] }}>
            <Text variant="bodyItalicFraunces" tone="secondary">
              No exercises yet.
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <DraggableFlatList<WorkoutTemplateExercise>
              data={exercises as WorkoutTemplateExercise[]}
              keyExtractor={(item, index) => `${item.name}-${index}`}
              renderItem={renderItem}
              onDragEnd={onReorderEnd}
              activationDistance={20}
              contentContainerStyle={{ paddingBottom: theme.spacing[4] }}
            />
          </View>
        )}

        {!isReorderMode ? (
          <View style={{ marginTop: theme.spacing[2] }}>
            <TextButton
              label="+ Add exercise"
              onPress={() => setPickerVisible(true)}
              accessibilityLabel="Add an exercise"
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ExercisePicker
        visible={pickerVisible}
        mode="pick"
        onPick={onAddExercise}
        onClose={() => setPickerVisible(false)}
      />
    </Screen>
  );
}

type ExerciseEditorRowProps = {
  item: WorkoutTemplateExercise;
  index: number;
  isReorderMode: boolean;
  isActiveDrag: boolean;
  onEnterReorderMode: () => void;
  onLongPressInReorder: () => void;
  onStep: (index: number, delta: 1 | -1) => void;
  onRemove: (index: number) => void;
};

/**
 * One row in the editor's exercise list. Two visual modes:
 *   - normal:   ordinal · name · stepper. Swipe-left reveals Remove.
 *   - reorder:  ordinal · name · grip handle. All rows at 0.5 opacity
 *               except the currently-lifted row.
 *
 * Long-press semantics:
 *   - normal mode  → first long-press enters reorder mode (caller fires
 *                    a medium haptic). The user lifts; subsequent
 *                    long-presses on a row trigger an actual drag.
 *   - reorder mode → long-press calls the DraggableFlatList `drag`
 *                    function, beginning the drag for this row.
 *
 * Swipe-to-remove is suppressed in reorder mode — the user's gesture
 * vocabulary in that mode is "press to drag," and a stray horizontal
 * swipe would feel hostile.
 */
function ExerciseEditorRow({
  item,
  index,
  isReorderMode,
  isActiveDrag,
  onEnterReorderMode,
  onLongPressInReorder,
  onStep,
  onRemove,
}: ExerciseEditorRowProps) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable | null>(null);

  const onLongPress = isReorderMode ? onLongPressInReorder : onEnterReorderMode;

  const rowOpacity = isReorderMode ? (isActiveDrag ? 1 : 0.5) : 1;
  const rowBg = isActiveDrag ? theme.colors.surfaceElev : theme.colors.bg;

  const inner = (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => [
        {
          paddingVertical: theme.spacing[3],
          paddingHorizontal: theme.spacing[2],
          minHeight: theme.touchTarget.minHeight,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
          backgroundColor: rowBg,
          opacity: rowOpacity,
        },
        pressed && !isActiveDrag && { opacity: rowOpacity * 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        isReorderMode
          ? `Drag to reorder ${item.name}`
          : `${item.name}, ${item.setCount} sets. Long-press to reorder.`
      }
    >
      <Text
        variant="body"
        tone="tertiary"
        style={{ width: 20, fontVariant: ['tabular-nums'] }}
      >
        {index + 1}
      </Text>
      <View style={{ flex: 1 }}>
        <Text variant="body">{item.name}</Text>
      </View>
      {isReorderMode ? (
        <GripVertical
          size={20}
          color={theme.colors.textTertiary}
          strokeWidth={1.5}
        />
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}
        >
          <StepperButton
            icon="minus"
            onPress={() => onStep(index, -1)}
            disabled={item.setCount <= MIN_SETS}
            accessibilityLabel={`Decrease sets for ${item.name}`}
          />
          <Text
            variant="bodyMedium"
            style={{
              minWidth: 16,
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
            }}
          >
            {item.setCount}
          </Text>
          <StepperButton
            icon="plus"
            onPress={() => onStep(index, 1)}
            disabled={item.setCount >= MAX_SETS}
            accessibilityLabel={`Increase sets for ${item.name}`}
          />
          <Text
            variant="caption"
            tone="tertiary"
            style={{ marginLeft: theme.spacing[1] }}
          >
            sets
          </Text>
        </View>
      )}
    </Pressable>
  );

  const renderRightActions = () => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[3],
      }}
    >
      <TextButton
        label="Remove"
        onPress={() => {
          swipeableRef.current?.close();
          onRemove(index);
        }}
        accessibilityLabel={`Remove ${item.name}`}
      />
    </View>
  );

  // In reorder mode, skip the Swipeable wrapper entirely — the row's
  // gesture vocabulary is drag-only there.
  if (isReorderMode) {
    return inner;
  }

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions}>
      {inner}
    </Swipeable>
  );
}

type StepperButtonProps = {
  icon: 'plus' | 'minus';
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
};

function StepperButton({
  icon,
  onPress,
  disabled,
  accessibilityLabel,
}: StepperButtonProps) {
  const theme = useTheme();
  const Icon = icon === 'plus' ? Plus : Minus;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          width: 32,
          height: 32,
          borderRadius: theme.radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface,
        },
        pressed && !disabled && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Icon
        size={16}
        color={theme.colors.textPrimary}
        strokeWidth={1.75}
      />
    </Pressable>
  );
}
