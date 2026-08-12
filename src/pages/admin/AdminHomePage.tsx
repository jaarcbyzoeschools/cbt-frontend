// ================================================================
//  CBT SYSTEM — BRANCH ADMIN DASHBOARD HOME
//  File    : src/pages/admin/AdminHomePage.tsx
//  Design  : Vibrant Institutional Light Mode
//  Logic   : Unchanged — full rewrite with new tokens
//
//  Phase 3 addition: "Report Cards" quick action opens
//  ReportCardPanel (generate + approve workflow).
// ================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate }                              from 'react-router-dom';
import {
  UserCheck,
  GraduationCap,
  BookOpen,
  ArrowRight,
  Building2,
  RefreshCw,
  AlertCircle,
  Plus,
  Users,
  Calendar,
  PenLine, 
  CheckCircle as CheckCircleIcon, 
  XCircle as XCircleIcon,
  X,
  Loader2,
  Award,
}                                                   from 'lucide-react';

import axiosInstance from '../../api/axiosInstance';
import { useAuth }   from '../../context/AuthContext';
import type { Branch, ManualScoreEntry } from '../../types/exam';
import ReportCardPanel from '../../../components/admin/ReportCardPanel';

// ================================================================
//  TYPES
// ================================================================

interface TeacherRecord {
  id                  : number;
  username            : string;
  email               : string;
  branch_id           : number;
  branch_name         : string;
  created_by_username : string | null;
  created_at          : string;
}

interface TeacherListResponse { success: boolean; count: number; teachers: TeacherRecord[] }
interface BranchListResponse  { success: boolean; branches: Branch[] }


// ================================================================
//  KPI CARD
// ================================================================

interface KpiCardProps {
  label    : string;
  value    : number;
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
        {value.toLocaleString()}
      </p>
      <p className="text-[#3D5347] text-sm font-semibold mt-2">{label}</p>
      {subtitle !== undefined && (
        <p className="text-[#6B8479] text-sm mt-0.5">{subtitle}</p>
      )}
    </button>
  );
}


// ================================================================
//  QUICK ACTION BUTTON
// ================================================================

function QuickAction({
  label,
  subtitle,
  icon,
  iconCls,
  onClick,
}: {
  label   : string;
  subtitle: string;
  icon    : React.ReactNode;
  iconCls : string;
  onClick : () => void;
}): React.JSX.Element {
  return (
    <button
      type      = "button"
      onClick   = {onClick}
      className = "flex items-center gap-4 p-5 bg-white border border-[#D7F2E0] rounded-2xl hover:border-[#4AE17A] hover:bg-[#E7FBEE] transition-all group text-left"
    >
      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${iconCls}`}>
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

function usePendingManualCount(): {
  count    : number;
  isLoading: boolean;
  refresh  : () => void;
} {
  const [count,     setCount]     = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await axiosInstance.get<{ success: boolean; pending_count: number }>(
        '/api/admin/manual-scores/count'
      );
      if (res.data.success) setCount(res.data.pending_count);
    } catch {
      // Non-fatal — badge shows 0 on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void refresh(); }, [refresh]);

  return { count, isLoading, refresh };
}


function ManualApprovalModal({
  onClose,
  onApproved,
}: {
  onClose   : () => void;
  onApproved: () => void;
}): React.JSX.Element {
  const [entries,      setEntries]      = useState<ManualScoreEntry[]>([]);
  const [isLoading,    setIsLoading]    = useState<boolean>(true);
  const [error,        setError]        = useState<string | null>(null);
  const [actioning,    setActioning]    = useState<number | null>(null);
  const [reviewNote,   setReviewNote]   = useState<string>('');
  const [confirmEntry, setConfirmEntry] = useState<{
    entry : ManualScoreEntry;
    action: 'approve' | 'reject';
  } | null>(null);

  const fetchEntries = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get<{
        success: boolean;
        entries: ManualScoreEntry[];
      }>('/api/admin/manual-scores?status=pending');
      if (res.data.success) setEntries(res.data.entries);
    } catch {
      setError('Failed to load pending entries.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void fetchEntries(); }, [fetchEntries]);

  useEffect((): (() => void) => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return (): void => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleReview = async (): Promise<void> => {
    if (confirmEntry === null) return;
    setActioning(confirmEntry.entry.id);
    try {
      await axiosInstance.put(
        `/api/admin/manual-scores/${confirmEntry.entry.id}/review`,
        { action: confirmEntry.action, review_note: reviewNote || undefined }
      );
      setEntries((prev) => prev.filter((e) => e.id !== confirmEntry.entry.id));
      setConfirmEntry(null);
      setReviewNote('');
      onApproved(); // refresh the badge count
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? 'Action failed.');
      }
    } finally {
      setActioning(null);
    }
  };

  const ENTRY_TYPE_LABELS: Record<string, string> = {
    bonus               : 'Bonus',
    component           : 'Component',
    absence_replacement : 'Absence',
  };

  return (
    <>
      <div
        className  = "fixed inset-0 z-40 bg-[#0B1F14]/50"
        onClick    = {onClose}
        aria-hidden= "true"
      />
      <div
        className = "fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        role      = "dialog"
        aria-modal= "true"
      >
        <div className="w-full max-w-2xl bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl my-4">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] border border-[#FCD34D] flex items-center justify-center">
                <PenLine size={17} className="text-[#92400E]" />
              </div>
              <div>
                <h2 className="text-[#0B1F14] text-lg font-bold">Manual Score Approvals</h2>
                <p className="text-[#6B8479] text-sm">Review and approve teacher-submitted manual scores</p>
              </div>
            </div>
            <button
              type      = "button"
              onClick   = {onClose}
              className = "p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">

            {error !== null && (
              <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-[#991B1B]" />
                <p className="text-[#991B1B] text-base">{error}</p>
              </div>
            )}

            {isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 bg-[#F4FBF6] rounded-2xl animate-pulse" />
                ))}
              </div>
            )}

            {!isLoading && entries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center mb-4">
                  <CheckCircleIcon size={26} className="text-[#15803D]" />
                </div>
                <p className="text-[#0B1F14] text-base font-bold">No pending approvals</p>
                <p className="text-[#6B8479] text-sm mt-1">
                  All manual score entries have been reviewed.
                </p>
              </div>
            )}

            {!isLoading && entries.map((entry) => {
              const isActioning_ = actioning === entry.id;
              return (
                <div
                  key       = {entry.id}
                  className = "bg-[#F4FBF6] border border-[#D7F2E0] rounded-2xl p-5"
                >
                  {/* Entry header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[#0B1F14] text-base font-bold">{entry.student_name}</p>
                        <span className="text-[#6B8479] text-sm font-mono">{entry.login_pin}</span>
                        {entry.branch_name && (
                          <span className="px-2 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-xs font-semibold">
                            {entry.branch_name}
                          </span>
                        )}
                      </div>
                      <p className="text-[#6B8479] text-sm mt-1 truncate">
                        {entry.exam_title}
                        {entry.evaluation_type && (
                          <span className="ml-2 text-xs">
                            · {entry.evaluation_type === 'midterm' ? 'CA' : 'Terminal'}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E] text-sm font-semibold flex-shrink-0">
                      {ENTRY_TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
                    </span>
                  </div>

                  {/* Score detail */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-white border border-[#D7F2E0] rounded-xl px-3 py-2.5 text-center">
                      <p className="text-[#6B8479] text-xs font-semibold uppercase tracking-wide">CBT Score</p>
                      <p className="text-[#0B1F14] text-base font-bold mt-0.5">
                        {entry.cbt_score_percentage !== null
                          ? `${entry.cbt_score_percentage.toFixed(1)}%`
                          : 'No CBT'}
                      </p>
                    </div>
                    <div className="bg-white border border-[#D7F2E0] rounded-xl px-3 py-2.5 text-center">
                      <p className="text-[#6B8479] text-xs font-semibold uppercase tracking-wide">Manual Score</p>
                      <p className="text-[#0B1F14] text-base font-bold mt-0.5">
                        {entry.raw_score}/{entry.component_max}
                      </p>
                    </div>
                    <div className="bg-white border border-[#D7F2E0] rounded-xl px-3 py-2.5 text-center">
                      <p className="text-[#6B8479] text-xs font-semibold uppercase tracking-wide">Submitted By</p>
                      <p className="text-[#0B1F14] text-sm font-semibold mt-0.5 truncate">
                        {entry.created_by_username}
                      </p>
                    </div>
                  </div>

                  {/* Note */}
                  {entry.note && (
                    <div className="bg-white border border-[#D7F2E0] rounded-xl px-4 py-2.5 mb-4">
                      <p className="text-[#6B8479] text-xs font-semibold uppercase tracking-wide mb-1">Note</p>
                      <p className="text-[#3D5347] text-sm">{entry.note}</p>
                    </div>
                  )}

                  {/* Confirm sub-form or action buttons */}
                  {confirmEntry?.entry.id === entry.id ? (
                    <div className="space-y-3">
                      <input
                        type        = "text"
                        value       = {reviewNote}
                        onChange    = {(e) => setReviewNote(e.target.value)}
                        placeholder = {confirmEntry.action === 'reject'
                          ? 'Reason for rejection (optional)…'
                          : 'Approval note (optional)…'
                        }
                        className   = "w-full bg-white border border-[#D7F2E0] rounded-xl px-4 py-2.5 text-sm text-[#0B1F14] placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A] transition-all"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type      = "button"
                          onClick   = {() => { setConfirmEntry(null); setReviewNote(''); }}
                          className = "px-4 py-2 rounded-xl text-sm font-semibold text-[#3D5347] bg-[#F4FBF6] border border-[#D7F2E0] hover:bg-[#E7FBEE] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type      = "button"
                          onClick   = {() => void handleReview()}
                          disabled  = {isActioning_}
                          className = {[
                            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50',
                            confirmEntry.action === 'approve'
                              ? 'bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14]'
                              : 'bg-[#DC2626] hover:bg-[#B91C1C] text-white',
                          ].join(' ')}
                        >
                          {isActioning_ && <Loader2 size={14} className="animate-spin" />}
                          {confirmEntry.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type      = "button"
                        onClick   = {() => setConfirmEntry({ entry, action: 'approve' })}
                        disabled  = {isActioning_}
                        className = "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
                      >
                        <CheckCircleIcon size={14} />
                        Approve
                      </button>
                      <button
                        type      = "button"
                        onClick   = {() => setConfirmEntry({ entry, action: 'reject' })}
                        disabled  = {isActioning_}
                        className = "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5] hover:bg-[#FEE2E2] transition-colors disabled:opacity-50"
                      >
                        <XCircleIcon size={14} />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}


// ================================================================
//  MAIN COMPONENT
// ================================================================

export default function AdminHomePage(): React.JSX.Element {
  const { staffUser } = useAuth();
  const navigate      = useNavigate();

  const [teachers,    setTeachers]    = useState<TeacherRecord[]>([]);
  const [branchInfo,  setBranchInfo]  = useState<Branch | null>(null);
  const [isLoading,   setIsLoading]   = useState<boolean>(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
const { count: pendingCount, refresh: refreshPendingCount } = usePendingManualCount();
const [showApprovals, setShowApprovals] = useState<boolean>(false);
const [showReportCards, setShowReportCards] = useState<boolean>(false);

  // ── Fetch ────────────────────────────────────────────────────

  const fetchData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const [teacherRes, branchRes] = await Promise.all([
        axiosInstance.get<TeacherListResponse>('/api/admin/teachers'),
        axiosInstance.get<BranchListResponse>('/api/shared/branches'),
      ]);
      if (teacherRes.data.success) setTeachers(teacherRes.data.teachers);
      if (
        branchRes.data.success &&
        staffUser?.branch_id !== null &&
        staffUser?.branch_id !== undefined
      ) {
        const myBranch = branchRes.data.branches.find((b) => b.id === staffUser.branch_id);
        setBranchInfo(myBranch ?? null);
      }
      setLastUpdated(new Date());
    } catch {
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [staffUser?.branch_id]);

  useEffect((): void => { void fetchData(); }, [fetchData]);


  // ── Derived ──────────────────────────────────────────────────

  const teacherCount   = teachers.length;
  const studentCount   = branchInfo?.student_count ?? 0;
  const recentTeachers = [...teachers]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);


  // ================================================================
  //  RENDER
  // ================================================================

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Welcome, {staffUser?.username ?? 'Administrator'}
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            Branch administration dashboard — manage your campus staff and structure.
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


      {/* ── Branch identity banner ────────────────────────────── */}
      <div className="flex items-center gap-5 bg-white border-2 border-[#86EFAC] rounded-2xl px-6 py-5 flex-wrap">
        <div className="w-14 h-14 rounded-2xl bg-[#4AE17A] flex items-center justify-center flex-shrink-0">
          <Building2 size={26} className="text-[#0B1F14]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[#6B8479] text-sm font-medium uppercase tracking-wider">
            Your Campus Branch
          </p>
          {isLoading ? (
            <div className="h-6 w-48 bg-[#F4FBF6] rounded-lg animate-pulse mt-1.5" />
          ) : (
            <p className="text-[#0B1F14] text-2xl font-bold truncate mt-0.5">
              {branchInfo?.name ?? `Branch ID ${staffUser?.branch_id ?? '—'}`}
            </p>
          )}
        </div>
        {!isLoading && branchInfo !== null && (
          <div className="hidden sm:flex items-center gap-6">
            <div className="text-center">
              <p className="text-[#0B1F14] text-2xl font-bold tabular-nums">
                {branchInfo.teacher_count}
              </p>
              <p className="text-[#6B8479] text-sm">Teachers</p>
            </div>
            <div className="w-px h-10 bg-[#D7F2E0]" />
            <div className="text-center">
              <p className="text-[#0B1F14] text-2xl font-bold tabular-nums">
                {branchInfo.student_count.toLocaleString()}
              </p>
              <p className="text-[#6B8479] text-sm">Students</p>
            </div>
          </div>
        )}
      </div>


      {/* ── Error ─────────────────────────────────────────────── */}
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


      {/* ── KPI Cards ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white border border-[#D7F2E0] rounded-2xl p-5 h-36 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <KpiCard
            label    = "Teachers in Branch"
            value    = {teacherCount}
            icon     = {<UserCheck size={20} />}
            iconBg   = "bg-[#E7FBEE] border-[#86EFAC]"
            iconText = "text-[#15803D]"
            valueCls = "text-[#15803D]"
            subtitle = "Active teaching staff"
            onClick  = {() => navigate('/dashboard/admin/teachers')}
          />
          <KpiCard
            label    = "Students Enrolled"
            value    = {studentCount}
            icon     = {<GraduationCap size={20} />}
            iconBg   = "bg-[#FFFBEB] border-[#FCD34D]"
            iconText = "text-[#92400E]"
            valueCls = "text-[#92400E]"
            subtitle = "Across all classes"
          />
        </div>
      )}


      {/* ── Quick actions ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickAction
          label   = "Manage Teachers"
          subtitle= "Add and manage teaching staff"
          icon    = {<UserCheck size={20} className="text-[#15803D]" />}
          iconCls = "bg-[#E7FBEE] border-[#86EFAC]"
          onClick = {() => navigate('/dashboard/admin/teachers')}
        />
        <QuickAction
          label   = "Classes & Departments"
          subtitle= "View curriculum structure"
          icon    = {<BookOpen size={20} className="text-[#0369A1]" />}
          iconCls = "bg-[#EFF6FF] border-[#BAE6FD]"
          onClick = {() => navigate('/dashboard/admin/classes')}
        />
        <QuickAction
              label   = "Manual Score Approvals"
              subtitle= {pendingCount > 0
                ? `${pendingCount} entry${pendingCount === 1 ? '' : 'ies'} awaiting your review`
                : 'No pending approvals'}
              icon    = {
                <div className="relative">
                  <PenLine size={20} className="text-[#92400E]" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </div>
              }
              iconCls = "bg-[#FFFBEB] border-[#FCD34D]"
              onClick = {() => setShowApprovals(true)}
            />
        <QuickAction
              label   = "Report Cards"
              subtitle= "Generate and approve class report cards"
              icon    = {<Award size={20} className="text-[#0369A1]" />}
              iconCls = "bg-[#EFF6FF] border-[#BAE6FD]"
              onClick = {() => setShowReportCards(true)}
            />
      </div>


      {/* ── Recent teachers panel ─────────────────────────────── */}
      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
          <div className="flex items-center gap-3">
            <Users size={17} className="text-[#3D5347]" />
            <h2 className="text-[#0B1F14] text-base font-bold">
              Recently Added Teachers
            </h2>
            {!isLoading && recentTeachers.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                {recentTeachers.length}
              </span>
            )}
          </div>
          <button
            type      = "button"
            onClick   = {() => navigate('/dashboard/admin/teachers')}
            className = "flex items-center gap-1.5 text-[#15803D] text-sm font-semibold hover:text-[#22B85C] transition-colors"
          >
            View all
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Skeleton */}
        {isLoading && (
          <div className="divide-y divide-[#F4FBF6]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-[#F4FBF6] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F4FBF6] rounded w-1/3" />
                  <div className="h-3 bg-[#F4FBF6] rounded w-1/4" />
                </div>
                <div className="h-3 w-20 bg-[#F4FBF6] rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && recentTeachers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-5">
              <UserCheck size={28} className="text-[#6B8479]" />
            </div>
            <p className="text-[#0B1F14] text-base font-bold">No teachers registered yet</p>
            <p className="text-[#6B8479] text-sm mt-1.5 max-w-xs">
              Add your first teacher to begin setting up the branch.
            </p>
            <button
              type      = "button"
              onClick   = {() => navigate('/dashboard/admin/teachers')}
              className = "mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14] text-base font-bold transition-colors"
            >
              <Plus size={16} />
              Add First Teacher
            </button>
          </div>
        )}

        {/* Teacher rows */}
        {!isLoading && recentTeachers.length > 0 && (
          <div>
            {recentTeachers.map((teacher, i) => {
              const isEven = i % 2 === 0;
              return (
                <div
                  key       = {teacher.id}
                  className = {`flex items-center gap-4 px-6 py-4 border-b border-[#F4FBF6] last:border-0 hover:bg-[#E7FBEE] transition-colors ${isEven ? 'bg-white' : 'bg-[#F4FBF6]'}`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#15803D] text-base font-bold">
                      {teacher.username.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0B1F14] text-base font-semibold truncate">
                      {teacher.username}
                    </p>
                    <p className="text-[#6B8479] text-sm truncate">
                      {teacher.email}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-1.5 text-[#6B8479] text-sm flex-shrink-0">
                    <Calendar size={13} />
                    {new Date(teacher.created_at).toLocaleDateString('en-NG', {
                      day  : '2-digit',
                      month: 'short',
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showApprovals && (
  <ManualApprovalModal
    onClose    = {() => setShowApprovals(false)}
    onApproved = {() => void refreshPendingCount()}
  />
)}
      {showReportCards && (
  <ReportCardPanel
    onClose = {() => setShowReportCards(false)}
  />
)}
    </div>
  );
}