// ================================================================
//  CBT SYSTEM — STUDENT RESULTS PAGE
//  File    : src/pages/student/StudentResultsPage.tsx
//
//  NEW — the old "Completed Tests" tab from StudentLobbyPage.tsx,
//  moved to its own page in the new sidebar portal. Logic and
//  visuals unchanged from the original tab; ResultCard is
//  duplicated rather than extracted, same reasoning as the
//  dashboard page.
// ================================================================

import React, { useEffect, useState } from 'react';
import { History, AlertCircle, RefreshCw, Lock, Tag, Calendar } from 'lucide-react';

import axiosInstance from '../../api/axiosInstance';


interface ResultRow {
  result_id        : number;
  exam_id          : number;
  exam_title       : string;
  subject_name     : string;
  evaluation_type  : 'midterm' | 'terminal' | null;
  academic_session : string | null;
  term             : number | null;
  total_questions  : number;
  correct_answers  : number | null;
  score_percentage : number | null;
  submitted_at     : string;
}
interface ResultsSummary { total_exams: number; average_score: number | null }
interface MyResultsResponse {
  success: boolean; results_visible: boolean;
  summary: ResultsSummary; results: ResultRow[];
}

function formatResultDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch { return iso; }
}

function ResultCard({ result, resultsVisible }: { result: ResultRow; resultsVisible: boolean }): React.JSX.Element {
  return (
    <div className="bg-white border border-[#D7F2E0] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <p className="text-[#0B1F14] text-base font-bold">{result.exam_title}</p>
            {result.evaluation_type !== null && (
              <span className={[
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border',
                result.evaluation_type === 'midterm'
                  ? 'bg-[#EFF6FF] text-[#0369A1] border-[#BAE6FD]'
                  : 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
              ].join(' ')}>
                <Tag size={9} />
                {result.evaluation_type === 'midterm' ? 'CA' : 'Terminal'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm text-[#6B8479]">
            <span>{result.subject_name}</span>
            {result.academic_session !== null && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {result.academic_session}
                  {result.term !== null && ` · T${result.term}`}
                </span>
              </>
            )}
            <span>·</span>
            <span>{formatResultDate(result.submitted_at)}</span>
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          {resultsVisible && result.score_percentage !== null ? (
            <div>
              <p className="text-[#0B1F14] text-2xl font-bold tabular-nums">{result.score_percentage.toFixed(1)}%</p>
              <p className="text-[#6B8479] text-sm mt-0.5">{result.correct_answers}/{result.total_questions} correct</p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E]">
              <Lock size={12} />
              <span className="text-sm font-semibold">Pending release</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentResultsPage(): React.JSX.Element {
  const [data,    setData]    = useState<MyResultsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchResults = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get<MyResultsResponse>('/api/exams/my-results');
      if (res.data.success) setData(res.data);
    } catch {
      setError('Failed to load your results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect((): void => { void fetchResults(); }, []);

  const resultsVisible = data?.results_visible ?? false;

  return (
    <div className="space-y-6">
      <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">My Results</h1>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-[#D7F2E0] rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {error !== null && !loading && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#991B1B] text-base font-semibold">{error}</p>
            <button type="button" onClick={() => void fetchResults()} className="text-[#991B1B] text-sm underline mt-1">Try again</button>
          </div>
        </div>
      )}

      {!loading && error === null && data !== null && (
        <>
          {!resultsVisible && data.results.length > 0 && (
            <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-5 py-4">
              <Lock size={16} className="text-[#92400E] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#92400E] text-base font-semibold">Results not yet released</p>
                <p className="text-[#92400E]/80 text-sm mt-0.5 leading-relaxed">
                  Your scores have been recorded but are hidden until your principal releases results at the end of term.
                </p>
              </div>
            </div>
          )}

          {data.results.length === 0 && (
            <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mx-auto mb-5">
                <History size={28} className="text-[#6B8479]" />
              </div>
              <h3 className="text-[#0B1F14] text-lg font-bold">No completed tests yet</h3>
              <p className="text-[#6B8479] text-base mt-2 max-w-xs mx-auto leading-relaxed">
                Once you complete an exam your history will appear here.
              </p>
            </div>
          )}

          {data.results.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-[#D7F2E0] rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-[#0B1F14] tabular-nums">{data.summary.total_exams}</p>
                  <p className="text-[#6B8479] text-sm mt-1">Tests Completed</p>
                </div>
                <div className="bg-white border border-[#D7F2E0] rounded-2xl p-4 text-center">
                  {resultsVisible && data.summary.average_score !== null ? (
                    <>
                      <p className="text-3xl font-bold text-[#15803D] tabular-nums">{data.summary.average_score.toFixed(1)}%</p>
                      <p className="text-[#6B8479] text-sm mt-1">Average Score</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-1.5 mt-1">
                        <Lock size={16} className="text-[#92400E]" />
                      </div>
                      <p className="text-[#92400E] text-base font-semibold mt-1">Pending</p>
                      <p className="text-[#6B8479] text-sm mt-0.5">Average Score</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-[#0B1F14] text-lg font-bold">Test History</h2>
                <button
                  type      = "button"
                  onClick   = {() => void fetchResults()}
                  disabled  = {loading}
                  className = "p-2 rounded-xl text-[#6B8479] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="space-y-3">
                {data.results.map((r) => (
                  <ResultCard key={r.result_id} result={r} resultsVisible={resultsVisible} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}