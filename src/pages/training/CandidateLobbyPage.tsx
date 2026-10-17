// ================================================================
//  CBT SYSTEM — TRAINING CANDIDATE LOBBY
//  File   : src/pages/training/CandidateLobbyPage.tsx
//  Route  : /training/lobby
//
//  What a training-course candidate sees after logging in:
//    - their course and batch
//    - each paper with its status (open / done / locked / not open)
//    - once the admin releases results: scores, grades, position and
//      a "Download Statement of Result" button
//  Papers open in the normal exam room (/student/exam/:id).
// ================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  Lock,
  LogOut,
  PlayCircle,
  RefreshCw,
} from 'lucide-react';

import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import type { CandidatePaper, MyTrainingResponse } from '../../types/training';
import { apiError, apiErrorFromBlob, downloadFile, formatDate, GradeBadge, ordinal } from '../admin/training/trainingUi';

function StatusChip({ paper }: { paper: CandidatePaper }): React.JSX.Element {
  switch (paper.status) {
    case 'completed':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold"><CheckCircle2 size={13} /> Submitted</span>;
    case 'in_progress':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#0369A1] text-sm font-semibold"><Clock size={13} /> In progress</span>;
    case 'available':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E7FBEE] border border-[#4AE17A] text-[#15803D] text-sm font-semibold"><PlayCircle size={13} /> Open</span>;
    case 'locked':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#6B8479] text-sm font-semibold"><Lock size={13} /> Locked</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#6B8479] text-sm font-semibold"><Lock size={13} /> Not open yet</span>;
  }
}

export default function CandidateLobbyPage(): React.JSX.Element {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [data,      setData]      = useState<MyTrainingResponse | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState<boolean>(true);
  const [justDone,  setJustDone]  = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [dlError,   setDlError]   = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get<MyTrainingResponse>('/api/training/me');
      setData(res.data);
    } catch (err: unknown) {
      setError(apiError(err, 'Could not load your papers. Check that the CBT server is on.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect((): void => { void load(); }, [load]);

  // Arriving straight from the exam room after submitting
  useEffect((): void => {
    const state = location.state as { result?: unknown } | null;
    if (state?.result !== undefined) {
      setJustDone(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const downloadStatement = async (): Promise<void> => {
    setDownloading(true);
    setDlError(null);
    try {
      await downloadFile('/api/training/me/statement', 'Statement_of_Result.pdf');
    } catch (err: unknown) {
      setDlError(await apiErrorFromBlob(err, 'Could not download your statement.'));
    } finally {
      setDownloading(false);
    }
  };

  const c = data?.candidate;
  const period = c ? [formatDate(c.start_date), formatDate(c.end_date)].filter(Boolean).join(' – ') : '';
  const nextPaper = data?.papers.find((p) => p.status === 'available' || p.status === 'in_progress') ?? null;
  const allDone = data !== null && data.papers.length > 0 && data.papers.every((p) => p.status === 'completed');

  return (
    <div className="min-h-screen bg-[#F4FBF6]">
      <header className="bg-white border-b border-[#D7F2E0]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4AE17A] flex items-center justify-center flex-shrink-0">
            <GraduationCap size={18} className="text-[#0B1F14]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[#0B1F14] text-base font-bold truncate">{c?.course_name ?? 'Training Course'}</p>
            <p className="text-[#6B8479] text-sm truncate">{c ? `${c.batch_name}${period ? ` · ${period}` : ''}` : ''}</p>
          </div>
          <button type="button" onClick={() => logout('/login/training')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-[#3D5347] border border-[#D7F2E0] hover:bg-[#FEF2F2] hover:text-[#991B1B] hover:border-[#FCA5A5] transition-colors">
            <LogOut size={15} /> Log out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {c && (
          <div>
            <h1 className="text-[#0B1F14] text-2xl font-bold">Welcome, {c.full_name.split(' ')[0]}</h1>
            <p className="text-[#6B8479] text-base mt-0.5">PIN <span className="font-mono font-semibold text-[#3D5347]">{c.login_pin}</span></p>
          </div>
        )}

        {justDone && (
          <div className="flex items-center gap-3 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-5 py-4">
            <CheckCircle2 size={20} className="text-[#15803D] flex-shrink-0" />
            <p className="text-[#15803D] text-base font-semibold flex-1">
              Paper submitted. {nextPaper ? 'Your next paper is ready below.' : allDone ? 'You have completed every paper.' : ''}
            </p>
          </div>
        )}

        {error !== null && (
          <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
            <AlertCircle size={18} className="text-[#991B1B]" />
            <p className="text-[#991B1B] text-base flex-1">{error}</p>
            <button type="button" onClick={() => void load()} className="p-2 rounded-lg text-[#991B1B] hover:bg-[#FCA5A5]/30"><RefreshCw size={16} /></button>
          </div>
        )}

        {loading && data === null && (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white border border-[#D7F2E0] animate-pulse" />)}</div>
        )}

        {/* ── Result summary (after release) ───────────────────── */}
        {data?.results_released === true && data.summary !== null && (
          <div className="bg-white border border-[#86EFAC] rounded-2xl overflow-hidden">
            <div className="bg-[#E7FBEE] px-5 py-3 flex items-center gap-2">
              <Award size={18} className="text-[#15803D]" />
              <p className="text-[#15803D] text-base font-bold">Your Result</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><p className="text-[#6B8479] text-sm">Average</p><p className="text-[#0B1F14] text-2xl font-bold tabular-nums">{data.summary.average.toFixed(2)}%</p></div>
              <div><p className="text-[#6B8479] text-sm">Overall grade</p><div className="mt-1"><GradeBadge grade={data.summary.grade} /></div></div>
              <div><p className="text-[#6B8479] text-sm">Remark</p><p className="text-[#0B1F14] text-lg font-semibold">{data.summary.remark}</p></div>
              <div><p className="text-[#6B8479] text-sm">Position</p><p className="text-[#0B1F14] text-lg font-semibold">{data.summary.position !== null ? `${ordinal(data.summary.position)} of ${data.summary.ranked_count}` : '—'}</p></div>
            </div>
            <div className="px-5 pb-4">
              <button type="button" onClick={() => void downloadStatement()} disabled={downloading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50">
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Download Statement of Result
              </button>
              {dlError !== null && <p className="text-[#991B1B] text-sm mt-2">{dlError}</p>}
              {data.summary.papers_taken < data.summary.papers_total && (
                <p className="text-[#92400E] text-sm mt-2">
                  You took {data.summary.papers_taken} of {data.summary.papers_total} papers. Papers not taken count as 0.
                </p>
              )}
            </div>
          </div>
        )}

        {data !== null && !data.results_released && allDone && (
          <div className="flex items-center gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-5 py-4">
            <Lock size={18} className="text-[#92400E] flex-shrink-0" />
            <p className="text-[#92400E] text-base">
              All your papers are submitted. Your scores will appear here once results are released.
            </p>
          </div>
        )}

        {/* ── Papers ───────────────────────────────────────────── */}
        {data !== null && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[#0B1F14] text-lg font-bold">Your Papers</h2>
              <button type="button" onClick={() => void load()} disabled={loading}
                className="p-2 rounded-lg text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE]" title="Refresh">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            {data.papers_in_order && data.papers.length > 1 && (
              <p className="text-[#6B8479] text-sm">Papers are taken in order — each one opens when you finish the one before.</p>
            )}
            {data.papers.length === 0 ? (
              <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-12 text-center">
                <BookOpen size={28} className="text-[#6B8479] mx-auto mb-3" />
                <p className="text-[#0B1F14] text-base font-bold">No papers yet</p>
                <p className="text-[#6B8479] text-sm mt-1">Check back when the exam officer tells you to start.</p>
              </div>
            ) : (
              data.papers.map((p, i) => {
                const canStart = p.status === 'available' || p.status === 'in_progress';
                return (
                  <div key={p.exam_id}
                    className={`bg-white border rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4 ${canStart ? 'border-[#4AE17A] shadow-sm' : 'border-[#D7F2E0]'}`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${p.status === 'completed' ? 'bg-[#E7FBEE] border-[#86EFAC]' : 'bg-[#F4FBF6] border-[#D7F2E0]'}`}>
                      {p.status === 'completed' ? <CheckCircle2 size={20} className="text-[#15803D]" /> : <FileText size={20} className="text-[#3D5347]" />}
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <p className="text-[#0B1F14] text-base font-semibold">{p.title}</p>
                      <p className="text-[#6B8479] text-sm">
                        Paper {p.paper_order ?? i + 1} · {p.total_questions_to_show} questions · {p.duration_minutes} minutes
                      </p>
                      {p.note !== null && p.status !== 'completed' && <p className="text-[#6B8479] text-sm mt-0.5">{p.note}</p>}
                    </div>
                    {p.status === 'completed' && p.score_percentage !== undefined ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[#0B1F14] text-lg font-bold tabular-nums">{p.score_percentage.toFixed(1)}%</span>
                        <GradeBadge grade={p.grade} />
                      </div>
                    ) : canStart ? (
                      <button type="button" onClick={() => navigate(`/student/exam/${p.exam_id}`)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors">
                        <PlayCircle size={18} /> {p.status === 'in_progress' ? 'Continue' : 'Start'}
                      </button>
                    ) : (
                      <StatusChip paper={p} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
