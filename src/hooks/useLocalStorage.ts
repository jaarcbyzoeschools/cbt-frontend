// ================================================================
//  CBT SYSTEM — TYPED LOCALSTORAGE PERSISTENCE HOOK
//  File    : src/hooks/useLocalStorage.ts
//  Purpose : A generic, strictly typed React hook that synchronises
//            a state value bidirectionally with localStorage.
//            Primary consumers in this system:
//
//              ExamRoomPage / useExamSession
//                — Persists student answer map so a terminal power
//                  dropout does not destroy chosen answers. On the
//                  next login the exam session is restored from
//                  localStorage rather than starting from scratch.
//
//              useCountdown
//                — Persists remaining seconds so the countdown clock
//                  can resume from the correct position after a crash
//                  rather than restarting at full duration.
//
//            Design constraints:
//              — Generic type parameter T prevents storing or reading
//                values that do not match the declared type.
//              — Serialisation and deserialisation are encapsulated
//                here so callers never call JSON.stringify /
//                JSON.parse directly.
//              — A corrupt or missing localStorage value falls back
//                to the supplied initialValue without throwing.
//              — The removeValue action is provided for explicit
//                cleanup (e.g., clearing exam state after submit).
//              — Storage events from other browser tabs are handled
//                so the hook stays consistent in multi-tab scenarios
//                (though in practice each exam terminal is one tab).
// ================================================================

import {
  useCallback,
  useEffect,
  useState,
} from 'react';


// ── SAFE SERIALISATION HELPERS ───────────────────────────────────

/**
 * Reads a value from localStorage and deserialises it.
 * Returns null if the key does not exist or the JSON is corrupt.
 * Never throws — a corrupt entry is treated as absent.
 */
function readFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    // JSON.parse threw — the stored value is malformed.
    // This can happen if a browser crash interrupted a write.
    console.warn(
      `[useLocalStorage] Corrupt value found for key "${key}". ` +
      'Falling back to initial value.'
    );
    return null;
  }
}

/**
 * Serialises a value and writes it to localStorage.
 * Returns false and logs a warning if the write fails
 * (e.g., storage quota exceeded — unlikely on an exam terminal
 * but handled defensively).
 */
function writeToStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(
      `[useLocalStorage] Failed to write key "${key}" to localStorage.`,
      error
    );
    return false;
  }
}


// ── HOOK RETURN TYPE ─────────────────────────────────────────────
// Typed as a readonly tuple with three explicit members so
// destructuring at the call site gives correctly typed variables.
//
// Usage:
//   const [answers, setAnswers, removeAnswers] =
//     useLocalStorage<AnswerMap>('exam_17_answers', {});

export type UseLocalStorageReturn<T> = readonly [
  value      : T,
  setValue   : (value: T | ((prev: T) => T)) => void,
  removeValue: () => void,
];


// ── HOOK IMPLEMENTATION ──────────────────────────────────────────

/**
 * useLocalStorage<T>
 *
 * Synchronises a React state value with a localStorage entry.
 *
 * @param key          - The localStorage key to read from and write to.
 * @param initialValue - The value to use when no stored value exists
 *                       or the stored value is corrupt.
 *
 * @returns A readonly tuple:
 *   [0] value       - The current state value (typed as T).
 *   [1] setValue    - Updater accepting a new value or an updater
 *                     function (same API as React setState).
 *   [2] removeValue - Removes the key from localStorage and resets
 *                     state to initialValue.
 */
export function useLocalStorage<T>(
  key          : string,
  initialValue : T,
): UseLocalStorageReturn<T> {

  // ── Initial state ──────────────────────────────────────────────
  // Lazy initialiser function passed to useState so localStorage
  // is only read once — on first render — not on every re-render.
  const [storedValue, setStoredValue] = useState<T>((): T => {
    const persisted = readFromStorage<T>(key);
    return persisted !== null ? persisted : initialValue;
  });


  // ── setValue ───────────────────────────────────────────────────
  // Mirrors the React setState API: accepts either a direct value
  // or an updater function that receives the previous value.
  // Writes to localStorage on every call so the persisted value
  // stays in sync with component state.

  const setValue = useCallback(
    (value: T | ((prev: T) => T)): void => {
      setStoredValue((prev: T): T => {
        // Resolve the new value — support both functional and
        // direct update patterns identically to useState.
        const resolved: T =
          typeof value === 'function'
            ? (value as (prev: T) => T)(prev)
            : value;

        writeToStorage<T>(key, resolved);
        return resolved;
      });
    },
    [key]
  );


  // ── removeValue ────────────────────────────────────────────────
  // Removes the localStorage entry and resets state to the initial
  // value supplied when the hook was first called. Used by
  // useExamSession to clean up after a successful exam submission.

  const removeValue = useCallback((): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(
        `[useLocalStorage] Failed to remove key "${key}" from localStorage.`,
        error
      );
    }
    setStoredValue(initialValue);
  }, [key, initialValue]);


  // ── Cross-tab storage event synchronisation ───────────────────
  // Handles the 'storage' event fired when localStorage is modified
  // by another browser tab or window sharing the same origin.
  // In normal CBT operation each student uses one tab, but this
  // listener prevents stale state if a supervisor opens a second
  // tab on the same machine.

  useEffect((): (() => void) => {
    const handleStorageEvent = (event: StorageEvent): void => {
      // Only respond to changes to our specific key.
      if (event.key !== key) return;

      if (event.newValue === null) {
        // The key was removed by another tab — reset to initialValue.
        setStoredValue(initialValue);
      } else {
        // The key was updated by another tab — deserialise and sync.
        const updated = readFromStorage<T>(key);
        if (updated !== null) {
          setStoredValue(updated);
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);

    // Cleanup: remove the listener when the component using this
    // hook unmounts or when the key changes.
    return (): void => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [key, initialValue]);


  // ── Key change synchronisation ────────────────────────────────
  // If the key prop changes (e.g., a component switches from
  // tracking exam_17_answers to exam_18_answers), re-read
  // from localStorage for the new key rather than keeping the
  // stale value from the previous key.

  useEffect((): void => {
    const persisted = readFromStorage<T>(key);
    setStoredValue(persisted !== null ? persisted : initialValue);
    // Intentionally NOT including initialValue in deps — the key
    // change is the trigger, and initialValue is a stable default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);


  return [storedValue, setValue, removeValue] as const;
}

export default useLocalStorage;