// ================================================================
//  CBT SYSTEM — SUPER ADMIN DASHBOARD HOME
//  File    : src/pages/superadmin/SuperAdminHomePage.tsx
//
//  Design system: Vibrant Institutional Light Mode
//  Canvas  #F4FBF6 · Surface #FFFFFF · Border #D7F2E0
//  Ink-1   #0B1F14 · Ink-2  #3D5347 · Ink-3  #6B8479
//  Accent  #4AE17A · Accent-Hov #22B85C · Accent-L #E7FBEE
// ================================================================

import React, {
  useCallback,
  useEffect,
  useState,
}                        from 'react';
import { useNavigate }   from 'react-router-dom';
import {
  GitBranch,
  ShieldCheck,
  Users,
  GraduationCap,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Building2,
  Plus,
  BarChart3,
  Calendar,
  Eye,
  BookOpen,
  Clock,
  TrendingUp,
}                        from 'lucide-react';

import axiosInstance     from '../../api/axiosInstance';
import { useAuth }       from '../../context/AuthContext';
import type { Branch }   from '../../types/exam';


// ================================================================
//  HELPERS
// ================================================================

function toNum(value: unknown): number {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const p = parseFloat(value);
    if (isFinite(p)) return p;
  }
  return 0;
}


// ================================================================
//  TYPES
// ================================================================

interface BranchListResponse {
  success  : boolean;
  count    : number;
  branches : Branch[];
}

interface ActivePeriodResponse {
  success       : boolean;
  display       : string;
  active_session: string;
  active_term   : number;
  term_label    : string;
  updated_at    : string;
}

interface ResultsKpis {
  total_submissions: number | string;
  average_score    : number | string;
  pass_rate        : number | string;
  distinction_rate : number | string;
}

interface ResultsOverviewResponse {
  success: boolean;
  kpis   : ResultsKpis;
}


// ================================================================
//  KPI CARD
// ================================================================

interface KpiCardProps {
  label    : string;
  value    : string | number;
  icon     : React.ReactNode;
  iconBg   : string;
  iconText : string;
  valueCls : string;
  subtitle?: string;
  onClick? : () => void;
}

function KpiCard({
  label,
  value,
  icon,
  iconBg,
  iconText,
  valueCls,
  subtitle,
  onClick,
}: KpiCardProps): React.JSX.Element {
  return (
    <div
      onClick   = {onClick}
      className = {[
        'bg-white border border-[#D7F2E0] rounded-2xl p-5',
        'transition-all duration-150',
        onClick !== undefined
          ? 'cursor-pointer hover:border-[#4AE17A] hover:shadow-sm'
          : '',
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
    </div>
  );
}


// ================================================================
//  STUDENT COUNT BAR
// ================================================================

function StudentBar({ value, max }: { value: number; max: number }): React.JSX.Element {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-[#F4FBF6] rounded-full h-2">
        <div
          className = "bg-[#4AE17A] h-2 rounded-full transition-all duration-300"
          style     = {{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[#3D5347] text-sm font-semibold tabular-nums w-12 text-right">
        {value.toLocaleString()}
      </span>
    </div>
  );
}


// ================================================================
//  QUICK ACTION CARD
// ================================================================

interface QuickActionProps {
  label   : string;
  subtitle: string;
  icon    : React.ReactNode;
  iconCls : string;
  onClick : () => void;
}

function QuickAction({
  label,
  subtitle,
  icon,
  iconCls,
  onClick,
}: QuickActionProps): React.JSX.Element {
  return (
    <button
      type      = "button"
      onClick   = {onClick}
      className = "flex items-center gap-4 p-4 bg-white border border-[#D7F2E0] rounded-2xl hover:border-[#4AE17A] hover:bg-[#E7FBEE] transition-all group text-left w-full"
    >
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${iconCls}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[#0B1F14] text-base font-semibold truncate">{label}</p>
        <p className="text-[#6B8479] text-sm mt-0.5 truncate">{subtitle}</p>
      </div>
      <ArrowRight
        size      = {16}
        className = "text-[#D7F2E0] flex-shrink-0 group-hover:text-[#15803D] transition-colors"
      />
    </button>
  );
}


// ================================================================
//  MAIN COMPONENT
// ================================================================

export default function SuperAdminHomePage(): React.JSX.Element {
  const { staffUser } = useAuth();
  const navigate      = useNavigate();

  const [branches,     setBranches]     = useState<Branch[]>([]);
  const [activePeriod, setActivePeriod] = useState<ActivePeriodResponse | null>(null);
  const [kpis,         setKpis]         = useState<ResultsKpis | null>(null);
  const [isLoading,    setIsLoading]    = useState<boolean>(true);
  const [error,        setError]        = useState<string | null>(null);
  const [lastFetched,  setLastFetched]  = useState<Date | null>(null);

  const fetchAll = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const [branchRes, periodRes, resultsRes] = await Promise.allSettled([
        axiosInstance.get<BranchListResponse>('/api/superadmin/branches'),
        axiosInstance.get<ActivePeriodResponse>('/api/settings/active-period'),
        axiosInstance.get<ResultsOverviewResponse>('/api/superadmin/overview/results'),
      ]);

      if (branchRes.status === 'fulfilled' && branchRes.value.data.success) {
        setBranches(branchRes.value.data.branches);
        setLastFetched(new Date());
      } else {
        setError('Failed to load branch data. Check that the server is running.');
      }
      if (periodRes.status === 'fulfilled' && periodRes.value.data.success) {
        setActivePeriod(periodRes.value.data);
      }
      if (resultsRes.status === 'fulfilled' && resultsRes.value.data.success) {
        setKpis(resultsRes.value.data.kpis);
      }
    } catch {
      setError('Failed to load dashboard data. Check that the server is running.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void fetchAll(); }, [fetchAll]);

  const totalBranches = branches.length;
  const totalAdmins   = branches.reduce((s, b) => s + toNum(b.admin_count),   0);
  const totalTeachers = branches.reduce((s, b) => s + toNum(b.teacher_count), 0);
  const totalStudents = branches.reduce((s, b) => s + toNum(b.student_count), 0);
  const maxStudents   = Math.max(...branches.map((b) => toNum(b.student_count)), 1);

  const passRate   = kpis !== null ? toNum(kpis.pass_rate)        : null;
  const avgScore   = kpis !== null ? toNum(kpis.average_score)    : null;
  const totalSubs  = kpis !== null ? toNum(kpis.total_submissions) : null;


  // ================================================================
  //  RENDER
  // ================================================================

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Welcome back, {staffUser?.username ?? 'Administrator'}
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            System-wide overview across all campus branches.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {lastFetched !== null && (
            <p className="text-[#6B8479] text-sm">
              Updated {lastFetched.toLocaleTimeString('en-NG')}
            </p>
          )}
          <button
            type      = "button"
            onClick   = {() => void fetchAll()}
            disabled  = {isLoading}
            className = "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type      = "button"
            onClick   = {() => navigate('/dashboard/superadmin/overview')}
            className = "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors"
          >
            <Eye size={15} />
            Full Overview
          </button>
        </div>
      </div>


      {/* ── Active period banner ──────────────────────────────── */}
      {activePeriod !== null && (
        <div className="flex items-center justify-between gap-4 bg-white border border-[#D7F2E0] rounded-2xl px-6 py-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
              <Calendar size={20} className="text-[#15803D]" />
            </div>
            <div>
              <p className="text-[#6B8479] text-sm font-medium uppercase tracking-wider">
                Active Academic Period
              </p>
              <p className="text-[#0B1F14] text-xl font-bold mt-0.5">
                {activePeriod.display}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[#6B8479] text-sm">
              <Clock size={15} />
              <span>
                Set {new Date(activePeriod.updated_at).toLocaleDateString('en-NG', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </span>
            </div>
            <button
              type      = "button"
              onClick   = {() => navigate('/dashboard/superadmin/academic-period')}
              className = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#15803D] bg-[#E7FBEE] border border-[#86EFAC] hover:bg-[#D1F5DE] transition-colors"
            >
              Change Period
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}


      {/* ── Error banner ──────────────────────────────────────── */}
      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#991B1B] text-base font-semibold">{error}</p>
            <button
              type      = "button"
              onClick   = {() => void fetchAll()}
              className = "text-[#991B1B] text-sm underline mt-1 hover:opacity-80"
            >
              Try again
            </button>
          </div>
        </div>
      )}


      {/* ── KPI CARDS ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#D7F2E0] rounded-2xl p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

          <KpiCard
            label    = "Campus Branches"
            value    = {totalBranches}
            icon     = {<GitBranch size={20} />}
            iconBg   = "bg-[#E7FBEE] border-[#86EFAC]"
            iconText = "text-[#15803D]"
            valueCls = "text-[#15803D]"
            subtitle = "Active locations"
            onClick  = {() => navigate('/dashboard/superadmin/branches')}
          />

          <KpiCard
            label    = "Administrators"
            value    = {totalAdmins}
            icon     = {<ShieldCheck size={20} />}
            iconBg   = "bg-[#F5F3FF] border-[#DDD6FE]"
            iconText = "text-[#7C3AED]"
            valueCls = "text-[#7C3AED]"
            subtitle = "Branch admin accounts"
            onClick  = {() => navigate('/dashboard/superadmin/admins')}
          />

          <KpiCard
            label    = "Teachers"
            value    = {totalTeachers}
            icon     = {<Users size={20} />}
            iconBg   = "bg-[#EFF6FF] border-[#BAE6FD]"
            iconText = "text-[#0369A1]"
            valueCls = "text-[#0369A1]"
            subtitle = "Teaching staff"
          />

          <KpiCard
            label    = "Total Students"
            value    = {totalStudents}
            icon     = {<GraduationCap size={20} />}
            iconBg   = "bg-[#FFFBEB] border-[#FCD34D]"
            iconText = "text-[#92400E]"
            valueCls = "text-[#92400E]"
            subtitle = "Enrolled system-wide"
            onClick  = {() => navigate('/dashboard/superadmin/overview')}
          />

          <KpiCard
            label    = "Submissions"
            value    = {totalSubs !== null ? totalSubs.toLocaleString() : '—'}
            icon     = {<BarChart3 size={20} />}
            iconBg   = "bg-[#E7FBEE] border-[#86EFAC]"
            iconText = "text-[#15803D]"
            valueCls = "text-[#15803D]"
            subtitle = "Total results recorded"
            onClick  = {() => navigate('/dashboard/teacher/results')}
          />

          <KpiCard
            label    = "Pass Rate"
            value    = {passRate !== null ? `${passRate.toFixed(1)}%` : '—'}
            icon     = {<TrendingUp size={20} />}
            iconBg   = {
              passRate === null         ? 'bg-[#F4FBF6] border-[#D7F2E0]' :
              passRate >= 60            ? 'bg-[#E7FBEE] border-[#86EFAC]' :
              passRate >= 40            ? 'bg-[#FFFBEB] border-[#FCD34D]' :
                                          'bg-[#FEF2F2] border-[#FCA5A5]'
            }
            iconText = {
              passRate === null         ? 'text-[#6B8479]' :
              passRate >= 60            ? 'text-[#15803D]' :
              passRate >= 40            ? 'text-[#92400E]' :
                                          'text-[#991B1B]'
            }
            valueCls = {
              passRate === null         ? 'text-[#6B8479]' :
              passRate >= 60            ? 'text-[#15803D]' :
              passRate >= 40            ? 'text-[#92400E]' :
                                          'text-[#991B1B]'
            }
            subtitle = {
              avgScore !== null
                ? `Avg score: ${avgScore.toFixed(1)}%`
                : 'No exam data yet'
            }
          />
        </div>
      )}


      {/* ── BRANCH DIRECTORY TABLE ────────────────────────────── */}
      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

        {/* Table header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
          <div className="flex items-center gap-3">
            <Building2 size={18} className="text-[#3D5347]" />
            <h2 className="text-[#0B1F14] text-base font-bold">Branch Directory</h2>
            {!isLoading && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                {totalBranches}
              </span>
            )}
          </div>
          <button
            type      = "button"
            onClick   = {() => navigate('/dashboard/superadmin/branches')}
            className = "flex items-center gap-1.5 text-[#15803D] text-sm font-semibold hover:text-[#22B85C] transition-colors"
          >
            Manage Branches
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="divide-y divide-[#F4FBF6]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-6 py-4 animate-pulse flex gap-4">
                <div className="h-5 bg-[#F4FBF6] rounded w-1/3" />
                <div className="h-5 bg-[#F4FBF6] rounded w-12 ml-auto" />
                <div className="h-5 bg-[#F4FBF6] rounded w-12" />
                <div className="h-5 bg-[#F4FBF6] rounded w-32" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && branches.length === 0 && error === null && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-4">
              <GitBranch size={28} className="text-[#6B8479]" />
            </div>
            <p className="text-[#0B1F14] text-base font-bold">No branches configured yet</p>
            <p className="text-[#6B8479] text-sm mt-1 max-w-xs">
              Create your first campus branch to begin setting up the exam system.
            </p>
            <button
              type      = "button"
              onClick   = {() => navigate('/dashboard/superadmin/branches')}
              className = "mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14] text-sm font-bold transition-colors"
            >
              <Plus size={16} />
              Create First Branch
            </button>
          </div>
        )}

        {/* Data table */}
        {!isLoading && branches.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D7F2E0]">
                  {['Branch', 'Admins', 'Teachers', 'Student Count', 'Action'].map((h, i) => (
                    <th
                      key       = {h}
                      className = {[
                        'py-3.5 text-[#3D5347] font-semibold text-sm uppercase tracking-wider',
                        i === 0   ? 'text-left  px-6' :
                        i === 4   ? 'text-right px-6' :
                                    'text-center px-4',
                      ].join(' ')}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {branches.map((branch, rowIdx) => {
                  const adminCount   = toNum(branch.admin_count);
                  const teacherCount = toNum(branch.teacher_count);
                  const studentCount = toNum(branch.student_count);
                  const isEven       = rowIdx % 2 === 0;

                  return (
                    <tr
                      key       = {branch.id}
                      className = {`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors group ${isEven ? 'bg-white' : 'bg-[#F4FBF6]'}`}
                    >
                      {/* Branch */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
                            <Building2 size={17} className="text-[#15803D]" />
                          </div>
                          <div>
                            <p className="text-[#0B1F14] text-base font-semibold">
                              {branch.name}
                            </p>
                            <p className="text-[#6B8479] text-sm">
                              ID: {branch.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Admins */}
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] text-sm font-bold">
                          {adminCount}
                        </span>
                      </td>

                      {/* Teachers */}
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#0369A1] text-sm font-bold">
                          {teacherCount}
                        </span>
                      </td>

                      {/* Students — bar */}
                      <td className="px-4 py-4">
                        <div className="min-w-[160px]">
                          <StudentBar value={studentCount} max={maxStudents} />
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        <button
                          type      = "button"
                          onClick   = {() => navigate('/dashboard/superadmin/admins')}
                          className = "opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-[#15803D] text-sm font-semibold hover:text-[#22B85C] transition-all ml-auto"
                        >
                          View Admins
                          <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals footer */}
              {branches.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-[#D7F2E0] bg-[#F4FBF6]">
                    <td className="px-6 py-4">
                      <span className="text-[#3D5347] text-sm font-bold uppercase tracking-wider">
                        System Total
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-[#7C3AED] text-base font-bold tabular-nums">
                        {totalAdmins}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-[#0369A1] text-base font-bold tabular-nums">
                        {totalTeachers}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[#92400E] text-base font-bold tabular-nums">
                        {totalStudents.toLocaleString()} students total
                      </span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>


      {/* ── QUICK ACTIONS ─────────────────────────────────────── */}
      <div>
        <h2 className="text-[#0B1F14] text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction
            label   = "Manage Branches"
            subtitle= "Add or configure campus locations"
            icon    = {<GitBranch    size={18} className="text-[#15803D]" />}
            iconCls = "bg-[#E7FBEE] border-[#86EFAC]"
            onClick = {() => navigate('/dashboard/superadmin/branches')}
          />
          <QuickAction
            label   = "Manage Administrators"
            subtitle= "Provision branch admin accounts"
            icon    = {<ShieldCheck  size={18} className="text-[#7C3AED]" />}
            iconCls = "bg-[#F5F3FF] border-[#DDD6FE]"
            onClick = {() => navigate('/dashboard/superadmin/admins')}
          />
          <QuickAction
            label   = "Institution Overview"
            subtitle= "Staff, students, exams and results"
            icon    = {<Eye          size={18} className="text-[#0369A1]" />}
            iconCls = "bg-[#EFF6FF] border-[#BAE6FD]"
            onClick = {() => navigate('/dashboard/superadmin/overview')}
          />
          <QuickAction
            label   = "Academic Period"
            subtitle= "Change the active session and term"
            icon    = {<Calendar     size={18} className="text-[#92400E]" />}
            iconCls = "bg-[#FFFBEB] border-[#FCD34D]"
            onClick = {() => navigate('/dashboard/superadmin/academic-period')}
          />
          <QuickAction
            label   = "Scoreboard & Reports"
            subtitle= "View and export student results"
            icon    = {<BarChart3    size={18} className="text-[#15803D]" />}
            iconCls = "bg-[#E7FBEE] border-[#86EFAC]"
            onClick = {() => navigate('/dashboard/teacher/results')}
          />
          <QuickAction
            label   = "Exam Management"
            subtitle= "View and manage all active exams"
            icon    = {<BookOpen     size={18} className="text-[#991B1B]" />}
            iconCls = "bg-[#FEF2F2] border-[#FCA5A5]"
            onClick = {() => navigate('/dashboard/teacher/exams')}
          />
        </div>
      </div>
    </div>
  );
}