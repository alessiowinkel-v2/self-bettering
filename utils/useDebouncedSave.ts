import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'error';

/**
 * Generic debounced auto-save hook.
 *
 * Contract:
 * - On every change to `draft` that differs from the persisted snapshot,
 *   schedules a single trailing save `delayMs` later. Identity changes
 *   to `isEqual`, `save`, or `enabled` do NOT re-schedule the debounce
 *   or re-run the unmount-flush; those values are mirrored into refs
 *   so callers can pass inline lambdas freely.
 * - On unmount, flushes the most recent unsaved draft fire-and-forget.
 *   `cancelledRef` blocks any setState that would race the unmount and
 *   is intentionally never reset to false — the hook is single-use per
 *   mount. Re-mounting initializes a fresh ref.
 * - `enabled` gates the debounce + flush AND defines the persistedRef
 *   baseline. While disabled, the hook treats every render as "the
 *   draft is in the process of being hydrated" and continually rebases
 *   persistedRef to the latest draft. The moment `enabled` flips true,
 *   persistedRef is the post-hydration draft, so the first user edit
 *   is the first thing that triggers a save. Note: an `enabled`
 *   transition `true → false → true` is NOT a supported flow — the
 *   rebase will absorb any in-flight draft as if it were always
 *   persisted. Callers should keep `enabled` monotonic per mount.
 */
export function useDebouncedSave<T>(opts: {
  draft: T;
  isEqual: (a: T, b: T) => boolean;
  save: (draft: T) => Promise<void>;
  delayMs?: number;
  enabled?: boolean;
}): { status: SaveStatus; errorMessage: string | null } {
  const { draft, isEqual, save, delayMs = 500, enabled = true } = opts;

  // Mirror every caller-provided value into a ref so the debounce
  // effect can depend only on [draft, delayMs] and the cleanup effect
  // on []. Identity-unstable lambdas from callers (inline isEqual or
  // save) won't re-arm the cleanup or re-schedule the timer.
  const persistedRef = useRef<T>(draft);
  const draftRef = useRef<T>(draft);
  const isEqualRef = useRef(isEqual);
  const saveRef = useRef(save);
  const enabledRef = useRef(enabled);
  draftRef.current = draft;
  isEqualRef.current = isEqual;
  saveRef.current = save;
  enabledRef.current = enabled;

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabledRef.current) {
      // Pre-enable, the draft is whatever the screen has hydrated so
      // far. Rebase persistedRef each render so the first post-enable
      // comparison treats the loaded values as already persisted.
      persistedRef.current = draft;
      return;
    }
    if (isEqualRef.current(draft, persistedRef.current)) {
      // Edit-then-undo within the debounce window: the draft moved
      // away from persisted (status -> 'pending', timer armed), then
      // moved back (cleanup cancelled the timer, this branch took the
      // early return). Without this, status stays at 'pending' and
      // the SAVED dot remains hollow until the next edit cycle
      // resolves. Settle back to 'idle' so the indicator reads
      // honestly: nothing-to-save-against-persisted.
      setStatus('idle');
      setErrorMessage(null);
      return;
    }
    setStatus('pending');
    setErrorMessage(null);
    timerRef.current = setTimeout(async () => {
      // Re-check enabled at fire time. The schedule-time decision
      // can become stale if the caller flips enabled to false during
      // the debounce window. Documented as unsupported per the
      // monotonic-per-mount expectation in the docstring, but the
      // hook is generic and re-checking costs one ref read.
      //
      // When this branch fires, status is left at 'pending' rather
      // than reset. Three options were considered:
      //   - clear-to-idle: reads as "nothing to save", but lies —
      //     draft != persistedRef and there's outstanding work.
      //   - finalize-to-saved: reads as "persisted", but lies —
      //     the save never ran, persistedRef is stale.
      //   - leave-pending: the indicator stays hollow until the
      //     next edit cycle resolves. Honest about the unresolved
      //     state, at the cost of a stale-looking dot. Most truthful
      //     of the three under non-monotonic enabled flips.
      // Picked: leave-pending.
      if (!enabledRef.current) return;
      const snapshot = draftRef.current;
      try {
        await saveRef.current(snapshot);
        if (cancelledRef.current) return;
        persistedRef.current = snapshot;
        if (isEqualRef.current(draftRef.current, snapshot)) {
          setStatus('saved');
        }
      } catch (e) {
        if (cancelledRef.current) return;
        setStatus('error');
        setErrorMessage('Could not save.');
        // eslint-disable-next-line no-console
        console.warn('[useDebouncedSave] save failed:', e);
      }
    }, delayMs);

    return () => {
      // Cancel any pending timer on dep change (next edit, delay
      // change). Keeps timerRef from holding a stale handle and
      // ensures only the most recent draft schedules a save.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [draft, delayMs]);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      const snapshot = draftRef.current;
      if (!isEqualRef.current(snapshot, persistedRef.current)) {
        void saveRef.current(snapshot).catch(() => undefined);
      }
    },
    [],
  );

  return { status, errorMessage };
}
