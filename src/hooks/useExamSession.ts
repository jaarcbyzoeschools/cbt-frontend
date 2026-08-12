// ================================================================
//  CBT SYSTEM — EXAM SESSION ORCHESTRATION HOOK
//  File    : src/hooks/useExamSession.ts
//


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

export interface UseExamSessionConfig {
  examId          : number;
  onSubmitSuccess : (result: ExamResult) => void;
  onSubmitError   : (message: string) => void;
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
  };
}


// ── Helpers ──────────────────────────────────────────────────────

function extractMessage(thrown: unknown): string {
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

  // Improvement 3: tab-switch counter
  const [tabSwitches, setTabSwitches] = useState<number>(0);

  // Persistent state (crash recovery)
  const [currentIndex, setCurrentIndex, removeIndexKey] =
    useLocalStorage<number>(examStorageKeys.questionIndex(examId), 0);

  const [answers, setAnswers, removeAnswerKey] =
    useLocalStorage<AnswerMap>(examStorageKeys.answers(examId), {});

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

  useEffect((): void => { onSubmitSuccessRef.current = onSubmitSuccess; }, [onSubmitSuccess]);
  useEffect((): void => { onSubmitErrorRef.current   = onSubmitError;   }, [onSubmitError]);
  useEffect((): void => { pauseTimerRef.current      = pauseTimer;      }, [pauseTimer]);


  // ================================================================
  //  QUESTION LOADING
  // ================================================================

  useEffect((): void => {
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

        if (response.data.success) {
          // Improvement 1: Server returns questions in the stable
          // shuffled order stored in exam_sessions.question_order.
          // We just use them directly — no client shuffle needed.
          setQuestions(response.data.questions);
          setDurationMinutes(response.data.exam.duration_minutes);

          // Improvement 3: Read tab_switches from the session
          // object so crash-recovered students see the correct
          // count immediately rather than starting from 0.
          if (response.data.session !== undefined) {
            setTabSwitches(response.data.session.tab_switches);
          }
        } else {
          setLoadError('Failed to load exam questions. Please contact your teacher.');
        }

      } catch (thrown: unknown) {
        const status = extractAxiosStatus(thrown);

        // 409 — already submitted, redirect to result
        if (status === 409) {
          const data = extractAxiosData<AlreadySubmittedResponse>(thrown);
          if (
            data !== null &&
            data.already_submitted === true &&
            data.result !== undefined
          ) {
            localStorage.removeItem(examStorageKeys.answers(examId));
            localStorage.removeItem(examStorageKeys.questionIndex(examId));
            localStorage.removeItem(examStorageKeys.timeRemaining(examId));
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
        setIsLoadingQuestions(false);
      }
    };

    void loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);


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
    localStorage.removeItem(examStorageKeys.timeRemaining(examId));
  }, [removeAnswerKey, removeIndexKey, examId]);


  // ── submitExam ───────────────────────────────────────────────
  // Zero arguments — backend is fully authoritative for grading.
  // Handles three error cases:
  //   403 + SESSION_EXPIRED — time window exceeded (Improvement 2)
  //   409                   — already submitted (race condition)
  //   all others            — network/server error

  const submitExam = useCallback(async (): Promise<void> => {
    if (isSubmittingRef.current || isSubmitted) return;
    isSubmittingRef.current = true;

    pauseTimerRef.current();
    setIsSubmitting(true);
    setSubmitError(null);

    const payload: StudentAnswer[] = Object.entries(answers).map(
      ([questionIdStr, chosenOption]: [string, AnswerOption]): StudentAnswer => ({
        question_id  : Number(questionIdStr),
        chosen_option: chosenOption,
      })
    );

    try {
      const response = await axiosInstance.post<ExamSubmitResponse>(
        `/api/exams/${examId}/submit`,
        { answers: payload }
      );

      if (response.data.success) {
        const examResult = response.data.result;
        setResult(examResult);
        setIsSubmitted(true);
        clearSession();
        onSubmitSuccessRef.current(examResult);
      } else {
        const message = 'Submission was rejected by the server. Please try again.';
        setSubmitError(message);
        onSubmitErrorRef.current(message);
      }

    } catch (thrown: unknown) {
      const status = extractAxiosStatus(thrown);

      // ── IMPROVEMENT 2: SESSION_EXPIRED ────────────────────────
      // 403 with code SESSION_EXPIRED means the server rejected
      // the submission because elapsed time > duration + grace.
      // We clear the session (student cannot retry) and surface
      // the server's message so the teacher can investigate.
      if (status === 403) {
        const data = extractAxiosData<SessionExpiredResponse>(thrown);
        if (data?.code === 'SESSION_EXPIRED') {
          clearSession();
          setIsSubmitted(true);   // Block any retry attempt
          const message = data.message ?? 'Your exam time has expired. This submission was rejected.';
          setSubmitError(message);
          onSubmitErrorRef.current(message);
          return;
        }
      }

      // ── Already submitted (race: timer + manual both fired) ───
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

      // ── Generic error ─────────────────────────────────────────
      const message = extractMessage(thrown);
      setSubmitError(message);
      onSubmitErrorRef.current(message);

    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [answers, examId, isSubmitted, clearSession]);


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