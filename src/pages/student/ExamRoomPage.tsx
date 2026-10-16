// ================================================================
//  CBT SYSTEM — EXAM ROOM PAGE
//
//  THIS REVISION — handleSubmitError now auto-navigates back to
//  the dashboard after a definitive SESSION_EXPIRED rejection,
//  instead of leaving the student stranded on a frozen 00:00
//  screen with no path forward. See the comment inside
//  handleSubmitError for why this was actually happening.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
}                        from 'react';
import {
  useNavigate,
  useParams,
}                        from 'react-router-dom';
import {
  Flag,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertCircle,
  Loader2,
  X,
  WifiOff,
  RotateCcw,
  CheckCircle,
  ShieldAlert,
  Eye,
  EyeOff,
}                        from 'lucide-react';

import { useExamSession }  from '../../hooks/useExamSession';
import { useAuth }         from '../../context/AuthContext';
import type { Question }   from '../../types/exam';
import { formatCountdown } from '../../utils/timeFormatter';


// ================================================================
//  OPTION DEFS
// ================================================================

interface OptionDef {
  key  : 'option_a' | 'option_b' | 'option_c' | 'option_d';
  label: 'A' | 'B' | 'C' | 'D';
}

const OPTION_DEFS: ReadonlyArray<OptionDef> = [
  { key: 'option_a', label: 'A' },
  { key: 'option_b', label: 'B' },
  { key: 'option_c', label: 'C' },
  { key: 'option_d', label: 'D' },
] as const;

function getOptionText(q: Question, key: OptionDef['key']): string {
  switch (key) {
    case 'option_a': return q.option_a;
    case 'option_b': return q.option_b;
    case 'option_c': return q.option_c;
    case 'option_d': return q.option_d;
  }
}


// ================================================================
//  WALL-CLOCK TIMER HELPERS
// ================================================================

const lsKey = {
  startedAt : (id: number): string => `exam_${id}_startedAt`,
  durationMs: (id: number): string => `exam_${id}_durationMs`,
};

function initWallClockTimer(examId: number, durationSeconds: number, serverStartedAtIso: string | null): void {
  if (durationSeconds <= 0) return;
  localStorage.setItem(lsKey.durationMs(examId), String(durationSeconds * 1000));

  // Reconcile against the SERVER's real session start whenever it's
  // available — never just "initialize if empty." A student on a
  // fresh terminal (or with cleared/stale localStorage) would
  // otherwise get a full-duration countdown reset on their screen
  // while the server's actual clock, anchored to the true original
  // start, keeps running underneath. That mismatch is what caused
  // a legitimate on-time submission to be rejected as expired.
  if (serverStartedAtIso !== null) {
    const serverStartedAtMs = new Date(serverStartedAtIso).getTime();
    if (!isNaN(serverStartedAtMs)) {
      localStorage.setItem(lsKey.startedAt(examId), String(serverStartedAtMs));
      return;
    }
  }

  // Server didn't provide a value (older backend, or a transient
  // load issue) — fall back to the previous behavior: only set a
  // local start time if one doesn't already exist.
  const existingStart = localStorage.getItem(lsKey.startedAt(examId));
  if (existingStart === null) {
    localStorage.setItem(lsKey.startedAt(examId), String(Date.now()));
  }
}

function computeSecondsRemaining(examId: number, fallbackSeconds: number): number {
  const startedAt  = parseInt(localStorage.getItem(lsKey.startedAt(examId))  ?? '0', 10);
  const durationMs = parseInt(localStorage.getItem(lsKey.durationMs(examId)) ?? '0', 10);
  if (startedAt <= 0 || durationMs <= 0) {
    return fallbackSeconds > 0 ? fallbackSeconds : 3600;
  }
  const remainingMs = durationMs - (Date.now() - startedAt);
  if (!isFinite(remainingMs)) return fallbackSeconds > 0 ? fallbackSeconds : 3600;
  return Math.max(0, Math.floor(remainingMs / 1000));
}

function clearWallClockTimer(examId: number): void {
  localStorage.removeItem(lsKey.startedAt(examId));
  localStorage.removeItem(lsKey.durationMs(examId));
}


// ================================================================
//  BACK-NAVIGATION WARNING OVERLAY
// ================================================================

function BackNavigationWarning(): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-[100] bg-[#0F172A]/90 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-[#FCA5A5] rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center space-y-5">
        <div className="w-20 h-20 rounded-2xl bg-[#FEF2F2] border-2 border-[#FCA5A5] flex items-center justify-center mx-auto">
          <ShieldAlert size={36} className="text-[#DC2626]" />
        </div>
        <div>
          <h2 className="text-[#0F172A] text-xl font-bold">Navigation Blocked</h2>
          <p className="text-[#374151] text-base leading-relaxed mt-2">
            Leaving the exam page automatically submits your answers.
            Your exam is being submitted now…
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-[#DC2626] text-base font-semibold">
          <Loader2 size={18} className="animate-spin" />
          Submitting exam…
        </div>
      </div>
    </div>
  );
}


// ================================================================
//  SESSION EXPIRED BANNER
//  Shown as a permanent non-dismissible error when the server
//  rejects the submission as time-expired (Improvement 2).
// ================================================================

function SessionExpiredBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex items-start gap-4 bg-[#FEF2F2] border-b-2 border-[#FCA5A5] px-5 py-4">
      <div className="w-10 h-10 rounded-xl bg-[#DC2626] flex items-center justify-center flex-shrink-0">
        <ShieldAlert size={20} className="text-white" />
      </div>
      <div className="flex-1">
        <p className="text-[#991B1B] text-base font-bold">Submission Rejected — Time Expired</p>
        <p className="text-[#991B1B] text-sm mt-0.5 leading-relaxed">{message}</p>
        <p className="text-[#991B1B] text-sm mt-1 font-medium">
          Please inform your teacher. Your progress has been saved. Returning to your dashboard shortly…
        </p>
      </div>
    </div>
  );
}


// ================================================================
//  SUBMIT CONFIRMATION DIALOG
// ================================================================

function SubmitDialog({
  totalQuestions,
  answeredCount,
  onConfirm,
  onCancel,
  isSubmitting,
}: {
  totalQuestions: number;
  answeredCount : number;
  onConfirm     : () => void;
  onCancel      : () => void;
  isSubmitting  : boolean;
}): React.JSX.Element {
  const unanswered = totalQuestions - answeredCount;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0F172A]/60" aria-hidden="true" />
      <div
        className = "fixed inset-0 z-50 flex items-center justify-center p-4"
        role      = "dialog"
        aria-modal= "true"
      >
        <div className="w-full max-w-sm bg-white border border-[#D1D9E0] rounded-2xl shadow-2xl overflow-hidden">

          <div className="px-6 py-5 border-b border-[#D1D9E0] bg-[#F7F8FA]">
            <h2 className="text-[#0F172A] text-xl font-bold">Submit Exam?</h2>
          </div>

          <div className="px-6 py-5 space-y-4">
            {unanswered > 0 ? (
              <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-4 py-3">
                <AlertCircle size={17} className="text-[#92400E] flex-shrink-0 mt-0.5" />
                <p className="text-[#92400E] text-base leading-relaxed">
                  You have <strong>{unanswered}</strong>{' '}
                  unanswered {unanswered === 1 ? 'question' : 'questions'}.
                  These will be marked incorrect.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 bg-[#F0FDF4] border border-[#86EFAC] rounded-xl px-4 py-3">
                <CheckCircle size={17} className="text-[#166534] flex-shrink-0 mt-0.5" />
                <p className="text-[#166534] text-base">
                  All {totalQuestions} questions answered. Ready to submit.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-xl py-4">
                <p className="text-3xl font-bold text-[#166534] tabular-nums">{answeredCount}</p>
                <p className="text-[#6B7280] text-sm mt-1">Answered</p>
              </div>
              <div className={`border rounded-xl py-4 ${unanswered > 0 ? 'bg-[#FFFBEB] border-[#FCD34D]' : 'bg-[#F7F8FA] border-[#D1D9E0]'}`}>
                <p className={`text-3xl font-bold tabular-nums ${unanswered > 0 ? 'text-[#92400E]' : 'text-[#9CA3AF]'}`}>
                  {unanswered}
                </p>
                <p className="text-[#6B7280] text-sm mt-1">Unanswered</p>
              </div>
            </div>

            <p className="text-[#9CA3AF] text-sm text-center">
              Once submitted, your answers cannot be changed.
            </p>
          </div>

          <div className="flex items-center gap-3 px-6 pb-6">
            <button
              type      = "button"
              onClick   = {onCancel}
              disabled  = {isSubmitting}
              className = "flex-1 py-3 rounded-xl text-base font-semibold text-[#374151] bg-[#F7F8FA] border border-[#D1D9E0] hover:bg-[#F0F2F5] transition-colors disabled:opacity-50"
            >
              Continue Exam
            </button>
            <button
              type      = "button"
              onClick   = {onConfirm}
              disabled  = {isSubmitting}
              className = "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-base font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
            >
              {isSubmitting
                ? <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                : <><Send size={16} /> Submit Now</>
              }
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


// ================================================================
//  MAIN COMPONENT
// ================================================================

export default function ExamRoomPage(): React.JSX.Element {
  const { examId: examIdParam } = useParams<{ examId: string }>();
  const navigate                = useNavigate();
  const { student }             = useAuth();

  const examId = parseInt(examIdParam ?? '0', 10);

  const [showSubmitDialog,  setShowSubmitDialog]  = useState<boolean>(false);
  const [submitErrorBanner, setSubmitErrorBanner] = useState<string | null>(null);
  const [showBackWarning,   setShowBackWarning]   = useState<boolean>(false);

  // Improvement 2: tracks whether the current error is a
  // SESSION_EXPIRED rejection — those cannot be dismissed
  const isExpiredErrorRef = useRef<boolean>(false);

  // Wall-clock timer display state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const stored = computeSecondsRemaining(examId, 0);
    return stored > 0 ? stored : 3600;
  });

  // Refs
  const hasNavigatedRef    = useRef<boolean>(false);
  const isSubmittingRef    = useRef<boolean>(false);
  const timerIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationSecondsRef = useRef<number>(0);
  const timerReadyRef      = useRef<boolean>(false);


  // ── Stable callbacks ─────────────────────────────────────────

  const handleSubmitSuccess = useCallback((result: unknown): void => {
    if (!hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      clearWallClockTimer(examId);
      navigate('/student/lobby', { replace: true, state: { result } });
    }
  }, [examId, navigate]);

  const handleSubmitError = useCallback((message: string): void => {
    const isExpired =
      message.toLowerCase().includes('expired') ||
      message.toLowerCase().includes('rejected');
    isExpiredErrorRef.current = isExpired;
    setSubmitErrorBanner(message);
    setShowSubmitDialog(false);
    setShowBackWarning(false);
    isSubmittingRef.current = false;

    // A definitive SESSION_EXPIRED rejection means there is nothing
    // left the student can do on this page — the countdown interval
    // is already stopped by this point (cleared right before
    // submitExam() was called), so without this she'd be stuck on a
    // frozen 00:00 screen indefinitely, with no path forward except
    // manually navigating away herself. Give her a few seconds to
    // actually read why, then leave automatically.
    if (isExpired && !hasNavigatedRef.current) {
      setTimeout((): void => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          clearWallClockTimer(examId);
          navigate('/student/lobby', { replace: true });
        }
      }, 6000);
    }
  }, [examId, navigate]);


  // ── useExamSession ───────────────────────────────────────────

  const session = useExamSession({
    examId,
    pauseTimer      : (): void => { /* wall-clock doesn't pause */ },
    onSubmitSuccess : handleSubmitSuccess,
    onSubmitError   : handleSubmitError,
  });

  const {
    questions,
    currentQuestion,
    currentIndex,
    totalQuestions,
    answers,
    answeredCount,
    flaggedIds,
    durationSeconds,
    startedAt,
    isLoadingQuestions,
    loadError,
    wasRestored,
    isSubmitting,
    isSubmitted,
    submitExam,
    selectAnswer,
    toggleFlag,
    prevQuestion,
    nextQuestion,
    navigateTo,
    tabSwitches,     
  } = session;

  const currentAnswerKey: string | undefined =
    currentQuestion !== null
      ? answers[String(currentQuestion.question_id)]
      : undefined;


  // ── Keep durationSeconds ref current ─────────────────────────

  useEffect((): void => {
    if (durationSeconds > 0) {
      durationSecondsRef.current = durationSeconds;
    }
  }, [durationSeconds]);


  // ── Timer init ───────────────────────────────────────────────

  useEffect((): void => {
    if (durationSeconds <= 0 || questions.length === 0) return;
    if (timerReadyRef.current) return;
    timerReadyRef.current = true;

    initWallClockTimer(examId, durationSeconds, startedAt);

    const remaining = computeSecondsRemaining(examId, durationSeconds);
    setSecondsRemaining(remaining);
  }, [examId, durationSeconds, questions.length, startedAt]);


  // ── Countdown interval ───────────────────────────────────────

  useEffect((): (() => void) => {
    if (durationSeconds <= 0) return (): void => undefined;

    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval((): void => {
      const remaining = computeSecondsRemaining(examId, durationSecondsRef.current);
      setSecondsRemaining(remaining);

      if (remaining <= 0 && !isSubmittingRef.current && !hasNavigatedRef.current) {
        isSubmittingRef.current = true;
        if (timerIntervalRef.current !== null) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        void submitExam();
      }
    }, 1000);

    return (): void => {
      if (timerIntervalRef.current !== null) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  
  }, [examId, durationSeconds > 0]);


  // ── Page visibility resync (timer only) ─────────────────────
  // Note: tab-switch TRACKING is done inside useExamSession.
  // This effect only resyncs the timer display on tab return.

  useEffect((): (() => void) => {
    const handler = (): void => {
      if (document.visibilityState !== 'visible') return;
      const remaining = computeSecondsRemaining(examId, durationSecondsRef.current);
      setSecondsRemaining(remaining);
      if (remaining <= 0 && !isSubmittingRef.current && !hasNavigatedRef.current) {
        isSubmittingRef.current = true;
        void submitExam();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return (): void => document.removeEventListener('visibilitychange', handler);
  }, [examId, submitExam]);


  // ── Back-button lock ─────────────────────────────────────────

  useEffect((): (() => void) => {
    window.history.pushState({ examGuard: true }, '', window.location.href);

    const handler = (): void => {
      if (isSubmittingRef.current || hasNavigatedRef.current) return;
      window.history.pushState({ examGuard: true }, '', window.location.href);
      setShowBackWarning(true);
      isSubmittingRef.current = true;
      setTimeout((): void => { void submitExam(); }, 800);
    };

    window.addEventListener('popstate', handler);
    return (): void => window.removeEventListener('popstate', handler);
  }, [submitExam]);


  // ── Beforeunload ─────────────────────────────────────────────

  useEffect((): (() => void) => {
    const handler = (e: BeforeUnloadEvent): string => {
      if (isSubmitted || hasNavigatedRef.current) return '';
      e.preventDefault();
      const msg = 'Leaving this page will submit your exam. Are you sure?';
      e.returnValue = msg;
      return msg;
    };
    window.addEventListener('beforeunload', handler);
    return (): void => window.removeEventListener('beforeunload', handler);
  }, [isSubmitted]);


  // ── Invalid examId ───────────────────────────────────────────

  useEffect((): void => {
    if (isNaN(examId) || examId <= 0) {
      navigate('/student/lobby', { replace: true });
    }
  }, [examId, navigate]);


  // ── Timer colour ─────────────────────────────────────────────

  type ColourState = 'normal' | 'warning' | 'danger' | 'expired';
  const colourState: ColourState =
    secondsRemaining <= 0   ? 'expired' :
    secondsRemaining <= 120 ? 'danger'  :
    secondsRemaining <= 600 ? 'warning' :
    'normal';

  const timerTextCls =
    colourState === 'danger'  ? 'text-[#DC2626] animate-pulse' :
    colourState === 'warning' ? 'text-[#92400E]'               :
    colourState === 'expired' ? 'text-[#DC2626]'               :
    'text-[#1D4ED8]';

  const timerBgCls =
    colourState === 'danger'  ? 'bg-[#FEF2F2] border-[#FCA5A5]' :
    colourState === 'warning' ? 'bg-[#FFFBEB] border-[#FCD34D]' :
    colourState === 'expired' ? 'bg-[#FEF2F2] border-[#FCA5A5]' :
    'bg-[#EFF6FF] border-[#BFDBFE]';


  // ================================================================
  //  LOADING STATE
  // ================================================================

  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center gap-5">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-white/10" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#1D4ED8] animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-white text-lg font-semibold">Loading exam…</p>
          <p className="text-white/50 text-base mt-1">Please do not close this window.</p>
        </div>
      </div>
    );
  }


  // ================================================================
  //  LOAD ERROR STATE
  // ================================================================

  if (loadError !== null) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="w-20 h-20 rounded-2xl bg-[#FEF2F2] border-2 border-[#FCA5A5] flex items-center justify-center">
          <WifiOff size={36} className="text-[#DC2626]" />
        </div>
        <div>
          <h2 className="text-[#0F172A] text-2xl font-bold">Failed to Load Exam</h2>
          <p className="text-[#374151] text-base mt-2 max-w-xs leading-relaxed">{loadError}</p>
        </div>
        <div className="flex gap-3">
          <button
            type      = "button"
            onClick   = {() => navigate('/student/lobby', { replace: true })}
            className = "flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-[#D1D9E0] text-[#374151] text-base font-semibold hover:border-[#9CA3AF] transition-colors"
          >
            <ChevronLeft size={16} />
            Back to Lobby
          </button>
          <button
            type      = "button"
            onClick   = {() => window.location.reload()}
            className = "flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-base font-bold transition-colors"
          >
            <RotateCcw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }


  // ================================================================
  //  MAIN EXAM RENDER
  // ================================================================

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col select-none">

      {showBackWarning && <BackNavigationWarning />}

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3 px-4 lg:px-6 h-16 bg-white border-b border-[#D1D9E0] flex-shrink-0 sticky top-0 z-20 shadow-sm">

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#1D4ED8] flex items-center justify-center flex-shrink-0">
            <Eye size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[#0F172A] text-base font-bold truncate">
              {/* {student?.class_name ?? ''} */}
              
               DLB · Exam in Progress
            </p>
            <p className="text-[#6B7280] text-sm">
              Question {currentIndex + 1} of {totalQuestions}
            </p>
          </div>
        </div>

        {/* Countdown */}
        <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 transition-all ${timerBgCls}`}>
          <span className={`font-mono text-xl font-bold tabular-nums tracking-wider ${timerTextCls}`}>
            {formatCountdown(secondsRemaining)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {tabSwitches > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFBEB] border border-[#FCD34D]">
              <EyeOff size={14} className="text-[#92400E] flex-shrink-0" />
              <span className="text-[#92400E] text-sm font-semibold hidden sm:block">
                {tabSwitches} tab {tabSwitches === 1 ? 'switch' : 'switches'} logged
              </span>
              {/* Mobile: just the count */}
              <span className="text-[#92400E] text-sm font-bold sm:hidden">
                {tabSwitches}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
              <span className="text-[#6B7280] text-sm font-medium hidden sm:block">Auto-saved</span>
            </div>
          )}
        </div>
      </header>


      {/* ── RECOVERY BANNER ─────────────────────────────────── */}
      {wasRestored && (
        <div className="flex items-center gap-3 bg-[#EFF6FF] border-b border-[#BFDBFE] px-5 py-3">
          <RotateCcw size={15} className="text-[#1D4ED8] flex-shrink-0" />
          <p className="text-[#1D4ED8] text-sm font-medium">
            Session restored · Your answers and remaining time have been recovered.
          </p>
        </div>
      )}


      {/* ── SECURITY BAR ────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-[#FFFBEB] border-b border-[#FCD34D] px-5 py-2.5">
        <ShieldAlert size={14} className="text-[#92400E] flex-shrink-0" />
        <p className="text-[#92400E] text-sm font-semibold">
          Leaving this page will automatically submit your exam. Stay on this page until you are done.
        </p>
      </div>


      {submitErrorBanner !== null && isExpiredErrorRef.current && (
        <SessionExpiredBanner message={submitErrorBanner} />
      )}


      {/* ── REGULAR SUBMIT ERROR ─────────────────────────────── */}
      {submitErrorBanner !== null && !isExpiredErrorRef.current && (
        <div className="flex items-center gap-3 bg-[#FEF2F2] border-b border-[#FCA5A5] px-5 py-3">
          <AlertCircle size={15} className="text-[#DC2626] flex-shrink-0" />
          <p className="text-[#DC2626] text-sm font-medium flex-1">{submitErrorBanner}</p>
          <button
            type      = "button"
            onClick   = {() => setSubmitErrorBanner(null)}
            className = "text-[#DC2626]/60 hover:text-[#DC2626] transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      )}


      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: QUESTION CANVAS ────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {currentQuestion !== null ? (
            <div className="flex-1 p-4 lg:p-6 max-w-2xl w-full mx-auto">

              {/* Index + flag */}
              <div className="flex items-center justify-between mb-5">
                <span className="text-[#6B7280] text-base">
                  Question{' '}
                  <span className="text-[#0F172A] font-bold">{currentIndex + 1}</span>
                  {' '}of{' '}
                  <span className="text-[#0F172A] font-bold">{totalQuestions}</span>
                </span>
                <button
                  type      = "button"
                  onClick   = {() => toggleFlag(currentQuestion.question_id)}
                  className = {[
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border-2',
                    flaggedIds.has(currentQuestion.question_id)
                      ? 'bg-[#FFFBEB] border-[#FCD34D] text-[#92400E]'
                      : 'bg-white border-[#D1D9E0] text-[#6B7280] hover:border-[#FCD34D] hover:text-[#92400E] hover:bg-[#FFFBEB]',
                  ].join(' ')}
                >
                  <Flag size={13} />
                  {flaggedIds.has(currentQuestion.question_id) ? 'Flagged' : 'Flag'}
                </button>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#E2E8F0] rounded-full h-2 mb-6">
                <div
                  className = "bg-[#1D4ED8] h-2 rounded-full transition-all duration-300"
                  style     = {{ width: `${((currentIndex + 1) / Math.max(totalQuestions, 1)) * 100}%` }}
                />
              </div>

              {/* Question stem */}
              <div className="bg-white border-2 border-[#D1D9E0] rounded-2xl p-6 mb-5 shadow-sm">
                <p className="text-[#0F172A] text-lg leading-relaxed font-medium">
                  {currentQuestion.question_text}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {OPTION_DEFS.map(({ key, label }) => {
                  const optionText = getOptionText(currentQuestion, key);
                  const isSelected = currentAnswerKey === label;
                  return (
                    <button
                      key       = {label}
                      type      = "button"
                      onClick   = {() => selectAnswer(currentQuestion.question_id, label)}
                      className = {[
                        'w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-100',
                        isSelected
                          ? 'border-[#1D4ED8] bg-[#EFF6FF] shadow-sm'
                          : 'border-[#D1D9E0] bg-white hover:border-[#9CA3AF] hover:bg-[#F7F8FA]',
                      ].join(' ')}
                      aria-pressed= {isSelected}
                    >
                      <div className={[
                        'w-9 h-9 rounded-full border-2 flex items-center justify-center',
                        'flex-shrink-0 mt-0.5 text-base font-bold transition-all',
                        isSelected
                          ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                          : 'border-[#D1D9E0] text-[#6B7280]',
                      ].join(' ')}>
                        {label}
                      </div>
                      <span className={[
                        'text-base leading-relaxed pt-1',
                        isSelected ? 'text-[#1D4ED8] font-semibold' : 'text-[#374151]',
                      ].join(' ')}>
                        {optionText}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[#9CA3AF] text-base">No question loaded.</p>
            </div>
          )}
        </div>


        {/* ── RIGHT: NAVIGATOR SIDEBAR ─────────────────────── */}
        <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-white border-l border-[#D1D9E0] overflow-y-auto">
          <div className="p-5 border-b border-[#D1D9E0] bg-[#F7F8FA]">
            <p className="text-[#374151] text-sm font-bold uppercase tracking-wider mb-4">
              Question Navigator
            </p>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-xl py-3">
                <p className="text-[#166534] font-bold text-2xl tabular-nums">{answeredCount}</p>
                <p className="text-[#6B7280] text-sm mt-0.5">Answered</p>
              </div>
              <div className="bg-[#F7F8FA] border border-[#D1D9E0] rounded-xl py-3">
                <p className="text-[#374151] font-bold text-2xl tabular-nums">
                  {totalQuestions - answeredCount}
                </p>
                <p className="text-[#6B7280] text-sm mt-0.5">Remaining</p>
              </div>
            </div>
            {flaggedIds.size > 0 && (
              <div className="mt-2 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl py-2.5 text-center">
                <p className="text-[#92400E] text-sm font-semibold">
                  {flaggedIds.size} Flagged for Review
                </p>
              </div>
            )}

            {/* ── IMPROVEMENT 3: Tab-switch warning in sidebar ── */}
            {tabSwitches > 0 && (
              <div className="mt-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl py-2.5 px-3 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <EyeOff size={13} className="text-[#991B1B]" />
                  <p className="text-[#991B1B] text-sm font-semibold">
                    {tabSwitches} tab {tabSwitches === 1 ? 'switch' : 'switches'} recorded
                  </p>
                </div>
                <p className="text-[#991B1B] text-xs mt-0.5">
                  Visible to your teacher
                </p>
              </div>
            )}
          </div>

          <div className="p-4 flex-1">
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, index) => {
                const isAnswered = answers[String(q.question_id)] !== undefined;
                const isFlagged  = flaggedIds.has(q.question_id);
                const isCurrent  = index === currentIndex;
                return (
                  <button
                    key       = {q.question_id}
                    type      = "button"
                    onClick   = {() => navigateTo(index)}
                    aria-label= {`Go to question ${index + 1}`}
                    className = {[
                      'w-full aspect-square rounded-xl text-sm font-bold transition-all duration-100',
                      isCurrent  ? 'ring-2 ring-[#1D4ED8] ring-offset-1' : '',
                      isFlagged  ? 'bg-[#FFFBEB] border-2 border-[#FCD34D] text-[#92400E]'  :
                      isAnswered ? 'bg-[#1D4ED8] text-white'                                  :
                                   'bg-white border-2 border-[#D1D9E0] text-[#9CA3AF] hover:border-[#9CA3AF] hover:text-[#374151]',
                    ].join(' ')}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-2">
              {[
                { cls: 'bg-[#1D4ED8]',                              label: 'Answered'   },
                { cls: 'bg-[#FFFBEB] border-2 border-[#FCD34D]',   label: 'Flagged'    },
                { cls: 'bg-white border-2 border-[#D1D9E0]',         label: 'Unanswered' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded flex-shrink-0 ${item.cls}`} />
                  <span className="text-[#6B7280] text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>


      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="flex-shrink-0 flex items-center justify-between gap-2 px-4 lg:px-6 py-4 bg-white border-t border-[#D1D9E0] shadow-sm">
        <button
          type      = "button"
          onClick   = {prevQuestion}
          disabled  = {currentIndex === 0}
          className = "flex items-center gap-2 px-5 py-3 rounded-xl text-base font-semibold text-[#374151] bg-[#F7F8FA] border border-[#D1D9E0] hover:bg-[#F0F2F5] hover:border-[#9CA3AF] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={17} />
          <span className="hidden sm:block">Previous</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[#374151] text-base font-semibold tabular-nums lg:hidden">
            {currentIndex + 1}/{totalQuestions}
          </span>
          {currentQuestion !== null && (
            <button
              type      = "button"
              onClick   = {() => toggleFlag(currentQuestion.question_id)}
              className = {[
                'lg:hidden p-2.5 rounded-xl border-2 transition-colors',
                flaggedIds.has(currentQuestion.question_id)
                  ? 'text-[#92400E] bg-[#FFFBEB] border-[#FCD34D]'
                  : 'text-[#9CA3AF] bg-white border-[#D1D9E0] hover:border-[#FCD34D] hover:text-[#92400E]',
              ].join(' ')}
            >
              <Flag size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type      = "button"
            onClick   = {nextQuestion}
            disabled  = {currentIndex === totalQuestions - 1}
            className = "flex items-center gap-2 px-5 py-3 rounded-xl text-base font-semibold text-[#374151] bg-[#F7F8FA] border border-[#D1D9E0] hover:bg-[#F0F2F5] hover:border-[#9CA3AF] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="hidden sm:block">Next</span>
            <ChevronRight size={17} />
          </button>

          <button
            type      = "button"
            onClick   = {() => setShowSubmitDialog(true)}
            disabled  = {isSubmitting || isSubmitted}
            className = "flex items-center gap-2 px-5 py-3 rounded-xl text-base font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? <Loader2 size={16} className="animate-spin" />
              : <Send size={16} />
            }
            <span className="hidden sm:block">
              {isSubmitting ? 'Submitting…' : 'Submit Exam'}
            </span>
          </button>
        </div>
      </footer>


      {/* ── SUBMIT DIALOG ────────────────────────────────────── */}
      {showSubmitDialog && (
        <SubmitDialog
          totalQuestions = {totalQuestions}
          answeredCount  = {answeredCount}
          isSubmitting   = {isSubmitting}
          onConfirm      = {(): void => { void submitExam(); }}
          onCancel       = {() => setShowSubmitDialog(false)}
        />
      )}
    </div>
  );
}