// ================================================================
//  CBT SYSTEM — EXAM SESSION ORCHESTRATION HOOK
//  File    : src/hooks/useExamSession.ts
//
//  THIS REVISION — the server already returns its own real
//  session.started_at in every getExamQuestions response, but it
//  was only ever read for tab_switches, never surfaced further.
//  ExamRoomPage.tsx's wall-clock timer had no way to reconcile
//  against it, so a student landing on a terminal with empty (or
//  stale) localStorage would see a freshly-reset countdown while
//  the server's real clock, anchored to the true original start
//  time, kept running underneath. Now startedAt is exposed here so
//  the page can always anchor to the server's truth.
// ================================================================

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import axiosInstance       from '../api/axiosInstance';
import { useLocalStorage } from './useLocalStorage';

import type {
  Question,
  AnswerMap,
  AnswerOption,
  StudentAnswer,
  ExamResult,
  ExamSubmitResponse,
} from '../types/exam';

import { examStorageKeys } from '../types/exam';
import { participantStorageTag } from '../utils/participant';


// ================================================================
//  TYPES
// ================================================================

export interface UseExamSessionReturn {
  // Loading / error
  isLoadingQuestions : boolean;
  loadError          : string | null;

  // Question data
  questions          : Question[];
  totalQuestions     : number;
  currentQuestion    : Question | null;
  currentIndex       : number;

  // Answers
  answers            : AnswerMap;
  answeredCount      : number;

  // Flags
  flaggedIds         : Set<number>;

  // Submission
  isSubmitting       : boolean;
  isSubmitted        : boolean;
  submitError        : string | null;
  result             : ExamResult | null;

  // Crash recovery
  wasRestored        : boolean;

  // Timer
  durationSeconds    : number;   // 0 until questions API responds
  startedAt          : string | null; // server's real session start (ISO)
  // Latest "seconds left" reading from the server, and the moment it
  // arrived (performance.now()). The page counts down from this with
  // the PC's stopwatch, so a wrong date/time on the PC has no effect.
  // null until the server has answered.
  timeSync           : TimeSync | null;

  // Tab-switch audit (Improvement 3)
  tabSwitches        : number;   // live count — increments on every tab hide

  // Actions
  selectAnswer : (questionId: number, option: AnswerOption) => void;
  navigateTo   : (index: number) => void;
  nextQuestion : () => void;
  prevQuestion : () => void;
  toggleFlag   : (questionId: number) => void;
  submitExam   : () => Promise<void>;
  clearSession : () => void;
}

export interface TimeSync {
  seconds: number;   // seconds left according to the server
  at     : number;   // performance.now() when that was received
}

// What kind of submit failure happened — decides what the page shows.
//   retryable : network / timeout / server error — try again
//   closed    : the paper was closed by the exam officer
//   expired   : old backend rejected it as time-expired
//   blocked   : not allowed (e.g. paper locked) — nothing to retry
export type SubmitErrorKind = 'retryable' | 'closed' | 'expired' | 'blocked';

export interface UseExamSessionConfig {
  examId          : number;
  onSubmitSuccess : (result: ExamResult) => void;
  onSubmitError   : (message: string, kind: SubmitErrorKind) => void;
  pauseTimer      : () => void;
}


// ── Internal API types ───────────────────────────────────────────

interface AlreadySubmittedResponse {
  success          : false;
  already_submitted: true;
  message          : string;
  result           : ExamResult;
}

interface SessionExpiredResponse {
  success : false;
  code    : 'SESSION_EXPIRED';
  message : string;
}

interface QuestionsSuccessResponse {
  success  : boolean;
  exam     : {
    exam_id                 : number;
    title                   : string;
    duration_minutes        : number;
    total_questions_to_show : number;
  };
  questions: Question[];
  // Present in updated backend — may be absent if backend not yet updated
  session? : {
    session_id  : number;
    started_at  : string;
    tab_switches: number;
    // Answers the server autosaved earlier (absent on older backends)
    saved_answers?: AnswerMap;
    // Seconds left on the server clock (absent on older backends)
    seconds_remaining?: number;
  };
}

interface SecondsRemainingBody { seconds_remaining?: unknown }

// How long to wait after the last answer change before autosaving,
// and how often to retry if a save failed (network blip, etc).
const AUTOSAVE_DEBOUNCE_MS = 2_500;
const AUTOSAVE_RETRY_MS    = 20_000;

// Re-check the time with the server this often (and whenever the
// student comes back to the tab).
const TIME_RESYNC_MS = 60_000;

// Submitting: wait longer than normal requests, and retry a couple of
// times on network/server errors before telling the student. Safe to
// retry — the server ignores a second submit of the same exam.
const SUBMIT_TIMEOUT_MS = 45_000;
const SUBMIT_ATTEMPTS   = 3;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function readSeconds(body: unknown): number | null {
  if (body === null || typeof body !== 'object') return null;
  const v = (body as SecondsRemainingBody).seconds_remaining;
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : null;
}


// ── Helpers ──────────────────────────────────────────────────────

function extractMessage(thrown: unknown): string {
  // Prefer the server's own explanation when there is one
  const data = extractAxiosData<{ message?: unknown }>(thrown);
  if (data !== null && typeof data.message === 'string' && data.message.trim() !== '') {
    return data.message;
  }
  if (extractAxiosStatus(thrown) === null) {
    return 'Cannot reach the exam server. Check the network cable, then try again.';
  }
  if (thrown instanceof Error) return thrown.message;
  return 'An unexpected error occurred. Please try again.';
}

function extractAxiosStatus(thrown: unknown): number | null {
  if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
    const r = (thrown as { response?: { status?: unknown } }).response;
    if (r !== undefined && r !== null && typeof r.status === 'number') {
      return r.status;
    }
  }
  return null;
}

function extractAxiosData<T>(thrown: unknown): T | null {
  if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
    const r = (thrown as { response?: { data?: unknown } }).response;
    if (r !== undefined && r !== null) {
      return (r.data ?? null) as T | null;
    }
  }
  return null;
}


// ================================================================
//  HOOK
// ================================================================

export function useExamSession({
  examId,
  onSubmitSuccess,
  onSubmitError,
  pauseTimer,
}: UseExamSessionConfig): UseExamSessionReturn {

  // ── Core state ───────────────────────────────────────────────
  const [questions,          setQuestions]          = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(true);
  const [loadError,          setLoadError]          = useState<string | null>(null);
  const [durationMinutes,    setDurationMinutes]    = useState<number>(0);
  const [startedAt,          setStartedAt]          = useState<string | null>(null);

  // Improvement 3: tab-switch counter
  const [tabSwitches, setTabSwitches] = useState<number>(0);

  // Who is sitting this exam on this PC — saved answers are kept per
  // person, so the next student on the same computer starts clean.
  const [owner] = useState<string>(() => {
    const tag = participantStorageTag();
    // Remove copies saved by older versions (shared by everyone on this PC)
    try {
      localStorage.removeItem(`exam_${examId}_answers`);
      localStorage.removeItem(`exam_${examId}_questionIndex`);
      localStorage.removeItem(`exam_${examId}_timeRemaining`);
      localStorage.removeItem(`exam_${examId}_startedAt`);
      localStorage.removeItem(`exam_${examId}_durationMs`);
    } catch { /* storage unavailable */ }
    return tag;
  });

  // Persistent state (crash recovery)
  const [currentIndex, setCurrentIndex, removeIndexKey] =
    useLocalStorage<number>(examStorageKeys.questionIndex(examId, owner), 0);

  const [answers, setAnswers, removeAnswerKey] =
    useLocalStorage<AnswerMap>(examStorageKeys.answers(examId, owner), {});

  // Always the latest answers — used by submit, so a submit fired by
  // the timer never sends an out-of-date copy.
  const answersRef = useRef<AnswerMap>(answers);
  answersRef.current = answers;

  const [timeSync, setTimeSync] = useState<TimeSync | null>(null);
  const timeSyncStoppedRef = useRef<boolean>(false);
  const applyServerSeconds = useCallback((seconds: number | null): void => {
    if (seconds === null) return;
    setTimeSync({ seconds, at: performance.now() });
  }, []);

  // Session-only state
  const [flaggedIds,   setFlaggedIds]   = useState<Set<number>>(new Set<number>());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted,  setIsSubmitted]  = useState<boolean>(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [result,       setResult]       = useState<ExamResult | null>(null);
  const [wasRestored,  setWasRestored]  = useState<boolean>(false);

  // Refs
  const isSubmittingRef    = useRef<boolean>(false);
  const onSubmitSuccessRef = useRef(onSubmitSuccess);
  const onSubmitErrorRef   = useRef(onSubmitError);
  const pauseTimerRef      = useRef(pauseTimer);

  // Autosave bookkeeping
  const lastSavedRef       = useRef<string>('{}');   // JSON of the last answers the server confirmed
  const isSavingRef        = useRef<boolean>(false);
  const autosaveStoppedRef = useRef<boolean>(false); // true once the server says time is up / session closed

  useEffect((): void => { onSubmitSuccessRef.current = onSubmitSuccess; }, [onSubmitSuccess]);
  useEffect((): void => { onSubmitErrorRef.current   = onSubmitError;   }, [onSubmitError]);
  useEffect((): void => { pauseTimerRef.current      = pauseTimer;      }, [pauseTimer]);


  // ================================================================
  //  QUESTION LOADING
  // ================================================================

  useEffect((): (() => void) => {
    // Ignore the reply of a load that has been superseded (React dev
    // mode runs this effect twice; a late failure from the first run
    // must not replace questions that already loaded).
    let cancelled = false;
    const loadQuestions = async (): Promise<void> => {
      try {
        // Detect crash recovery before fetching
        const existingAnswerCount = Object.keys(answers).length;
        if (existingAnswerCount > 0) setWasRestored(true);

        setIsLoadingQuestions(true);
        setLoadError(null);

        const response = await axiosInstance.get<QuestionsSuccessResponse>(
          `/api/exams/${examId}/questions`
        );
        if (cancelled) return;

        if (response.data.success) {
          // Improvement 1: Server returns questions in the stable
          // shuffled order stored in exam_sessions.question_order.
          // We just use them directly — no client shuffle needed.
          setQuestions(response.data.questions);
          setDurationMinutes(response.data.exam.duration_minutes);
          // Start the countdown from the server's figure. Older backends
          // don't send it — fall back to the full duration.
          applyServerSeconds(
            readSeconds(response.data.session) ?? response.data.exam.duration_minutes * 60
          );

          // Improvement 3: Read tab_switches from the session
          // object so crash-recovered students see the correct
          // count immediately rather than starting from 0.
          if (response.data.session !== undefined) {
            setTabSwitches(response.data.session.tab_switches);
            // NEW — surface the server's real start time so the
            // page's wall-clock timer can reconcile against it
            // instead of trusting only localStorage.
            setStartedAt(response.data.session.started_at);

            // Restore answers the server already has. On a fresh
            // terminal localStorage is empty, so this is the only
            // copy. Local answers win where both exist, since they
            // may be newer than the last autosave.
            const serverSaved = response.data.session.saved_answers ?? {};
            if (Object.keys(serverSaved).length > 0) {
              setAnswers((local: AnswerMap): AnswerMap => ({ ...serverSaved, ...local }));
              setWasRestored(true);
            }
            lastSavedRef.current = JSON.stringify(serverSaved);

            // NEW — confirm this exam has genuinely been received
            // right here, now that questions are actually in state
            // and about to render. This is what lets the server
            // tell a real crash-recovery retry apart from "the
            // response never arrived the first time" (see migration
            // 011 and the comment in examController.js's
            // getExamQuestions for the full reasoning). Fire-and-
            // forget, same posture as the tab-switch ping below —
            // never block the exam over this.
            void axiosInstance
              .patch(`/api/exams/${examId}/session/confirm-loaded`)
              .catch((): void => { /* silent — non-critical */ });
          }
        } else {
          setLoadError('Failed to load exam questions. Please contact your teacher.');
        }

      } catch (thrown: unknown) {
        if (cancelled) return;
        const status = extractAxiosStatus(thrown);

        // 409 — already submitted, redirect to result
        if (status === 409) {
          const data = extractAxiosData<AlreadySubmittedResponse>(thrown);
          if (
            data !== null &&
            data.already_submitted === true &&
            data.result !== undefined
          ) {
            localStorage.removeItem(examStorageKeys.answers(examId, owner));
            localStorage.removeItem(examStorageKeys.questionIndex(examId, owner));
            localStorage.removeItem(examStorageKeys.timeRemaining(examId, owner));
            onSubmitSuccessRef.current(data.result);
          } else {
            setLoadError(
              'You have already completed this exam. ' +
              'Please return to the lobby to see your available exams.'
            );
          }
          return;
        }

        setLoadError(extractMessage(thrown));

      } finally {
        if (!cancelled) setIsLoadingQuestions(false);
      }
    };

    void loadQuestions();
    return (): void => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);


  // ================================================================
  //  SERVER AUTOSAVE
  //
  //  Sends the full answer set to the server shortly after every
  //  change, and retries on a timer if a save failed. This means:
  //    - a dead terminal loses at most a few seconds of work; the
  //      student logs in on another PC and their answers come back
  //    - if the final submit arrives late, the server grades these
  //      saved answers instead of rejecting the exam
  //  Failures are silent: answers are still in localStorage.
  // ================================================================

  const saveAnswersToServer = useCallback(async (): Promise<void> => {
    if (questions.length === 0) return;
    if (isSavingRef.current || isSubmittingRef.current || isSubmitted) return;
    if (autosaveStoppedRef.current) return;

    const snapshot = JSON.stringify(answers);
    if (snapshot === lastSavedRef.current) return;

    isSavingRef.current = true;
    try {
      const payload: StudentAnswer[] = Object.entries(answers).map(
        ([questionIdStr, chosenOption]: [string, AnswerOption]): StudentAnswer => ({
          question_id  : Number(questionIdStr),
          chosen_option: chosenOption,
        })
      );
      const res = await axiosInstance.patch(`/api/exams/${examId}/session/answers`, { answers: payload });
      lastSavedRef.current = snapshot;
      applyServerSeconds(readSeconds(res.data));
    } catch (thrown: unknown) {
      // 409 = time is up or session closed: stop trying.
      // 404 = backend without the autosave route yet: stop trying.
      const status = extractAxiosStatus(thrown);
      if (status === 409 || status === 404) autosaveStoppedRef.current = true;
      if (status === 409) applyServerSeconds(readSeconds(extractAxiosData(thrown)));
      // Anything else (network, 500) is retried by the interval below.
    } finally {
      isSavingRef.current = false;
    }
  }, [answers, examId, isSubmitted, questions.length, applyServerSeconds]);

  // Save shortly after each change
  useEffect((): (() => void) => {
    const id = window.setTimeout((): void => { void saveAnswersToServer(); }, AUTOSAVE_DEBOUNCE_MS);
    return (): void => { window.clearTimeout(id); };
  }, [saveAnswersToServer]);

  // Safety net: retry periodically in case a save failed
  useEffect((): (() => void) => {
    const id = window.setInterval((): void => { void saveAnswersToServer(); }, AUTOSAVE_RETRY_MS);
    return (): void => { window.clearInterval(id); };
  }, [saveAnswersToServer]);


  // ================================================================
  //  TIME RESYNC
  //  Asks the server how much time is left every minute and whenever
  //  the student returns to this tab, so the countdown can't drift.
  // ================================================================

  const resyncTime = useCallback(async (): Promise<void> => {
    if (questions.length === 0 || isSubmitted || timeSyncStoppedRef.current) return;
    try {
      const res = await axiosInstance.get(`/api/exams/${examId}/session/time`);
      applyServerSeconds(readSeconds(res.data));
    } catch (thrown: unknown) {
      // 404 = older backend without this route: keep the local countdown
      if (extractAxiosStatus(thrown) === 404) timeSyncStoppedRef.current = true;
    }
  }, [examId, isSubmitted, questions.length, applyServerSeconds]);

  useEffect((): (() => void) => {
    const id = window.setInterval((): void => { void resyncTime(); }, TIME_RESYNC_MS);
    const onVisible = (): void => { if (document.visibilityState === 'visible') void resyncTime(); };
    document.addEventListener('visibilitychange', onVisible);
    return (): void => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [resyncTime]);


  // ================================================================
  //  IMPROVEMENT 3 — TAB-SWITCH TRACKING
  //
  //  Fires on every visibilitychange to 'hidden'.
  //  Two things happen:
  //    1. Local counter increments immediately for display.
  //    2. Fire-and-forget PATCH to the server so the session
  //       row is updated. Non-critical — no error handling.
  //
  //  The handler is skipped if the exam is already submitted
  //  to avoid spurious increments after navigation.
  // ================================================================

  useEffect((): (() => void) => {
    const handleVisibility = (): void => {
      // Only track when the tab becomes hidden, not when it returns
      if (document.visibilityState !== 'hidden') return;

      // Skip if already submitted or submitting
      if (isSubmittingRef.current || isSubmitted) return;

      // Increment local display counter
      setTabSwitches((prev) => prev + 1);

      // Fire-and-forget server update — non-critical
      void axiosInstance
        .patch(`/api/exams/${examId}/session/tab-switch`)
        .catch((): void => { /* silent — never block the exam */ });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [examId, isSubmitted]);


  // ================================================================
  //  DERIVED VALUES
  // ================================================================

  const totalQuestions: number = questions.length;

  const currentQuestion: Question | null =
    questions.length > 0 && currentIndex < questions.length
      ? (questions[currentIndex] ?? null)
      : null;

  const answeredCount: number   = Object.keys(answers).length;
  const durationSeconds: number = durationMinutes * 60;


  // ================================================================
  //  ACTIONS
  // ================================================================

  const selectAnswer = useCallback(
    (questionId: number, option: AnswerOption): void => {
      setAnswers((prev: AnswerMap): AnswerMap => ({
        ...prev,
        [String(questionId)]: option,
      }));
    },
    [setAnswers]
  );

  const navigateTo = useCallback(
    (index: number): void => {
      if (index >= 0 && index < questions.length) setCurrentIndex(index);
    },
    [questions.length, setCurrentIndex]
  );

  const nextQuestion = useCallback((): void => {
    setCurrentIndex((prev: number): number =>
      prev < questions.length - 1 ? prev + 1 : prev
    );
  }, [questions.length, setCurrentIndex]);

  const prevQuestion = useCallback((): void => {
    setCurrentIndex((prev: number): number => (prev > 0 ? prev - 1 : prev));
  }, [setCurrentIndex]);

  const toggleFlag = useCallback((questionId: number): void => {
    setFlaggedIds((prev: Set<number>): Set<number> => {
      const next = new Set<number>(prev);
      if (next.has(questionId)) { next.delete(questionId); } else { next.add(questionId); }
      return next;
    });
  }, []);

  const clearSession = useCallback((): void => {
    removeAnswerKey();
    removeIndexKey();
    localStorage.removeItem(examStorageKeys.timeRemaining(examId, owner));
  }, [removeAnswerKey, removeIndexKey, examId, owner]);


  // ── submitExam ───────────────────────────────────────────────
  // Always sends the LATEST answers (answersRef), retries network /
  // server errors automatically, and reports what kind of failure it
  // was so the page can show the right message.

  const submitExam = useCallback(async (): Promise<void> => {
    if (isSubmittingRef.current || isSubmitted) return;
    isSubmittingRef.current = true;

    pauseTimerRef.current();
    setIsSubmitting(true);
    setSubmitError(null);

    const payload: StudentAnswer[] = Object.entries(answersRef.current).map(
      ([questionIdStr, chosenOption]: [string, AnswerOption]): StudentAnswer => ({
        question_id  : Number(questionIdStr),
        chosen_option: chosenOption,
      })
    );

    const fail = (message: string, kind: SubmitErrorKind): void => {
      setSubmitError(message);
      onSubmitErrorRef.current(message, kind);
    };

    try {
      for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt++) {
        try {
          const response = await axiosInstance.post<ExamSubmitResponse>(
            `/api/exams/${examId}/submit`,
            { answers: payload },
            { timeout: SUBMIT_TIMEOUT_MS }
          );

          if (response.data.success) {
            const examResult = response.data.result;
            setResult(examResult);
            setIsSubmitted(true);
            clearSession();
            onSubmitSuccessRef.current(examResult);
          } else {
            fail(response.data.message || 'The server did not accept the submission. Please try again.', 'retryable');
          }
          return;

        } catch (thrown: unknown) {
          const status = extractAxiosStatus(thrown);

          // Network error, timeout, or server error: try again shortly
          const transient = status === null || status >= 500 || status === 408 || status === 429;
          if (transient && attempt < SUBMIT_ATTEMPTS) {
            await sleep(1500 * attempt);
            continue;
          }

          // Old backend: rejected as time-expired
          if (status === 403) {
            const data = extractAxiosData<SessionExpiredResponse>(thrown);
            if (data?.code === 'SESSION_EXPIRED') {
              clearSession();
              setIsSubmitted(true);   // Block any retry attempt
              fail(data.message ?? 'Your exam time has expired. This submission was rejected.', 'expired');
              return;
            }
          }

          // Already submitted (e.g. timer and button fired together)
          if (status === 409) {
            const data = extractAxiosData<AlreadySubmittedResponse>(thrown);
            if (data !== null && data.result !== undefined) {
              setResult(data.result);
              setIsSubmitted(true);
              clearSession();
              onSubmitSuccessRef.current(data.result);
              return;
            }
          }

          if (status === 404) {
            fail(
              'This paper has been closed by the exam officer, so it can\'t be submitted right now. ' +
              'Your answers are saved. Please call the invigilator.',
              'closed'
            );
            return;
          }
          if (status === 403 || status === 400) {
            fail(extractMessage(thrown), 'blocked');
            return;
          }
          fail(extractMessage(thrown), 'retryable');
          return;
        }
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [examId, isSubmitted, clearSession]);


  // ================================================================
  //  RETURN
  // ================================================================

  return {
    isLoadingQuestions,
    loadError,
    questions,
    totalQuestions,
    currentQuestion,
    currentIndex,
    answers,
    answeredCount,
    flaggedIds,
    isSubmitting,
    isSubmitted,
    submitError,
    result,
    wasRestored,
    durationSeconds,
    startedAt,
    timeSync,
    tabSwitches,
    selectAnswer,
    navigateTo,
    nextQuestion,
    prevQuestion,
    toggleFlag,
    submitExam,
    clearSession,
  };
}

export default useExamSession;