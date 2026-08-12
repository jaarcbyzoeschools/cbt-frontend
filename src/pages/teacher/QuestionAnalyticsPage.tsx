// ================================================================
//  CBT SYSTEM — QUESTION ANALYTICS PAGE
//  File    : src/pages/teacher/QuestionAnalyticsPage.tsx
//  Design  : Vibrant Institutional Light Mode
//
//  FIX: removed "All exams across all branches are available
//  here" copy in two places. That was accurate under the old
//  unrestricted policy, but analyticsController.js now scopes
//  getQuestionAnalytics (and the underlying exam list) to a plain
//  teacher's assigned subjects — leaving the old copy in place
//  would have told a restricted teacher something false and made
//  a shorter dropdown look like a bug instead of correct behavior.
//  No functional change needed otherwise — this page already
//  consumes /api/teacher/analytics/exams and
//  /api/teacher/analytics/questions, both already fixed server-side.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useState,
}                        from 'react';
import {
  BarChart3,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  BookOpen,
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Users,
  GraduationCap,
}                        from 'lucide-react';

import axiosInstance from '../../api/axiosInstance';


interface ExamOption {
  exam_id              : number;
  exam_title           : string;
  subject_name         : string;
  class_name           : string;
  department_name      : string;
  created_by_username  : string;
  question_count       : number;
  total_questions_to_show: number;
}

interface QuestionAnalyticsRow {
  question_id     : number;
  question_text   : string;
  option_a        : string;
  option_b        : string;
  option_c        : string;
  option_d        : string;
  correct_option  : string;
  attempt_count   : number;
  correct_count   : number;
  incorrect_count : number;
  difficulty      : number | null;
  difficulty_label: string;
}

interface AnalyticsSummary {
  total_questions     : number;
  questions_attempted : number;
  avg_difficulty      : number | null;
  hardest_question    : string | null;
}

interface AnalyticsResponse {
  success    : boolean;
  exam_id    : number;
  exam_title : string;
  created_by : string;
  summary    : AnalyticsSummary;
  questions  : QuestionAnalyticsRow[];
}

interface ExamListResponse {
  success: boolean;
  count  : number;
  exams  : ExamOption[];
}


function DifficultyBar({
  difficulty,
  label,
}: {
  difficulty: number | null;
  label     : string;
}): React.JSX.Element {
  if (difficulty === null) {
    return (
      <div className="space-y-1.5 min-w-[140px]">
        <span className="text-[#6B8479] text-sm font-medium">No submissions yet</span>
        <div className="w-full h-2 bg-[#F4FBF6] rounded-full" />
      </div>
    );
  }

  const pct = Math.round(difficulty * 100);

  const barColour =
    difficulty < 0.25 ? 'bg-[#0EA5E9]' :
    difficulty < 0.50 ? 'bg-[#92400E]' :
    difficulty < 0.75 ? 'bg-[#DC2626]' : 'bg-[#7C3AED]';

  const labelColour =
    difficulty < 0.25 ? 'text-[#0369A1]' :
    difficulty < 0.50 ? 'text-[#92400E]' :
    difficulty < 0.75 ? 'text-[#991B1B]' : 'text-[#7C3AED]';

  return (
    <div className="space-y-1.5 min-w-[140px]">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${labelColour}`}>{label}</span>
        <span className="text-[#6B8479] text-sm tabular-nums">{pct}%</span>
      </div>
      <div className="w-full h-2 bg-[#F4FBF6] rounded-full overflow-hidden">
        <div
          className = {`h-2 rounded-full transition-all duration-500 ${barColour}`}
          style     = {{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}


function SummaryBar({
  summary,
  examTitle,
  createdBy,
}: {
  summary   : AnalyticsSummary;
  examTitle : string;
  createdBy : string;
}): React.JSX.Element {
  const avgPct = summary.avg_difficulty !== null
    ? Math.round(summary.avg_difficulty * 100)
    : null;

  return (
    <div className="bg-white border border-[#D7F2E0] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
          <Target size={17} className="text-[#15803D]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[#0B1F14] text-base font-bold truncate">{examTitle}</h2>
          <p className="text-[#6B8479] text-sm mt-0.5">
            Created by <span className="text-[#3D5347] font-medium">{createdBy}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl p-4">
          <div className="w-9 h-9 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center mb-3">
            <BookOpen size={16} className="text-[#15803D]" />
          </div>
          <p className="text-3xl font-bold text-[#15803D] tabular-nums leading-none">
            {summary.total_questions}
          </p>
          <p className="text-[#3D5347] text-sm font-semibold mt-2">Total Questions</p>
        </div>

        <div className="bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl p-4">
          <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center mb-3">
            <Users size={16} className="text-[#0369A1]" />
          </div>
          <p className="text-3xl font-bold text-[#0369A1] tabular-nums leading-none">
            {summary.questions_attempted}
          </p>
          <p className="text-[#3D5347] text-sm font-semibold mt-2">With Submissions</p>
          <p className="text-[#6B8479] text-sm mt-0.5">
            {summary.total_questions - summary.questions_attempted} awaiting data
          </p>
        </div>

        <div className="bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl p-4">
          <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] border border-[#FCD34D] flex items-center justify-center mb-3">
            <BarChart3 size={16} className="text-[#92400E]" />
          </div>
          <p className="text-3xl font-bold text-[#92400E] tabular-nums leading-none">
            {avgPct !== null ? `${avgPct}%` : '—'}
          </p>
          <p className="text-[#3D5347] text-sm font-semibold mt-2">Avg Difficulty</p>
          <p className="text-[#6B8479] text-sm mt-0.5">Higher = harder</p>
        </div>

        <div className="bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl p-4">
          <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] flex items-center justify-center mb-3">
            <TrendingDown size={16} className="text-[#991B1B]" />
          </div>
          <p className="text-[#0B1F14] text-sm font-semibold leading-snug line-clamp-3 mt-1 min-h-[3rem]">
            {summary.hardest_question ?? 'No data yet'}
          </p>
          <p className="text-[#3D5347] text-sm font-semibold mt-2">Hardest Question</p>
        </div>
      </div>
    </div>
  );
}


export default function QuestionAnalyticsPage(): React.JSX.Element {
  const [examOptions,    setExamOptions]    = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [analytics,      setAnalytics]      = useState<AnalyticsResponse | null>(null);
  const [isLoading,      setIsLoading]      = useState<boolean>(false);
  const [isLoadingExams, setIsLoadingExams] = useState<boolean>(true);
  const [error,          setError]          = useState<string | null>(null);


  // ── Load exams for the dropdown ─────────────────────────────
  // Already correctly scoped server-side: /api/teacher/analytics/exams
  // returns everything for admin/super_admin, but only a plain
  // teacher's assigned subjects — this page just displays whatever
  // comes back, no client-side filtering needed.

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<ExamListResponse>(
          '/api/teacher/analytics/exams'
        );
        if (res.data.success) setExamOptions(res.data.exams);
      } catch {
        // Non-fatal — page still renders, just with empty dropdown
      } finally {
        setIsLoadingExams(false);
      }
    };
    void load();
  }, []);


  // ── Load analytics for selected exam ─────────────────────────

  const fetchAnalytics = useCallback(async (examId: string): Promise<void> => {
    if (!examId) return;
    setIsLoading(true);
    setError(null);
    setAnalytics(null);
    try {
      const res = await axiosInstance.get<AnalyticsResponse>(
        `/api/teacher/analytics/questions?exam_id=${examId}`
      );
      if (res.data.success) setAnalytics(res.data);
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? 'Failed to load analytics. Please try again.');
      } else {
        setError('Failed to load analytics. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => {
    if (selectedExamId) void fetchAnalytics(selectedExamId);
  }, [selectedExamId, fetchAnalytics]);


  const getOptionText = (row: QuestionAnalyticsRow, opt: string): string => {
    switch (opt.trim().toUpperCase()) {
      case 'A': return `A: ${row.option_a}`;
      case 'B': return `B: ${row.option_b}`;
      case 'C': return `C: ${row.option_c}`;
      case 'D': return `D: ${row.option_d}`;
      default : return opt;
    }
  };

  const examsByClass = examOptions.reduce<Record<string, ExamOption[]>>(
    (acc, exam) => {
      const key = exam.class_name;
      if (!acc[key]) acc[key] = [];
      acc[key].push(exam);
      return acc;
    },
    {}
  );

  const classOrder = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];
  const sortedClasses = classOrder.filter((c) => examsByClass[c] !== undefined);


  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Question Analytics
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            See which questions students found easiest and hardest.
          </p>
        </div>
        {selectedExamId !== '' && analytics !== null && (
          <button
            type      = "button"
            onClick   = {() => void fetchAnalytics(selectedExamId)}
            disabled  = {isLoading}
            className = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>


      <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-5">
        <label className="block text-[#3D5347] text-base font-semibold mb-1">
          Select an Exam to Analyse
        </label>
        <p className="text-[#6B8479] text-sm mb-4">
          Only exams for subjects you're assigned to are listed here.
        </p>

        {isLoadingExams ? (
          <div className="h-14 bg-[#F4FBF6] rounded-xl animate-pulse" />
        ) : examOptions.length === 0 ? (
          <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-4 py-3">
            <AlertCircle size={17} className="text-[#92400E] flex-shrink-0 mt-0.5" />
            <p className="text-[#92400E] text-base">
              No exams found for your assigned subjects yet. Exams need to be created
              and have questions uploaded before analytics can be viewed — and you'll
              need at least one subject assignment from your admin first if you don't
              have one yet.
            </p>
          </div>
        ) : (
          <div className="relative max-w-xl">
            <select
              value     = {selectedExamId}
              onChange  = {(e) => setSelectedExamId(e.target.value)}
              className = {[
                'appearance-none w-full bg-white border-2 border-[#D7F2E0] rounded-xl',
                'pl-4 pr-10 py-3.5 text-base focus:outline-none focus:border-[#4AE17A]',
                'cursor-pointer transition-all',
                selectedExamId === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]',
              ].join(' ')}
            >
              <option value="" disabled>
                Choose an exam ({examOptions.length} available)…
              </option>
              {sortedClasses.map((className) => (
                <optgroup key={className} label={`── ${className} ──`}>
                  {examsByClass[className].map((exam) => (
                    <option key={exam.exam_id} value={String(exam.exam_id)}>
                      {exam.exam_title} · {exam.subject_name} · {exam.question_count}Q · by {exam.created_by_username}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown
              size      = {16}
              className = "absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none"
            />
          </div>
        )}

        {selectedExamId !== '' && (() => {
          const selected = examOptions.find(
            (e) => String(e.exam_id) === selectedExamId
          );
          if (!selected) return null;
          return (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                <GraduationCap size={13} />
                {selected.class_name}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-sm font-semibold">
                <BookOpen size={13} />
                {selected.subject_name}
              </span>
              <span className="px-3 py-1 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-sm font-semibold">
                {selected.department_name}
              </span>
              <span className="px-3 py-1 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-sm font-semibold">
                {selected.question_count} questions uploaded
              </span>
            </div>
          );
        })()}
      </div>


      {!isLoading && selectedExamId === '' && (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#D7F2E0] rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-5">
            <Target size={28} className="text-[#6B8479]" />
          </div>
          <p className="text-[#0B1F14] text-lg font-bold">Select an exam above</p>
          <p className="text-[#6B8479] text-base mt-1 max-w-xs text-center">
            Question difficulty and submission data will appear here.
          </p>
        </div>
      )}


      {isLoading && (
        <div className="space-y-4">
          <div className="bg-white border border-[#D7F2E0] rounded-2xl p-6 h-52 animate-pulse" />
          <div className="bg-white border border-[#D7F2E0] rounded-2xl h-72 animate-pulse" />
        </div>
      )}


      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#991B1B] text-base font-semibold">{error}</p>
            <button
              type      = "button"
              onClick   = {() => void fetchAnalytics(selectedExamId)}
              className = "text-[#991B1B] text-sm underline mt-1 hover:opacity-80"
            >
              Try again
            </button>
          </div>
        </div>
      )}


      {!isLoading && analytics !== null && (
        <>
          <SummaryBar
            summary   = {analytics.summary}
            examTitle = {analytics.exam_title}
            createdBy = {analytics.created_by}
          />

          <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
              <BarChart3 size={17} className="text-[#3D5347]" />
              <h2 className="text-[#0B1F14] text-base font-bold">
                Per-Question Breakdown
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                {analytics.questions.length} questions
              </span>
              {analytics.summary.questions_attempted > 0 && (
                <span className="text-[#6B8479] text-sm">
                  · sorted hardest first
                </span>
              )}
            </div>

            {analytics.questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-4">
                  <BarChart3 size={22} className="text-[#6B8479]" />
                </div>
                <p className="text-[#0B1F14] text-base font-bold">
                  No questions uploaded for this exam
                </p>
                <p className="text-[#6B8479] text-sm mt-1">
                  Upload questions to this exam to start seeing analytics.
                </p>
              </div>
            ) : analytics.summary.questions_attempted === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-[#FFFBEB] border border-[#FCD34D] flex items-center justify-center mb-4">
                  <Users size={22} className="text-[#92400E]" />
                </div>
                <p className="text-[#0B1F14] text-base font-bold">
                  No submissions yet for this exam
                </p>
                <p className="text-[#6B8479] text-sm mt-1 max-w-xs">
                  Analytics will populate here after students submit this exam.
                  {analytics.questions.length} questions are uploaded and ready.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#D7F2E0]">
                      {[
                        '#',
                        'Question',
                        'Correct Answer',
                        'Attempts',
                        'Correct',
                        'Incorrect',
                        'Difficulty',
                      ].map((h) => (
                        <th
                          key       = {h}
                          className = "text-left px-5 py-3.5 text-[#3D5347] font-semibold text-sm uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.questions.map((row, i) => {
                      const isEven = i % 2 === 0;
                      return (
                        <tr
                          key       = {row.question_id}
                          className = {`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors ${isEven ? 'bg-white' : 'bg-[#F4FBF6]'}`}
                        >
                          <td className="px-5 py-4">
                            <span className="text-[#6B8479] text-sm font-bold tabular-nums">
                              {i + 1}
                            </span>
                          </td>

                          <td className="px-5 py-4 max-w-xs">
                            <p className="text-[#0B1F14] text-sm font-medium leading-relaxed line-clamp-3">
                              {row.question_text}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold whitespace-nowrap">
                              <CheckCircle size={13} />
                              {getOptionText(row, row.correct_option)}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              <Users size={14} className="text-[#6B8479]" />
                              <span className="text-[#3D5347] text-base font-bold tabular-nums">
                                {row.attempt_count}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              <TrendingUp size={14} className="text-[#15803D]" />
                              <span className="text-[#15803D] text-base font-bold tabular-nums">
                                {row.correct_count}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              <XCircle size={14} className="text-[#991B1B]" />
                              <span className="text-[#991B1B] text-base font-bold tabular-nums">
                                {row.incorrect_count}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <DifficultyBar
                              difficulty = {row.difficulty}
                              label      = {row.difficulty_label}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}