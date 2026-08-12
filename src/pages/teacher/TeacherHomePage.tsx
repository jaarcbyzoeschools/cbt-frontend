// ================================================================
//  CBT SYSTEM — TEACHER DASHBOARD HOME
//  File    : src/pages/teacher/TeacherHomePage.tsx
//  Design  : Vibrant Institutional Light Mode
//
//  FIX: the dashboard previously called GET /api/teacher/students
//  to populate the "My Students" KPI. That endpoint is now
//  restricted to admin/super_admin, so any teacher hitting
//  Promise.all here got a 403 — and since Promise.all rejects
//  entirely if ANY promise rejects, the whole dashboard failed
//  with "Failed to load dashboard data", even though the
//  exams/results calls would have succeeded fine on their own.
//
//  Replaced with GET /api/teacher/my-subjects, which every teacher
//  can call — the KPI is now "Subjects Taught" instead of an
//  unscoped student count.
// ================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate }                              from 'react-router-dom';
import {
  ClipboardList,
  BarChart3,
  Plus,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Zap,
  BookOpen,
  Users,
  Trophy,
  Clock,
  ToggleLeft,
  ToggleRight,
}                                                   from 'lucide-react';

import axiosInstance                             from '../../api/axiosInstance';
import { useAuth }                               from '../../context/AuthContext';
import { getScoreColour, formatScorePercentage } from '../../utils/scoreColour';
import { formatDuration, formatRelativeTime }    from '../../utils/timeFormatter';
import type { TeacherSubjectAssignment }         from '../../types/exam';


interface ExamRecord {
  exam_id                 : number;
  exam_title              : string;
  subject_name            : string;
  class_name              : string;
  department_name         : string;
  duration_minutes        : number;
  is_active               : boolean;
  question_count          : number;
  total_questions_to_show : number;
  created_at              : string;
}

interface ScoreboardRow {
  result_id       : number;
  full_name       : string;
  exam_title      : string;
  score_percentage: number;
  submitted_at    : string;
}

interface MySubjectsResponse  { success: boolean; subjects: TeacherSubjectAssignment[] }
interface ExamListResponse    { success: boolean; exams: ExamRecord[] }
interface ResultListResponse  { success: boolean; results: ScoreboardRow[] }


function KpiCard({
  label, value, icon, iconBg, iconText, valueCls, subtitle, onClick,
}: {
  label    : string;
  value    : number | string;
  icon     : React.ReactNode;
  iconBg   : string;
  iconText : string;
  valueCls : string;
  subtitle?: string;
  onClick? : () => void;
}): React.JSX.Element {
  return (
    <button
      type      = "button"
      onClick   = {onClick}
      disabled  = {onClick === undefined}
      className = {[
        'bg-white border border-[#D7F2E0] rounded-2xl p-5 text-left w-full',
        'transition-all duration-150',
        onClick !== undefined
          ? 'hover:border-[#4AE17A] hover:shadow-sm cursor-pointer'
          : 'cursor-default',
      ].join(' ')}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${iconBg} ${iconText}`}>
          {icon}
        </div>
        {onClick !== undefined && (
          <ArrowRight size={15} className="text-[#D7F2E0] mt-0.5" />
        )}
      </div>
      <p className={`text-3xl font-bold tabular-nums leading-none ${valueCls}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-[#3D5347] text-sm font-semibold mt-2">{label}</p>
      {subtitle !== undefined && (
        <p className="text-[#6B8479] text-sm mt-0.5">{subtitle}</p>
      )}
    </button>
  );
}


function QuickAction({
  label, icon, iconCls, onClick,
}: {
  label   : string;
  icon    : React.ReactNode;
  iconCls : string;
  onClick : () => void;
}): React.JSX.Element {
  return (
    <button
      type      = "button"
      onClick   = {onClick}
      className = "flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-transparent hover:border-[#D7F2E0] hover:bg-[#F4FBF6] transition-all text-left group"
    >
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${iconCls}`}>
        {icon}
      </div>
      <span className="text-[#3D5347] text-base font-medium group-hover:text-[#0B1F14] transition-colors flex-1">
        {label}
      </span>
      <ArrowRight size={15} className="text-[#D7F2E0] group-hover:text-[#6B8479] transition-colors flex-shrink-0" />
    </button>
  );
}


export default function TeacherHomePage(): React.JSX.Element {
  const { staffUser } = useAuth();
  const navigate      = useNavigate();

  const [exams,         setExams]         = useState<ExamRecord[]>([]);
  const [recentResults, setRecentResults] = useState<ScoreboardRow[]>([]);
  const [subjectCount,  setSubjectCount]  = useState<number>(0);
  const [isLoading,     setIsLoading]     = useState<boolean>(true);
  const [error,         setError]         = useState<string | null>(null);
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null);
  const [toggling,      setToggling]      = useState<number | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const [examRes, resultRes, subjectsRes] = await Promise.all([
        axiosInstance.get<ExamListResponse>('/api/teacher/exams'),
        axiosInstance.get<ResultListResponse>('/api/teacher/results?limit=5&page=1'),
        axiosInstance.get<MySubjectsResponse>('/api/teacher/my-subjects'),
      ]);
      if (examRes.data.success)     setExams(examRes.data.exams);
      if (resultRes.data.success)   setRecentResults(resultRes.data.results);
      if (subjectsRes.data.success) setSubjectCount(subjectsRes.data.subjects.length);
      setLastUpdated(new Date());
    } catch {
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void fetchData(); }, [fetchData]);

  const handleToggleExam = async (examId: number): Promise<void> => {
    setToggling(examId);
    try {
      const res = await axiosInstance.put<{
        success: boolean;
        exam: { id: number; is_active: boolean };
      }>(`/api/teacher/exams/${examId}/toggle`);
      if (res.data.success) {
        setExams((prev) => prev.map((e) =>
          e.exam_id === examId ? { ...e, is_active: res.data.exam.is_active } : e
        ));
      }
    } catch { /* silent */ } finally {
      setToggling(null);
    }
  };

  const totalExams  = exams.length;
  const activeExams = exams.filter((e) => e.is_active).length;
  const recentExams = [...exams]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Welcome, {staffUser?.username ?? 'Teacher'}
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            Your teaching dashboard — manage students, exams, and results.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated !== null && (
            <p className="text-[#6B8479] text-sm hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          <button
            type      = "button"
            onClick   = {() => void fetchData()}
            disabled  = {isLoading}
            className = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#991B1B] text-base font-semibold">{error}</p>
            <button
              type      = "button"
              onClick   = {() => void fetchData()}
              className = "text-[#991B1B] text-sm underline mt-1 hover:opacity-80"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#D7F2E0] rounded-2xl p-5 h-36 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label    = "Subjects Taught"
            value    = {subjectCount}
            icon     = {<Users size={20} />}
            iconBg   = "bg-[#FFFBEB] border-[#FCD34D]"
            iconText = "text-[#92400E]"
            valueCls = "text-[#92400E]"
            subtitle = "Assigned to you"
            onClick  = {() => navigate('/dashboard/teacher/students')}
          />
          <KpiCard
            label    = "Total Exams"
            value    = {totalExams}
            icon     = {<ClipboardList size={20} />}
            iconBg   = "bg-[#E7FBEE] border-[#86EFAC]"
            iconText = "text-[#15803D]"
            valueCls = "text-[#15803D]"
            subtitle = "Created by you"
            onClick  = {() => navigate('/dashboard/teacher/exams')}
          />
          <KpiCard
            label    = "Live Exams"
            value    = {activeExams}
            icon     = {<Zap size={20} />}
            iconBg   = "bg-[#E7FBEE] border-[#4AE17A]"
            iconText = "text-[#15803D]"
            valueCls = "text-[#15803D]"
            subtitle = "Currently active"
            onClick  = {() => navigate('/dashboard/teacher/exams')}
          />
          <KpiCard
            label    = "Recent Results"
            value    = {recentResults.length}
            icon     = {<BarChart3 size={20} />}
            iconBg   = "bg-[#F5F3FF] border-[#DDD6FE]"
            iconText = "text-[#7C3AED]"
            valueCls = "text-[#7C3AED]"
            subtitle = "Last 5 submissions"
            onClick  = {() => navigate('/dashboard/teacher/results')}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

          <div className="flex items-center justify-between px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
            <div className="flex items-center gap-3">
              <ClipboardList size={17} className="text-[#3D5347]" />
              <h2 className="text-[#0B1F14] text-base font-bold">Recent Exams</h2>
              {!isLoading && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                  {recentExams.length}
                </span>
              )}
            </div>
            <button
              type      = "button"
              onClick   = {() => navigate('/dashboard/teacher/exams')}
              className = "flex items-center gap-1.5 text-[#15803D] text-sm font-semibold hover:text-[#22B85C] transition-colors"
            >
              Manage all
              <ArrowRight size={14} />
            </button>
          </div>

          {isLoading && (
            <div className="divide-y divide-[#F4FBF6]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-[#F4FBF6] flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[#F4FBF6] rounded w-2/5" />
                    <div className="h-3 bg-[#F4FBF6] rounded w-1/4" />
                  </div>
                  <div className="h-7 w-14 rounded-full bg-[#F4FBF6]" />
                  <div className="h-8 w-10 rounded-lg bg-[#F4FBF6]" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && recentExams.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-5">
                <ClipboardList size={28} className="text-[#6B8479]" />
              </div>
              <p className="text-[#0B1F14] text-base font-bold">No exams created yet</p>
              <p className="text-[#6B8479] text-sm mt-1.5">Create your first exam to get started.</p>
              <button
                type      = "button"
                onClick   = {() => navigate('/dashboard/teacher/exams')}
                className = "mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14] text-sm font-bold transition-colors"
              >
                <Plus size={15} />
                Create Exam
              </button>
            </div>
          )}

          {!isLoading && recentExams.length > 0 && (
            <div>
              {recentExams.map((exam, i) => {
                const isEven = i % 2 === 0;
                return (
                  <div
                    key       = {exam.exam_id}
                    className = {`flex items-center gap-3 px-6 py-4 border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors last:border-0 ${isEven ? 'bg-white' : 'bg-[#F4FBF6]'}`}
                  >
                    <div className={[
                      'w-10 h-10 rounded-xl border-2 flex items-center justify-center flex-shrink-0',
                      exam.is_active
                        ? 'bg-[#E7FBEE] border-[#4AE17A]'
                        : 'bg-[#F4FBF6] border-[#D7F2E0]',
                    ].join(' ')}>
                      <BookOpen
                        size      = {17}
                        className = {exam.is_active ? 'text-[#15803D]' : 'text-[#6B8479]'}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[#0B1F14] text-base font-semibold truncate">
                          {exam.exam_title}
                        </p>
                        {exam.is_active && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E7FBEE] border border-[#4AE17A] text-[#15803D] text-sm font-semibold">
                            <Zap size={10} />
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[#6B8479] text-sm">{exam.subject_name}</span>
                        <span className="text-[#D7F2E0] text-sm">·</span>
                        <span className="text-[#6B8479] text-sm">{exam.class_name}</span>
                        <span className="text-[#D7F2E0] text-sm">·</span>
                        <div className="flex items-center gap-1 text-[#6B8479] text-sm">
                          <Clock size={12} />
                          {formatDuration(exam.duration_minutes)}
                        </div>
                        <span className="text-[#D7F2E0] text-sm">·</span>
                        <span className="text-[#6B8479] text-sm">
                          {exam.question_count}/{exam.total_questions_to_show} Q
                        </span>
                      </div>
                    </div>

                    <span className="text-[#6B8479] text-sm hidden sm:block flex-shrink-0">
                      {formatRelativeTime(exam.created_at)}
                    </span>

                    <button
                      type      = "button"
                      onClick   = {() => void handleToggleExam(exam.exam_id)}
                      disabled  = {toggling === exam.exam_id}
                      title     = {exam.is_active ? 'Click to deactivate' : 'Click to activate'}
                      className = {[
                        'flex-shrink-0 transition-all duration-150',
                        toggling === exam.exam_id
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:scale-110',
                      ].join(' ')}
                    >
                      {exam.is_active
                        ? <ToggleRight size={28} className="text-[#4AE17A]" />
                        : <ToggleLeft  size={28} className="text-[#6B8479]" />
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">

          <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
              <h2 className="text-[#0B1F14] text-base font-bold">Quick Actions</h2>
            </div>
            <div className="p-3 space-y-1">
              <QuickAction
                label   = "Add Students"
                icon    = {<Users size={17} className="text-[#92400E]" />}
                iconCls = "bg-[#FFFBEB] border-[#FCD34D]"
                onClick = {() => navigate('/dashboard/teacher/students')}
              />
              <QuickAction
                label   = "Create Exam"
                icon    = {<ClipboardList size={17} className="text-[#15803D]" />}
                iconCls = "bg-[#E7FBEE] border-[#86EFAC]"
                onClick = {() => navigate('/dashboard/teacher/exams')}
              />
              <QuickAction
                label   = "View Scoreboard"
                icon    = {<BarChart3 size={17} className="text-[#7C3AED]" />}
                iconCls = "bg-[#F5F3FF] border-[#DDD6FE]"
                onClick = {() => navigate('/dashboard/teacher/results')}
              />
            </div>
          </div>

          <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-[#92400E]" />
                <h2 className="text-[#0B1F14] text-base font-bold">Recent Results</h2>
              </div>
              <button
                type      = "button"
                onClick   = {() => navigate('/dashboard/teacher/results')}
                className = "text-[#15803D] text-sm font-semibold hover:text-[#22B85C] transition-colors"
              >
                View all
              </button>
            </div>

            {isLoading && (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-[#F4FBF6] flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-[#F4FBF6] rounded w-3/4" />
                      <div className="h-3 bg-[#F4FBF6] rounded w-1/2" />
                    </div>
                    <div className="h-7 w-14 bg-[#F4FBF6] rounded-full" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && recentResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-3">
                  <Trophy size={20} className="text-[#6B8479]" />
                </div>
                <p className="text-[#6B8479] text-sm font-medium">No results yet</p>
              </div>
            )}

            {!isLoading && recentResults.length > 0 && (
              <div>
                {recentResults.map((result, i) => {
                  const colour = getScoreColour(result.score_percentage);
                  const isEven = i % 2 === 0;
                  return (
                    <div
                      key       = {result.result_id}
                      className = {`flex items-center gap-3 px-5 py-3.5 border-b border-[#F4FBF6] last:border-0 hover:bg-[#E7FBEE] transition-colors ${isEven ? 'bg-white' : 'bg-[#F4FBF6]'}`}
                    >
                      <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${colour.borderClass} ${colour.bgClass}`}>
                        <span className={`text-sm font-bold ${colour.textClass}`}>
                          {Math.round(result.score_percentage)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#0B1F14] text-sm font-semibold truncate">
                          {result.full_name}
                        </p>
                        <p className="text-[#6B8479] text-sm truncate">
                          {result.exam_title}
                        </p>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${colour.textClass}`}>
                        {formatScorePercentage(result.score_percentage)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}