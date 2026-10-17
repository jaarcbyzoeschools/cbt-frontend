// ================================================================
//  CBT SYSTEM — EXAM RESULT PAGE
//  File    : src/pages/student/ResultPage.tsx
//  Design  : Vibrant Institutional Light Mode
//
//  Two render branches:
//
//  BRANCH A — results_visible = true (or legacy result with score)
//    Shows: circular score ring, grade band, CA/Exam breakdown
//    context if available, correct/incorrect breakdown, score bar,
//    pass threshold indicator, download slip button (Phase 4).
//
//  BRANCH B — results_visible = false
//    Shows: large checkmark confirmation, exam title, total
//    questions + questions answered, submission timestamp.
//    No score, no grade, no correct/incorrect counts.
//    Message: "Your result will be released by your principal
//    at the end of term."
//
//  Data source:
//    ExamResult passed via React Router location state from
//    ExamRoomPage. If location.state is null (direct URL
//    navigation), page redirects to /student/lobby.
// ================================================================

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  LogOut,
  BookOpen,
  BarChart3,
  Trophy,
  Lock,
  FileCheck,
}                            from 'lucide-react';

import { useAuth }           from '../../context/AuthContext';
import {
  getScoreColour,
  formatScorePercentage,
  SCORE_THRESHOLDS,
}                            from '../../utils/scoreColour';
import { formatSubmittedAt } from '../../utils/timeFormatter';
import type { ExamResult }   from '../../types/exam';


// ── LOCATION STATE ────────────────────────────────────────────────

interface ResultLocationState {
  result    : ExamResult;
  examTitle?: string;
}


// ── CIRCULAR SCORE RING ───────────────────────────────────────────
// SVG arc showing the score as a filled ring around the central %.

interface CircleScoreProps {
  score     : number;
  strokeHex : string;
}

function CircleScore({ score, strokeHex }: CircleScoreProps): React.JSX.Element {
  const radius       = 52;
  const circumference = 2 * Math.PI * radius;
  const clamped      = Math.min(100, Math.max(0, score));
  const offset       = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        {/* Track */}
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#D7F2E0" strokeWidth="9" />
        {/* Progress arc */}
        <circle
          cx             = "60" cy="60"
          r              = {radius}
          fill           = "none"
          stroke         = {strokeHex}
          strokeWidth    = "9"
          strokeLinecap  = "round"
          strokeDasharray= {circumference}
          strokeDashoffset={offset}
          style          = {{ transition: 'stroke-dashoffset 1.2s ease-in-out' }}
        />
      </svg>
      {/* Central text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[#0B1F14] text-3xl font-bold tabular-nums leading-none">
          {clamped.toFixed(0)}
        </span>
        <span className="text-[#6B8479] text-sm font-medium mt-0.5">%</span>
      </div>
    </div>
  );
}


// ── SCORE BAR ─────────────────────────────────────────────────────

function ScoreBar({
  correct, total, strokeHex,
}: {
  correct  : number;
  total    : number;
  strokeHex: string;
}): React.JSX.Element {
  const pct = total > 0 ? (correct / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-sm text-[#6B8479] mb-2">
        <span><strong className="text-[#0B1F14]">{correct}</strong> correct</span>
        <span><strong className="text-[#0B1F14]">{total - correct}</strong> incorrect</span>
      </div>
      <div className="w-full h-3 bg-[#F4FBF6] rounded-full overflow-hidden border border-[#D7F2E0]">
        <div
          className = "h-full rounded-full transition-all duration-1000"
          style     = {{ width: `${pct}%`, backgroundColor: strokeHex }}
        />
      </div>
    </div>
  );
}


// ── STROKE COLOUR MAP ─────────────────────────────────────────────
// Maps score bands to hex colours for SVG ring and bar.
// Deliberately distinct from the brand green — these are
// semantic performance indicators, not brand elements.

const STROKE_COLOURS: Record<string, string> = {
  distinction : '#15803D',   // green
  credit      : '#0369A1',   // blue-teal
  pass        : '#92400E',   // amber
  fail        : '#DC2626',   // red
};


// ================================================================
//  BRANCH A — Full Score Display
// ================================================================

function FullResultView({
  result, examTitle, onReturnToLobby, onLogOut,
}: {
  result         : ExamResult;
  examTitle      : string;
  onReturnToLobby: () => void;
  onLogOut       : () => void;
}): React.JSX.Element {
  const colour     = getScoreColour(result.score_percentage);
  const incorrect  = result.total_questions - result.correct_answers;
  const strokeHex  = STROKE_COLOURS[colour.band] ?? '#0369A1';
  const isPassing  = result.score_percentage >= SCORE_THRESHOLDS.pass;

  return (
    <div className="space-y-4">

      {/* ── Score hero card ────────────────────────────────── */}
      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

        {/* Card top accent bar */}
        <div
          className = "h-1.5 w-full"
          style     = {{ backgroundColor: strokeHex }}
        />

        <div className="px-6 py-8 text-center">
          {/* Distinction trophy */}
          {colour.band === 'distinction' && (
            <div className="flex items-center justify-center gap-2 mb-5">
              <Trophy size={18} className="text-[#92400E]" />
              <span className="text-[#92400E] text-sm font-bold uppercase tracking-widest">
                Outstanding Performance
              </span>
              <Trophy size={18} className="text-[#92400E]" />
            </div>
          )}

          {/* Score ring */}
          <CircleScore score={result.score_percentage} strokeHex={strokeHex} />

          {/* Grade band pill */}
          <div className="mt-5 inline-flex">
            <span className={`px-5 py-1.5 rounded-full text-base font-bold border-2 ${colour.bgClass} ${colour.borderClass} ${colour.textClass}`}>
              {colour.bandLabel}
            </span>
          </div>

          {/* Performance message */}
          <p className="text-[#6B8479] text-base mt-3 leading-relaxed max-w-xs mx-auto">
            {colour.resultMessage}
          </p>

          {/* Exam title */}
          <p className="text-[#6B8479] text-sm mt-2 truncate px-6 opacity-70">
            {examTitle}
          </p>
        </div>
      </div>


      {/* ── Breakdown card ─────────────────────────────────── */}
      <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-5 space-y-5">

        {/* Correct / Incorrect / Total row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center mx-auto mb-2">
              <BarChart3 size={15} className="text-[#15803D]" />
            </div>
            <p className="text-[#0B1F14] text-2xl font-bold tabular-nums leading-none">
              {result.total_questions}
            </p>
            <p className="text-[#6B8479] text-sm mt-1.5">Questions</p>
          </div>
          <div className="bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center mx-auto mb-2">
              <CheckCircle size={15} className="text-[#15803D]" />
            </div>
            <p className={`text-2xl font-bold tabular-nums leading-none ${colour.textClass}`}>
              {result.correct_answers}
            </p>
            <p className="text-[#6B8479] text-sm mt-1.5">Correct</p>
          </div>
          <div className="bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] flex items-center justify-center mx-auto mb-2">
              <XCircle size={15} className="text-[#991B1B]" />
            </div>
            <p className={`text-2xl font-bold tabular-nums leading-none ${incorrect > 0 ? 'text-[#991B1B]' : 'text-[#6B8479]'}`}>
              {incorrect}
            </p>
            <p className="text-[#6B8479] text-sm mt-1.5">Incorrect</p>
          </div>
        </div>

        {/* Score bar */}
        <ScoreBar
          correct  = {result.correct_answers}
          total    = {result.total_questions}
          strokeHex= {strokeHex}
        />

        {/* Pass threshold pill */}
        <div className="flex justify-center">
          <span className={[
            'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border',
            isPassing
              ? 'bg-[#E7FBEE] border-[#86EFAC] text-[#15803D]'
              : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]',
          ].join(' ')}>
            {isPassing
              ? <><CheckCircle size={13} /> Above pass mark ({SCORE_THRESHOLDS.pass}%)</>
              : <><XCircle size={13} /> Below pass mark ({SCORE_THRESHOLDS.pass}%)</>
            }
          </span>
        </div>

        {/* Submission time */}
        <div className="flex items-center justify-center gap-1.5 text-[#6B8479] text-sm">
          <Clock size={13} />
          <span>Submitted {formatSubmittedAt(result.submitted_at)}</span>
        </div>
      </div>


      {/* ── Actions ────────────────────────────────────────── */}
      <div className="space-y-3">
        <button
          type      = "button"
          onClick   = {onReturnToLobby}
          className = "w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors"
        >
          <ArrowLeft size={17} />
          Return to Exam Lobby
        </button>
        <button
          type      = "button"
          onClick   = {onLogOut}
          className = "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold text-[#6B8479] bg-white border border-[#D7F2E0] hover:border-[#FCA5A5] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors"
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>

      <p className="text-center text-[#6B8479] text-sm">
        Your result has been recorded. Contact your teacher if you have any questions.
      </p>
    </div>
  );
}


// ================================================================
//  BRANCH B — Submission Confirmed (results hidden)
// ================================================================

function SubmissionConfirmedView({
  result, examTitle, questionsAnswered, onReturnToLobby, onLogOut,
}: {
  result           : ExamResult;
  examTitle        : string;
  questionsAnswered: number;
  onReturnToLobby  : () => void;
  onLogOut         : () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4">

      {/* ── Confirmation hero card ─────────────────────────── */}
      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

        {/* Green top accent */}
        <div className="h-1.5 w-full bg-[#4AE17A]" />

        <div className="px-6 py-10 text-center">
          {/* Large checkmark */}
          <div className="w-24 h-24 rounded-3xl bg-[#E7FBEE] border-2 border-[#4AE17A] flex items-center justify-center mx-auto mb-6">
            <FileCheck size={44} className="text-[#15803D]" />
          </div>

          <h2 className="text-[#0B1F14] text-2xl font-bold mb-2">
            Exam Submitted!
          </h2>
          <p className="text-[#6B8479] text-base leading-relaxed max-w-xs mx-auto">
            Your answers have been received and saved successfully.
          </p>

          {/* Exam title */}
          <p className="text-[#3D5347] text-sm font-semibold mt-4 px-4 truncate">
            {examTitle}
          </p>

          {/* Questions answered pill */}
          <div className="mt-5 inline-flex">
            <span className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-base font-semibold">
              <BarChart3 size={16} className="text-[#15803D]" />
              You answered {questionsAnswered} of {result.total_questions} questions
            </span>
          </div>

          {/* Submission time */}
          <div className="flex items-center justify-center gap-1.5 text-[#6B8479] text-sm mt-4">
            <Clock size={13} />
            <span>Submitted {formatSubmittedAt(result.submitted_at)}</span>
          </div>
        </div>
      </div>


      {/* ── Result pending notice ───────────────────────────── */}
      <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-2xl px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#FCD34D] flex items-center justify-center flex-shrink-0">
            <Lock size={18} className="text-[#92400E]" />
          </div>
          <div>
            <p className="text-[#92400E] text-base font-bold mb-1">
              Result pending release
            </p>
            <p className="text-[#92400E]/80 text-sm leading-relaxed">
              Your score has been recorded but will not be displayed until
              your principal releases results at the end of term. Check
              the "Completed Tests" tab on the lobby after results are
              released.
            </p>
          </div>
        </div>
      </div>


      {/* ── Actions ────────────────────────────────────────── */}
      <div className="space-y-3">
        <button
          type      = "button"
          onClick   = {onReturnToLobby}
          className = "w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors"
        >
          <ArrowLeft size={17} />
          Return to Exam Lobby
        </button>
        <button
          type      = "button"
          onClick   = {onLogOut}
          className = "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold text-[#6B8479] bg-white border border-[#D7F2E0] hover:border-[#FCA5A5] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors"
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </div>
  );
}


// ================================================================
//  MAIN COMPONENT
// ================================================================

export default function ResultPage(): React.JSX.Element {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { logout, student } = useAuth();

  // ── Read result from navigation state ─────────────────────────
  const locationState = location.state as ResultLocationState | null;
  const result        = locationState?.result ?? null;
  const examTitle     = locationState?.examTitle ?? `Exam ${result?.result_id ?? ''}`;

  // ── Redirect if no result data ────────────────────────────────
  useEffect((): void => {
    if (result === null) navigate('/student/lobby', { replace: true });
  }, [result, navigate]);

  if (result === null) return <></>;

  // ── Which branch to render ────────────────────────────────────
  // result.results_visible may be:
  //   true     → full score (new submission with visibility=true)
  //   false    → hidden (new submission with visibility=false)
  //   undefined → legacy result saved before Phase 2; show score
  const showFullScore =
    result.results_visible === true ||
    result.results_visible === undefined;

  // questions_answered falls back to correct + incorrect for legacy
  const questionsAnswered =
    result.questions_answered ??
    (result.correct_answers + (result.total_questions - result.correct_answers));

  const handleReturnToLobby = (): void => {
    navigate('/student/lobby', {
      replace: true,
      state  : { examCompleted: true },
    });
  };

  const handleLogOut = (): void => logout('/login/student');


  // ================================================================
  //  RENDER
  // ================================================================

  return (
    <div className="min-h-screen bg-[#F4FBF6]">
      <div className="max-w-md mx-auto px-4 py-8 space-y-0">

        {/* ── Top bar ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#4AE17A] flex items-center justify-center">
              <BookOpen size={16} className="text-[#0B1F14]" />
            </div>
            <span className="text-[#3D5347] text-base font-bold">CBT Examination Portal</span>
          </div>
          {student !== null && (
            <span className="text-[#6B8479] text-sm">{student.full_name}</span>
          )}
        </div>

        {/* ── Late submission note ──────────────────────────── */}
        {result.submitted_late === true && (
          <div className="mb-4 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
            <p className="font-semibold">Your time ran out before you submitted.</p>
            <p className="mt-0.5">
              Your exam was still recorded. The answers saved before time ended were graded.
            </p>
          </div>
        )}

        {/* ── Branch render ─────────────────────────────────── */}
        {showFullScore && result.correct_answers !== null && result.score_percentage !== null ? (
          <FullResultView
            result          = {result as Required<Pick<ExamResult, 'correct_answers' | 'score_percentage'>> & ExamResult}
            examTitle       = {examTitle}
            onReturnToLobby = {handleReturnToLobby}
            onLogOut        = {handleLogOut}
          />
        ) : (
          <SubmissionConfirmedView
            result            = {result}
            examTitle         = {examTitle}
            questionsAnswered = {questionsAnswered}
            onReturnToLobby   = {handleReturnToLobby}
            onLogOut          = {handleLogOut}
          />
        )}
      </div>
    </div>
  );
}