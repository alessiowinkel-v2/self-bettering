import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { RoutineEditor, type RoutineDraft } from '../../components/routine';
import { createWorkoutTemplate } from '../../db/workouts';
import { useGymHomeStore } from '../../state/gymHomeStore';

/**
 * Add Routine — modal route reached from Gym Home's "+ Add routine"
 * link. Thin shell: hands a fresh draft to the shared RoutineEditor,
 * persists on save, and re-hydrates Gym Home so the new row appears in
 * the routines list as soon as we pop back.
 */
export default function NewRoutineModal() {
  const router = useRouter();

  const onSave = useCallback(
    async (draft: RoutineDraft) => {
      await createWorkoutTemplate({
        name: draft.name,
        exercises: draft.exercises,
      });
      await useGymHomeStore.getState().hydrate();
      router.back();
    },
    [router]
  );

  return (
    <RoutineEditor
      mode="create"
      initialRoutine={null}
      onSave={onSave}
      onCancel={() => router.back()}
    />
  );
}
