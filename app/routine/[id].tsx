import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RoutineEditor, type RoutineDraft } from '../../components/routine';
import { getWorkoutTemplate, updateWorkoutTemplate } from '../../db/workouts';
import { useGymHomeStore } from '../../state/gymHomeStore';

/**
 * Edit Routine — modal route reached by tapping a routine row on Gym
 * Home. Loads the template by id, hands the loaded shape to
 * RoutineEditor, and writes back on save via updateWorkoutTemplate.
 *
 * If the id doesn't resolve (e.g. the routine was deleted in another
 * tab between the tap and the mount), we pop back immediately — there's
 * nothing to edit.
 */
export default function EditRoutineModal() {
  const router = useRouter();
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const id = typeof idParam === 'string' ? idParam : '';

  const [initialRoutine, setInitialRoutine] = useState<RoutineDraft | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) {
      router.back();
      return;
    }
    let cancelled = false;
    void getWorkoutTemplate(id).then((t) => {
      if (cancelled) return;
      if (!t) {
        router.back();
        return;
      }
      setInitialRoutine({ name: t.name, exercises: t.exercises });
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const onSave = useCallback(
    async (draft: RoutineDraft) => {
      await updateWorkoutTemplate({
        id,
        name: draft.name,
        exercises: draft.exercises,
      });
      await useGymHomeStore.getState().hydrate();
      router.back();
    },
    [id, router]
  );

  if (!loaded || !initialRoutine) {
    // Render nothing until the load resolves. The modal sheet is already
    // animating in over Gym Home; a brief blank beats a flash of an
    // empty editor that then snaps to filled.
    return null;
  }

  return (
    <RoutineEditor
      mode="edit"
      initialRoutine={initialRoutine}
      onSave={onSave}
      onCancel={() => router.back()}
    />
  );
}
