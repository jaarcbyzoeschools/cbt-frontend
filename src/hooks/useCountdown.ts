// ================================================================
//  CBT SYSTEM — PRECISION EXAM COUNTDOWN TIMER HOOK
//  File    : src/hooks/useCountdown.ts
//  Purpose : Manages the live exam countdown clock with:
//              1. Second-accurate interval ticking via setInterval
//                 stored in a ref to prevent stale closure bugs.
//              2. Automatic localStorage persistence on every tick
//                 so remaining seconds survive a terminal power
//                 dropout and can be restored on reconnection.
//              3. Colour-state derivation — returns a typed
//                 TimerColourState so ExamRoomPage applies the
//                 correct Tailwind class without inline arithmetic.
//              4. Auto-submit callback fired at exactly 0 seconds
//                 remaining — the exam submits itself without any
//                 student interaction when time expires.
//              5. Pause / resume control so the UI can halt the
//                 clock during the submission network request.
//              6. Drift correction — uses Date.now() delta on
//                 each tick rather than blindly decrementing by 1
//                 so background tab throttling (where browsers
//                 slow setInterval to ~1 Hz or less) does not
//                 cause the displayed clock to lag behind wall
//                 time. On an exam terminal the tab is always
//                 foregrounded, but this makes the hook safe.
//
//  Colour state thresholds (matching the blueprint spec):
//    > 600 s (10 min) : 'normal'  — teal / default
//    ≤ 600 s          : 'warning' — amber highlight
//    ≤ 120 s (2 min)  : 'danger'  — red blinking
//      0 s            : 'expired' — triggers onExpire callback
// ================================================================

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useLocalStorage } from './useLocalStorage';


// ── TYPES ────────────────────────────────────────────────────────

/**
 * The four visual states of the countdown clock.
 * ExamRoomPage maps each state to a Tailwind colour class.
 */
export type TimerColourState = 'normal' | 'warning' | 'danger' | 'expired';

/**
 * Complete return shape of the useCountdown hook.
 * Destructured by ExamRoomPage to render the clock and apply
 * the correct colour theme.
 */
export interface UseCountdownReturn {
  /** Remaining seconds as an integer ≥ 0. */
  secondsRemaining : number;

  /** Derived colour state for Tailwind class selection. */
  colourState      : TimerColourState;

  /** Whether the interval is currently running. */
  isRunning        : boolean;

  /** Pauses the interval without resetting the counter. */
  pause            : () => void;

  /** Resumes the interval from the current secondsRemaining. */
  resume           : () => void;

  /** Immediately stops the interval and resets to initialSeconds. */
  reset            : () => void;
}

/**
 * Configuration object passed to useCountdown.
 */
export interface UseCountdownConfig {
  /**
   * Total exam duration in seconds (duration_minutes * 60).
   * The clock counts down from this value.
   */
  initialSeconds : number;

  /**
   * The localStorage key used to persist remaining seconds.
   * Pass examStorageKeys.timeRemaining(examId) from exam.ts.
   * When a student reconnects after a crash, the hook reads
   * this key and resumes from the persisted value instead of
   * restarting at initialSeconds.
   */
  storageKey     : string;

  /**
   * Callback fired exactly once when secondsRemaining reaches 0.
   * ExamRoomPage passes its submitExam function here so the exam
   * auto-submits without any student interaction on expiry.
   * The callback must be stable (wrapped in useCallback at the
   * call site) to avoid restarting the interval on re-renders.
   */
  onExpire       : () => void;

  /**
   * Whether the timer should start running immediately on mount.
   * Pass false when questions are still loading and the student
   * has not yet clicked "Unlock Terminal & Initialize Exam Session".
   * Defaults to true when omitted.
   */
  autoStart?     : boolean;
}


// ── THRESHOLDS ───────────────────────────────────────────────────

const WARNING_THRESHOLD_SECONDS = 600 as const;   // 10 minutes
const DANGER_THRESHOLD_SECONDS  = 120 as const;   //  2 minutes


// ── COLOUR STATE DERIVER ─────────────────────────────────────────

function deriveColourState(seconds: number): TimerColourState {
  if (seconds <= 0)                          return 'expired';
  if (seconds <= DANGER_THRESHOLD_SECONDS)   return 'danger';
  if (seconds <= WARNING_THRESHOLD_SECONDS)  return 'warning';
  return 'normal';
}


// ── HOOK ─────────────────────────────────────────────────────────

export function useCountdown({
  initialSeconds,
  storageKey,
  onExpire,
  autoStart = true,
}: UseCountdownConfig): UseCountdownReturn {

  // ── Persisted seconds — crash recovery ────────────────────────
  // useLocalStorage reads storageKey first. If a persisted value
  // is found (from a previous interrupted session) it is used as
  // the starting value instead of initialSeconds. This is the
  // mechanism that restores a student's remaining time after a
  // terminal power dropout.
  const [secondsRemaining, setSecondsRemaining, removePersistedSeconds] =
    useLocalStorage<number>(storageKey, initialSeconds);

  // ── Running state ─────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState<boolean>(autoStart);

  // ── Interval ref ──────────────────────────────────────────────
  // Stored in a ref (not state) so clearing it inside the
  // interval callback does not cause a re-render and does not
  // require it to be in any useEffect dependency array.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Wall-clock anchor ref ─────────────────────────────────────
  // Records the Date.now() value at the start of each interval
  // tick so drift correction can calculate how many seconds
  // actually elapsed rather than assuming exactly 1 per tick.
  const lastTickRef = useRef<number>(Date.now());

  // ── onExpire ref ──────────────────────────────────────────────
  // Storing onExpire in a ref means the interval callback always
  // calls the latest version of the function without needing to
  // be in the setInterval dependency array. This prevents the
  // common bug where a stale closure captures an old onExpire.
  const onExpireRef = useRef<() => void>(onExpire);
  useEffect((): void => {
    onExpireRef.current = onExpire;
  }, [onExpire]);


  // ── INTERVAL MANAGEMENT ───────────────────────────────────────

  const clearExistingInterval = useCallback((): void => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startInterval = useCallback((): void => {
    clearExistingInterval();
    lastTickRef.current = Date.now();

    intervalRef.current = setInterval((): void => {
      const now      = Date.now();
      const elapsed  = Math.round((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      // Use the functional update form so we read the latest
      // secondsRemaining from the state queue rather than the
      // stale value captured in the closure when the interval
      // was created.
      setSecondsRemaining((prev: number): number => {
        // Drift correction: subtract actual elapsed seconds.
        // Under normal conditions elapsed === 1. Under browser
        // tab throttling it may be 2 or 3.
        const next = Math.max(0, prev - elapsed);

        // Persist every tick so localStorage always holds the
        // latest remaining time. This is what crash recovery reads.
        // (setSecondsRemaining from useLocalStorage writes to
        //  localStorage automatically on each call.)

        if (next <= 0) {
          // Time is up — stop the interval and fire the callback.
          clearExistingInterval();
          setIsRunning(false);
          removePersistedSeconds();   // Clean up localStorage on natural expiry
          // Defer the callback to the next event loop tick so
          // React can process the state update (next = 0) before
          // the submit logic runs.
          setTimeout((): void => {
            onExpireRef.current();
          }, 0);
        }

        return next;
      });
    }, 1000);
  }, [clearExistingInterval, removePersistedSeconds, setSecondsRemaining]);


  // ── LIFECYCLE — start/stop based on isRunning ─────────────────
  useEffect((): (() => void) => {
    if (isRunning && secondsRemaining > 0) {
      startInterval();
    } else {
      clearExistingInterval();
    }

    return (): void => {
      clearExistingInterval();
    };
    // secondsRemaining intentionally excluded from deps —
    // we do not want to restart the interval on every tick.
    // The interval manages its own decrement via functional update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, startInterval, clearExistingInterval]);


  // ── CLEANUP ON UNMOUNT ────────────────────────────────────────
  useEffect((): (() => void) => {
    return (): void => {
      clearExistingInterval();
    };
  }, [clearExistingInterval]);


  // ── PUBLIC CONTROLS ───────────────────────────────────────────

  const pause = useCallback((): void => {
    setIsRunning(false);
  }, []);

  const resume = useCallback((): void => {
    if (secondsRemaining > 0) {
      setIsRunning(true);
    }
  }, [secondsRemaining]);

  const reset = useCallback((): void => {
    clearExistingInterval();
    setIsRunning(false);
    setSecondsRemaining(initialSeconds);
  }, [clearExistingInterval, setSecondsRemaining, initialSeconds]);


  // ── DERIVED COLOUR STATE ──────────────────────────────────────
  const colourState: TimerColourState = deriveColourState(secondsRemaining);


  return {
    secondsRemaining,
    colourState,
    isRunning,
    pause,
    resume,
    reset,
  };
}

export default useCountdown;