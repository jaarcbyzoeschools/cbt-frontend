// ================================================================
//  CBT SYSTEM — STUDENT RESULT SUMMARY MODAL
//  File    : src/components/teacher/StudentResultModal.tsx
//  Design  : Institutional Precision (Light Mode)
//
//  Triggered from a row in StudentEnrolmentPage. Fetches every
//  exam result for a single student from
//  GET /api/teacher/students/:id/results and shows a summary
//  card plus a per-exam breakdown table — no navigation away
//  from the student list required.
// ================================================================

import React, { useEffect, useState } from 'react';
import {
  X,
  AlertCircle,
  Award,
  TrendingUp,
  TrendingDown,
  FileQuestion,
  Calendar,
  Tag,
  EyeOff,
  GraduationCap,
}                     from 'lucide-react';

import axiosInstance from '../../api/axiosInstance';


// ================================================================
//  TYPES
// ================================================================

interface StudentInfo {
  id              : number;
  full_name       : string;
  login_pin       : string;
  is_active       : boolean;
  class_name      : string;
  department_name : string;
  branch_name     : string;
}

interface ResultSummary {
  total_exams       : number;
  average_score     : number | null;
  highest_score     : number | null;
  lowest_score      : number | null;
  total_tab_switches: number;
}

interface ResultRow {
  result_id        : number;
  exam_id          : number;
  exam_title        : string;
  subject_name      : string;
  evaluation_type   : 'midterm' | 'terminal' | null;
  academic_session  : string | null;
  term              : number | null;
  total_questions   : number;
  correct_answers   : number;
  score_percentage  : number;
  raw_score         : number | null;
  max_raw_mark      : number | null;
  weighted_score    : number | null;
  score_weight      : number | null;
  tab_switches      : number;
  submitted_at      : string;
}

interface ResultSummaryResponse {
  success: boolean;
  student: StudentInfo;
  summary: ResultSummary;
  results: ResultRow[];
}

interface StudentResultModalProps {
  studentId: number;
  onClose  : () => void;
}


// ================================================================
//  HELPERS
// ================================================================

function getScoreColour(score: number): { text: string; bg: string; border: string } {
  if (score >= 70) return { text: 'text-[#166534]', bg: 'bg-[#F0FDF4]', border: 'border-[#86EFAC]' };
  if (score >= 50) return { text: 'text-[#92400E]', bg: 'bg-[#FFFBEB]', border: 'border-[#FCD34D]' };
  return { text: 'text-[#991B1B]', bg: 'bg-[#FEF2F2]', border: 'border-[#FCA5A5]' };
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}


// ================================================================
//  MAIN COMPONENT
// ================================================================

export default function StudentResultModal({
  studentId,
  onClose,
}: StudentResultModalProps): React.JSX.Element {
  const [data,      setData]      = useState<ResultSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await axiosInstance.get<ResultSummaryResponse>(
          `/api/teacher/students/${studentId}/results`
        );
        if (res.data.success) setData(res.data);
      } catch (thrown: unknown) {
        if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
          const err = thrown as { response?: { data?: { message?: string } } };
          setError(err.response?.data?.message ?? 'Failed to load results.');
        } else {
          setError('Failed to load results. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [studentId]);

  useEffect((): (() => void) => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return (): void => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div
        className  = "fixed inset-0 z-40 bg-[#0F172A]/50"
        onClick    = {onClose}
        aria-hidden= "true"
      />
      <div
        className = "fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        role      = "dialog"
        aria-modal= "true"
      >
        <div className="w-full max-w-3xl bg-white border border-[#D1D9E0] rounded-2xl shadow-2xl my-4 max-h-[90vh] flex flex-col">

          {/* ── Header ────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D1D9E0] bg-[#F7F8FA] rounded-t-2xl flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center flex-shrink-0">
                <GraduationCap size={18} className="text-[#1D4ED8]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[#0F172A] text-lg font-bold truncate">
                  {data?.student.full_name ?? 'Loading…'}
                </h2>
                {data !== null && (
                  <p className="text-[#6B7280] text-sm">
                    {data.student.class_name} · {data.student.department_name} · {data.student.branch_name}
                  </p>
                )}
              </div>
            </div>
            <button
              type      = "button"
              onClick   = {onClose}
              className = "p-1.5 rounded-lg text-[#6B7280] hover:text-[#0F172A] hover:bg-[#F0F2F5] transition-colors flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Body ──────────────────────────────────────────── */}
          <div className="overflow-y-auto flex-1 px-6 py-6 space-y-5">

            {/* Loading */}
            {isLoading && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-24 bg-[#F0F2F5] rounded-xl animate-pulse" />
                  ))}
                </div>
                <div className="h-64 bg-[#F0F2F5] rounded-xl animate-pulse" />
              </div>
            )}

            {/* Error */}
            {error !== null && !isLoading && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
                <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                <p className="text-[#991B1B] text-base font-semibold">{error}</p>
              </div>
            )}

            {/* Content */}
            {!isLoading && error === null && data !== null && (
              <>
                {/* Summary KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#F7F8FA] border border-[#D1D9E0] rounded-xl p-4">
                    <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center mb-2">
                      <FileQuestion size={14} className="text-[#1D4ED8]" />
                    </div>
                    <p className="text-2xl font-bold text-[#1D4ED8] tabular-nums leading-none">
                      {data.summary.total_exams}
                    </p>
                    <p className="text-[#6B7280] text-sm mt-1.5">Exams Taken</p>
                  </div>

                  <div className="bg-[#F7F8FA] border border-[#D1D9E0] rounded-xl p-4">
                    <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] border border-[#86EFAC] flex items-center justify-center mb-2">
                      <Award size={14} className="text-[#166534]" />
                    </div>
                    <p className="text-2xl font-bold text-[#166534] tabular-nums leading-none">
                      {data.summary.average_score !== null ? `${data.summary.average_score}%` : '—'}
                    </p>
                    <p className="text-[#6B7280] text-sm mt-1.5">Average Score</p>
                  </div>

                  <div className="bg-[#F7F8FA] border border-[#D1D9E0] rounded-xl p-4">
                    <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] border border-[#FCD34D] flex items-center justify-center mb-2">
                      <TrendingUp size={14} className="text-[#92400E]" />
                    </div>
                    <p className="text-2xl font-bold text-[#92400E] tabular-nums leading-none">
                      {data.summary.highest_score !== null ? `${data.summary.highest_score}%` : '—'}
                    </p>
                    <p className="text-[#6B7280] text-sm mt-1.5">Highest Score</p>
                  </div>

                  <div className="bg-[#F7F8FA] border border-[#D1D9E0] rounded-xl p-4">
                    <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] flex items-center justify-center mb-2">
                      <TrendingDown size={14} className="text-[#991B1B]" />
                    </div>
                    <p className="text-2xl font-bold text-[#991B1B] tabular-nums leading-none">
                      {data.summary.lowest_score !== null ? `${data.summary.lowest_score}%` : '—'}
                    </p>
                    <p className="text-[#6B7280] text-sm mt-1.5">Lowest Score</p>
                  </div>
                </div>

                {/* Tab switch warning, if any */}
                {data.summary.total_tab_switches > 0 && (
                  <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                    <EyeOff size={16} className="text-[#991B1B] flex-shrink-0" />
                    <p className="text-[#991B1B] text-sm font-semibold">
                      {data.summary.total_tab_switches} tab switch{data.summary.total_tab_switches === 1 ? '' : 'es'} recorded
                      across all exams — review individual exams below for details.
                    </p>
                  </div>
                 )}

                {/* Results table */}
                <div className="bg-white border border-[#D1D9E0] rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#D1D9E0] bg-[#F7F8FA]">
                    <p className="text-[#374151] text-base font-bold">Exam History</p>
                  </div>

                  {data.results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                      <div className="w-12 h-12 rounded-2xl bg-[#F7F8FA] border border-[#D1D9E0] flex items-center justify-center mb-3">
                        <FileQuestion size={20} className="text-[#9CA3AF]" />
                      </div>
                      <p className="text-[#0F172A] text-base font-semibold">No exams taken yet</p>
                      <p className="text-[#6B7280] text-sm mt-1">
                        This student has not submitted any exam results.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F0F2F5]">
                      {data.results.map((r) => {
                        const colour = getScoreColour(r.score_percentage);
                        return (
                          <div key={r.result_id} className="px-5 py-4">
                            <div className="flex items-start justify-between gap-4 flex-wrap">

                              {/* Exam info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <p className="text-[#0F172A] text-base font-semibold">
                                    {r.exam_title}
                                  </p>
                                  {r.evaluation_type !== null && (
                                    <span className={[
                                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold border',
                                      r.evaluation_type === 'midterm'
                                        ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                                        : 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
                                    ].join(' ')}>
                                      <Tag size={10} />
                                      {r.evaluation_type === 'midterm' ? 'CA' : 'Terminal'}
                                    </span>
                                  )}
                                  {r.tab_switches > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-sm font-semibold">
                                      <EyeOff size={10} />
                                      {r.tab_switches}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap text-sm text-[#6B7280]">
                                  <span>{r.subject_name}</span>
                                  {r.academic_session !== null && (
                                    <>
                                      <span>·</span>
                                      <span className="flex items-center gap-1">
                                        <Calendar size={11} />
                                        {r.academic_session}
                                        {r.term !== null && ` · T${r.term}`}
                                      </span>
                                    </>
                                  )}
                                  <span>·</span>
                                  <span>{formatDate(r.submitted_at)}</span>
                                </div>
                              </div>

                              {/* Score block */}
                              <div className="flex items-center gap-4 flex-shrink-0">
                                <div className="text-right">
                                  <p className="text-[#9CA3AF] text-sm">
                                    {r.correct_answers}/{r.total_questions} correct
                                  </p>
                                  {r.raw_score !== null && r.max_raw_mark !== null && (
                                    <p className="text-[#9CA3AF] text-sm">
                                      {r.raw_score}/{r.max_raw_mark} marks
                                    </p>
                                  )}
                                </div>
                                <div className={`px-3.5 py-2 rounded-xl border-2 ${colour.bg} ${colour.border}`}>
                                  <p className={`text-lg font-bold tabular-nums ${colour.text}`}>
                                    {r.score_percentage.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}