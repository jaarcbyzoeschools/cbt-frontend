// ================================================================
//  CBT SYSTEM — INSTITUTION OVERVIEW PAGE
//  File    : src/pages/superadmin/InstitutionOverviewPage.tsx
//  Design  : Vibrant Institutional Light Mode
//  Logic   : Unchanged — only UI tokens replaced
//
//  Addition: Export button on the Student Registry tab (Tab 2).
//  Downloads a .xlsx of every student matching the CURRENT filters
//  (not just the current page) via GET
//  /api/superadmin/overview/students/export — mirrors the blob-
//  download pattern already used in ReportCardPanel.tsx.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useState,
}                          from 'react';
import { useNavigate }     from 'react-router-dom';
import {
  Users,
  GraduationCap,
  BookOpen,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  UserX,
  UserCheck,
  Eye,
  Trophy,
  TrendingUp,
  TrendingDown,
  Loader2,
  X,
  CheckCircle,
  Zap,
  FileQuestion,
  Download,

}                          from 'lucide-react';

import axiosInstance           from '../../api/axiosInstance';
import { useBranchContext }    from '../../../components/layout/StaffSidebar';
import type {
  ClassLevel,
  Department,
  Branch,
  PaginationMeta,
}                              from '../../types/exam';

function toNum(value: unknown): number {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const p = parseFloat(value);
    if (isFinite(p)) return p;
  }
  return 0;
}

// ================================================================
//  TYPES (unchanged)
// ================================================================

type TabId = 'staff' | 'students' | 'questions' | 'results';

interface StaffRecord {
  id: number; username: string; email: string;
  role: 'admin' | 'teacher'; branch_id: number; branch_name: string;
  created_by_username: string | null; created_at: string; is_active: boolean;
}
interface StudentRecord {
  id: number; full_name: string; login_pin: string;
  class_name: string; department_name: string;
  branch_name: string; branch_id: number;
  is_active: boolean; created_at: string; result_count: number;
}
interface ExamAuditRecord {
  exam_id: number; exam_title: string; created_at: string;
  is_active: boolean; subject_name: string; class_name: string;
  department_name: string; question_count: number;
  total_questions_to_show: number; uploaded_by_id: number | null;
  uploaded_by_name: string | null; uploaded_by_role: string | null;
  branch_id: number; branch_name: string;
}
interface UploaderOption { id: number; username: string; role: string }
interface ResultsKpis {
  total_submissions: number | string; average_score: number | string;
  pass_rate: number | string; distinction_rate: number | string;
}
interface BranchPerformance {
  branch_id: number; branch_name: string;
  total_submissions: number | string; average_score: number | string;
  pass_rate: number | string; distinction_rate: number | string;
}
interface ClassPerformance {
  class_id: number; class_name: string;
  total_submissions: number | string; average_score: number | string;
  pass_rate: number | string;
}
interface TopStudent {
  student_id: number; full_name: string; branch_name: string;
  class_name: string; department_name: string;
  exam_count: number | string; average_score: number | string;
}
interface StaffResponse    { success: boolean; pagination: PaginationMeta; staff: StaffRecord[] }
interface StudentsResponse { success: boolean; pagination: PaginationMeta; students: StudentRecord[] }
interface ExamAuditResponse { success: boolean; pagination: PaginationMeta; exams: ExamAuditRecord[] }
interface ResultsResponse  {
  success: boolean; kpis: ResultsKpis;
  by_branch: BranchPerformance[]; by_class: ClassPerformance[]; top_students: TopStudent[];
}
interface Toast            { type: 'success' | 'error'; message: string }
interface Subject          { subject_id: number; subject_name: string }
interface SubjectListResponse { success: boolean; subjects: Subject[] }
interface ClassListResponse   { success: boolean; classes: ClassLevel[] }
interface DeptListResponse    { success: boolean; departments: Department[] }
interface BranchListResponse  { success: boolean; branches: Branch[] }

const PAGE_SIZE = 25;


// ================================================================
//  SHARED SMALL COMPONENTS
// ================================================================

function ToastNotification({
  toast, onDismiss,
}: { toast: Toast; onDismiss: () => void }): React.JSX.Element {
  useEffect((): (() => void) => {
    const t = setTimeout(onDismiss, 4000);
    return (): void => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={[
      'fixed bottom-6 right-6 z-50 flex items-center gap-3',
      'px-5 py-3.5 rounded-xl border shadow-lg max-w-sm',
      toast.type === 'success'
        ? 'bg-[#E7FBEE] border-[#86EFAC] text-[#15803D]'
        : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]',
    ].join(' ')}>
      {toast.type === 'success'
        ? <CheckCircle size={18} className="flex-shrink-0" />
        : <AlertCircle size={18} className="flex-shrink-0" />
      }
      <p className="text-base font-medium flex-1">{toast.message}</p>
      <button type="button" onClick={onDismiss}>
        <X size={15} className="opacity-60 hover:opacity-100" />
      </button>
    </div>
  );
}

function ConfirmDialog({
  title, message, confirmLabel, danger, isLoading, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string;
  danger?: boolean; isLoading: boolean; onConfirm: () => void; onCancel: () => void;
}): React.JSX.Element {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0B1F14]/50" onClick={onCancel} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl p-6 space-y-4">
          <h3 className="text-[#0B1F14] text-lg font-bold">{title}</h3>
          <p className="text-[#3D5347] text-base leading-relaxed">{message}</p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button" onClick={onCancel} disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-base font-semibold text-[#3D5347] bg-[#F4FBF6] border border-[#D7F2E0] hover:bg-[#E7FBEE] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button" onClick={onConfirm} disabled={isLoading}
              className={[
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold transition-colors disabled:opacity-50',
                (danger ?? false)
                  ? 'bg-[#DC2626] hover:bg-[#B91C1C] text-white'
                  : 'bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14]',
              ].join(' ')}
            >
              {isLoading && <Loader2 size={15} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function StatusBadge({ active }: { active: boolean }): React.JSX.Element {
  return (
    <span className={[
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border',
      active
        ? 'bg-[#E7FBEE] text-[#15803D] border-[#86EFAC]'
        : 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
    ].join(' ')}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#22B85C]' : 'bg-[#DC2626]'}`} />
      {active ? 'Active' : 'Suspended'}
    </span>
  );
}

function RoleBadge({ role }: { role: string }): React.JSX.Element {
  return (
    <span className={[
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold border',
      role === 'admin'
        ? 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]'
        : role === 'teacher'
        ? 'bg-[#E7FBEE] text-[#15803D] border-[#86EFAC]'
        : 'bg-[#F4FBF6] text-[#6B8479] border-[#D7F2E0]',
    ].join(' ')}>
      {role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : role}
    </span>
  );
}

function Pagination({
  meta, onPageChange,
}: { meta: PaginationMeta; onPageChange: (p: number) => void }): React.JSX.Element {
  const { current_page, total_pages, total_records, per_page } = meta;
  const start = (current_page - 1) * per_page + 1;
  const end   = Math.min(current_page * per_page, total_records);
  return (
    <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#D7F2E0] bg-[#F4FBF6]">
      <p className="text-[#6B8479] text-sm">
        Showing <span className="text-[#0B1F14] font-semibold">{start}–{end}</span> of{' '}
        <span className="text-[#0B1F14] font-semibold">{total_records.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button" onClick={() => onPageChange(current_page - 1)} disabled={current_page <= 1}
          className="p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[#3D5347] text-sm font-medium px-2">
          {current_page} / {total_pages}
        </span>
        <button
          type="button" onClick={() => onPageChange(current_page + 1)} disabled={current_page >= total_pages}
          className="p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

const selCls = [
  'appearance-none bg-white border border-[#D7F2E0] rounded-xl',
  'pl-3 pr-8 py-2.5 text-sm font-medium text-[#3D5347]',
  'focus:outline-none focus:border-[#4AE17A] cursor-pointer transition-all',
].join(' ');

function FilterSelect({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selCls}>
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
    </div>
  );
}

function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }): React.JSX.Element {
  return (
    <div className="divide-y divide-[#F4FBF6]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-[#F4FBF6] flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-[#F4FBF6] rounded w-1/3" />
            <div className="h-3 bg-[#F4FBF6] rounded w-1/4" />
          </div>
          {Array.from({ length: cols - 2 }).map((_, j) => (
            <div key={j} className="h-7 w-20 bg-[#F4FBF6] rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

function ScoreBar({ value }: { value: number | string }): React.JSX.Element {
  const num    = toNum(value);
  const colour =
    num >= 70 ? 'bg-[#0369A1]'  :
    num >= 50 ? 'bg-[#15803D]'  :
    num >= 40 ? 'bg-[#92400E]'  :
                'bg-[#991B1B]';
  const trackColour =
    num >= 70 ? 'bg-[#BAE6FD]' :
    num >= 50 ? 'bg-[#86EFAC]' :
    num >= 40 ? 'bg-[#FCD34D]' :
                'bg-[#FCA5A5]';
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 rounded-full h-2 min-w-[60px] ${trackColour}`}>
        <div className={`${colour} h-2 rounded-full`} style={{ width: `${Math.min(100, num)}%` }} />
      </div>
      <span className="text-[#3D5347] text-sm font-bold tabular-nums w-12 text-right">
        {num.toFixed(1)}%
      </span>
    </div>
  );
}




// ================================================================
//  TAB 1 — STAFF DIRECTORY
// ================================================================

function StaffTab({ activeBranchId }: { activeBranchId: number | null }): React.JSX.Element {
  const [staff,       setStaff]       = useState<StaffRecord[]>([]);
  const [pagination,  setPagination]  = useState<PaginationMeta | null>(null);
  const [isLoading,   setIsLoading]   = useState<boolean>(true);
  const [error,       setError]       = useState<string | null>(null);
  const [branches,    setBranches]    = useState<Branch[]>([]);
  const [toast,       setToast]       = useState<Toast | null>(null);
  const [confirm,     setConfirm]     = useState<{ record: StaffRecord; action: 'suspend' | 'reactivate' } | null>(null);
  const [isActioning, setIsActioning] = useState<boolean>(false);
  const [filterBranch, setFilterBranch] = useState<string>(activeBranchId !== null ? String(activeBranchId) : '');
  const [filterRole,   setFilterRole]   = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search,       setSearch]       = useState<string>('');
  const [page,         setPage]         = useState<number>(1);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<BranchListResponse>('/api/superadmin/branches');
        if (res.data.success) setBranches(res.data.branches);
      } catch { /* non-fatal */ }
    };
    void load();
  }, []);

  useEffect((): void => {
    setFilterBranch(activeBranchId !== null ? String(activeBranchId) : '');
    setPage(1);
  }, [activeBranchId]);

  const fetchStaff = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (filterBranch)  qp.set('branch_id', filterBranch);
      if (filterRole)    qp.set('role',      filterRole);
      if (filterStatus)  qp.set('status',    filterStatus);
      if (search.trim()) qp.set('search',    search.trim());
      qp.set('page', String(page));
      qp.set('limit', String(PAGE_SIZE));
      const res = await axiosInstance.get<StaffResponse>(`/api/superadmin/overview/staff?${qp.toString()}`);
      if (res.data.success) { setStaff(res.data.staff); setPagination(res.data.pagination); }
    } catch {
      setError('Failed to load staff directory.');
    } finally {
      setIsLoading(false);
    }
  }, [filterBranch, filterRole, filterStatus, search, page]);

  useEffect((): void => { void fetchStaff(); }, [fetchStaff]);

  const handleAction = async (): Promise<void> => {
    if (confirm === null) return;
    setIsActioning(true);
    const { record, action } = confirm;
    try {
      await axiosInstance.put(`/api/superadmin/admins/${record.id}/status`, { action });
      setStaff((prev) => prev.map((s) => s.id === record.id ? { ...s, is_active: action === 'reactivate' } : s));
      setToast({ type: 'success', message: `${record.username} has been ${action === 'suspend' ? 'suspended' : 'reactivated'}.` });
    } catch {
      setToast({ type: 'error', message: 'Action failed. Please try again.' });
    } finally {
      setIsActioning(false);
      setConfirm(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
          <input
            type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or email…"
            className="w-full bg-white border border-[#D7F2E0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0B1F14] placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A] transition-all"
          />
        </div>
        <FilterSelect value={filterBranch} onChange={(v) => { setFilterBranch(v); setPage(1); }}>
          <option value="">All Branches</option>
          {branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </FilterSelect>
        <FilterSelect value={filterRole} onChange={(v) => { setFilterRole(v); setPage(1); }}>
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="teacher">Teacher</option>
        </FilterSelect>
        <FilterSelect value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </FilterSelect>
        <button
          type="button" onClick={() => void fetchStaff()} disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
        {error !== null && (
          <div className="flex items-center gap-3 px-6 py-3 bg-[#FEF2F2] border-b border-[#FCA5A5]">
            <AlertCircle size={16} className="text-[#991B1B]" />
            <p className="text-[#991B1B] text-base">{error}</p>
          </div>
        )}
        {isLoading ? <TableSkeleton rows={6} cols={6} /> : (
          <>
            {staff.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-4">
                  <Users size={28} className="text-[#6B8479]" />
                </div>
                <p className="text-[#0B1F14] text-base font-bold">No staff members found</p>
                <p className="text-[#6B8479] text-sm mt-1">Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#D7F2E0] bg-[#F4FBF6]">
                      {['Staff Member', 'Role', 'Branch', 'Added By', 'Joined', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-6 py-3.5 text-[#3D5347] font-semibold text-sm uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s, i) => (
                      <tr key={s.id} className={`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={[
                              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold border',
                              s.role === 'admin'
                                ? 'bg-[#F5F3FF] border-[#DDD6FE] text-[#7C3AED]'
                                : 'bg-[#E7FBEE] border-[#86EFAC] text-[#15803D]',
                            ].join(' ')}>
                              {s.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[#0B1F14] text-base font-semibold truncate">{s.username}</p>
                              <p className="text-[#6B8479] text-sm truncate">{s.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><RoleBadge role={s.role} /></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 size={13} className="text-[#15803D] flex-shrink-0" />
                            <span className="text-[#3D5347] text-sm">{s.branch_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4"><span className="text-[#6B8479] text-sm">{s.created_by_username ?? '—'}</span></td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-[#6B8479] text-sm">
                            {new Date(s.created_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-6 py-4"><StatusBadge active={s.is_active} /></td>
                        <td className="px-6 py-4">
                          {s.is_active ? (
                            <button type="button" title="Suspend" onClick={() => setConfirm({ record: s, action: 'suspend' })} className="p-2 rounded-lg text-[#6B8479] hover:text-[#92400E] hover:bg-[#FFFBEB] transition-colors">
                              <UserX size={16} />
                            </button>
                          ) : (
                            <button type="button" title="Reactivate" onClick={() => setConfirm({ record: s, action: 'reactivate' })} className="p-2 rounded-lg text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE] transition-colors">
                              <UserCheck size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pagination !== null && staff.length > 0 && <Pagination meta={pagination} onPageChange={setPage} />}
          </>
        )}
      </div>
      {confirm !== null && (
        <ConfirmDialog
          title={`${confirm.action === 'suspend' ? 'Suspend' : 'Reactivate'} "${confirm.record.username}"?`}
          message={confirm.action === 'suspend' ? 'This staff member will immediately lose the ability to log in.' : 'This staff member will regain access to their dashboard.'}
          confirmLabel={confirm.action === 'suspend' ? 'Suspend Access' : 'Reactivate'}
          danger={confirm.action === 'suspend'}
          isLoading={isActioning}
          onConfirm={() => void handleAction()}
          onCancel={() => setConfirm(null)}
        />
      )}
      {toast !== null && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}


// ================================================================
//  TAB 2 — STUDENT REGISTRY
// ================================================================

function StudentsTab({ activeBranchId }: { activeBranchId: number | null }): React.JSX.Element {
  const navigate = useNavigate();
  const [students,    setStudents]    = useState<StudentRecord[]>([]);
  const [pagination,  setPagination]  = useState<PaginationMeta | null>(null);
  const [isLoading,   setIsLoading]   = useState<boolean>(true);
  const [error,       setError]       = useState<string | null>(null);
  const [branches,    setBranches]    = useState<Branch[]>([]);
  const [classes,     setClasses]     = useState<ClassLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [toast,       setToast]       = useState<Toast | null>(null);
  const [confirm,     setConfirm]     = useState<{ record: StudentRecord; action: 'suspend' | 'reactivate' } | null>(null);
  const [isActioning, setIsActioning] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [filterBranch, setFilterBranch] = useState<string>(activeBranchId !== null ? String(activeBranchId) : '');
  const [filterClass,  setFilterClass]  = useState<string>('');
  const [filterDept,   setFilterDept]   = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search,       setSearch]       = useState<string>('');
  const [page,         setPage]         = useState<number>(1);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const [bRes, cRes, dRes] = await Promise.all([
          axiosInstance.get<BranchListResponse>('/api/superadmin/branches'),
          axiosInstance.get<ClassListResponse>('/api/shared/classes'),
          axiosInstance.get<DeptListResponse>('/api/shared/departments'),
        ]);
        if (bRes.data.success) setBranches(bRes.data.branches);
        if (cRes.data.success) setClasses(cRes.data.classes);
        if (dRes.data.success) setDepartments(dRes.data.departments);
      } catch { /* non-fatal */ }
    };
    void load();
  }, []);

  useEffect((): void => {
    setFilterBranch(activeBranchId !== null ? String(activeBranchId) : '');
    setPage(1);
  }, [activeBranchId]);

  const fetchStudents = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (filterBranch)  qp.set('branch_id',     filterBranch);
      if (filterClass)   qp.set('class_id',      filterClass);
      if (filterDept)    qp.set('department_id', filterDept);
      if (filterStatus)  qp.set('status',        filterStatus);
      if (search.trim()) qp.set('search',        search.trim());
      qp.set('page', String(page));
      qp.set('limit', String(PAGE_SIZE));
      const res = await axiosInstance.get<StudentsResponse>(`/api/superadmin/overview/students?${qp.toString()}`);
      if (res.data.success) { setStudents(res.data.students); setPagination(res.data.pagination); }
    } catch {
      setError('Failed to load student registry.');
    } finally {
      setIsLoading(false);
    }
  }, [filterBranch, filterClass, filterDept, filterStatus, search, page]);

  useEffect((): void => { void fetchStudents(); }, [fetchStudents]);

  // ── Export — same filters as the current view, no pagination ──
  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const qp = new URLSearchParams();
      if (filterBranch)  qp.set('branch_id',     filterBranch);
      if (filterClass)   qp.set('class_id',      filterClass);
      if (filterDept)    qp.set('department_id', filterDept);
      if (filterStatus)  qp.set('status',        filterStatus);
      if (search.trim()) qp.set('search',        search.trim());

      const res = await axiosInstance.get(
        `/api/superadmin/overview/students/export?${qp.toString()}`,
        { responseType: 'blob' }
      );
      const blobUrl = window.URL.createObjectURL(
        new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      );
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Student_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setToast({ type: 'error', message: 'Export failed. Adjust filters or try again.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleAction = async (): Promise<void> => {
    if (confirm === null) return;
    setIsActioning(true);
    const { record, action } = confirm;
    try {
      await axiosInstance.put(`/api/teacher/students/${record.id}/status`, { action });
      setStudents((prev) => prev.map((s) => s.id === record.id ? { ...s, is_active: action === 'reactivate' } : s));
      setToast({ type: 'success', message: `${record.full_name} has been ${action === 'suspend' ? 'suspended' : 'reactivated'}.` });
    } catch {
      setToast({ type: 'error', message: 'Action failed. Please try again.' });
    } finally {
      setIsActioning(false);
      setConfirm(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
          <input
            type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or PIN…"
            className="w-full bg-white border border-[#D7F2E0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0B1F14] placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A] transition-all"
          />
        </div>
        <FilterSelect value={filterBranch} onChange={(v) => { setFilterBranch(v); setPage(1); }}>
          <option value="">All Branches</option>
          {branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </FilterSelect>
        <FilterSelect value={filterClass} onChange={(v) => { setFilterClass(v); setPage(1); }}>
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </FilterSelect>
        <FilterSelect value={filterDept} onChange={(v) => { setFilterDept(v); setPage(1); }}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
        </FilterSelect>
        <FilterSelect value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </FilterSelect>
        <button
          type="button" onClick={() => void fetchStudents()} disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
        <button
          type="button" onClick={() => void handleExport()} disabled={isExporting || isLoading}
          title="Export all matching students to Excel"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-all disabled:opacity-50"
        >
          {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Export
        </button>
      </div>

      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
        {error !== null && (
          <div className="flex items-center gap-3 px-6 py-3 bg-[#FEF2F2] border-b border-[#FCA5A5]">
            <AlertCircle size={16} className="text-[#991B1B]" />
            <p className="text-[#991B1B] text-base">{error}</p>
          </div>
        )}
        {isLoading ? <TableSkeleton rows={6} cols={7} /> : (
          <>
            {students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-4">
                  <GraduationCap size={28} className="text-[#6B8479]" />
                </div>
                <p className="text-[#0B1F14] text-base font-bold">No students found</p>
                <p className="text-[#6B8479] text-sm mt-1">Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#D7F2E0] bg-[#F4FBF6]">
                      {['Student', 'PIN', 'Class', 'Department', 'Branch', 'Exams Done', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-6 py-3.5 text-[#3D5347] font-semibold text-sm uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => (
                      <tr key={s.id} className={`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center flex-shrink-0">
                              <span className="text-[#3D5347] text-base font-bold">{s.full_name.charAt(0).toUpperCase()}</span>
                            </div>
                            <p className="text-[#0B1F14] text-base font-semibold truncate max-w-[120px]">{s.full_name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[#3D5347] text-sm font-mono bg-[#F4FBF6] border border-[#D7F2E0] px-2.5 py-0.5 rounded-lg">{s.login_pin}</span>
                        </td>
                        <td className="px-6 py-4"><span className="text-[#3D5347] text-sm">{s.class_name}</span></td>
                        <td className="px-6 py-4"><span className="text-[#3D5347] text-sm">{s.department_name}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 size={13} className="text-[#15803D] flex-shrink-0" />
                            <span className="text-[#3D5347] text-sm">{s.branch_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-base font-bold tabular-nums ${s.result_count > 0 ? 'text-[#15803D]' : 'text-[#6B8479]'}`}>
                            {s.result_count}
                          </span>
                        </td>
                        <td className="px-6 py-4"><StatusBadge active={s.is_active} /></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            {s.is_active ? (
                              <button type="button" title="Suspend" onClick={() => setConfirm({ record: s, action: 'suspend' })} className="p-2 rounded-lg text-[#6B8479] hover:text-[#92400E] hover:bg-[#FFFBEB] transition-colors">
                                <UserX size={16} />
                              </button>
                            ) : (
                              <button type="button" title="Reactivate" onClick={() => setConfirm({ record: s, action: 'reactivate' })} className="p-2 rounded-lg text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE] transition-colors">
                                <UserCheck size={16} />
                              </button>
                            )}
                            <button
                              type="button" title="View results"
                              onClick={() => navigate(`/dashboard/teacher/results?search=${encodeURIComponent(s.full_name)}`)}
                              className="p-2 rounded-lg text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE] transition-colors"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pagination !== null && students.length > 0 && <Pagination meta={pagination} onPageChange={setPage} />}
          </>
        )}
      </div>
      {confirm !== null && (
        <ConfirmDialog
          title={`${confirm.action === 'suspend' ? 'Suspend' : 'Reactivate'} "${confirm.record.full_name}"?`}
          message={confirm.action === 'suspend' ? 'This student will not be able to log in or take exams. Their results remain intact.' : 'This student will regain access to the exam terminal.'}
          confirmLabel={confirm.action === 'suspend' ? 'Suspend' : 'Reactivate'}
          danger={confirm.action === 'suspend'}
          isLoading={isActioning}
          onConfirm={() => void handleAction()}
          onCancel={() => setConfirm(null)}
        />
      )}
      {toast !== null && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}


// ================================================================
//  TAB 3 — QUESTION BANK AUDIT (one row per exam)
// ================================================================

function QuestionsTab({ activeBranchId }: { activeBranchId: number | null }): React.JSX.Element {
  const [exams,       setExams]       = useState<ExamAuditRecord[]>([]);
  const [pagination,  setPagination]  = useState<PaginationMeta | null>(null);
  const [isLoading,   setIsLoading]   = useState<boolean>(true);
  const [error,       setError]       = useState<string | null>(null);
  const [branches,    setBranches]    = useState<Branch[]>([]);
  const [classes,     setClasses]     = useState<ClassLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects,    setSubjects]    = useState<Subject[]>([]);
  const [uploaders,   setUploaders]   = useState<UploaderOption[]>([]);
  const [filterBranch,   setFilterBranch]   = useState<string>(activeBranchId !== null ? String(activeBranchId) : '');
  const [filterClass,    setFilterClass]    = useState<string>('');
  const [filterDept,     setFilterDept]     = useState<string>('');
  const [filterSubject,  setFilterSubject]  = useState<string>('');
  const [filterUploader, setFilterUploader] = useState<string>('');
  const [page,           setPage]           = useState<number>(1);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const [bRes, cRes, dRes] = await Promise.all([
          axiosInstance.get<BranchListResponse>('/api/superadmin/branches'),
          axiosInstance.get<ClassListResponse>('/api/shared/classes'),
          axiosInstance.get<DeptListResponse>('/api/shared/departments'),
        ]);
        if (bRes.data.success) setBranches(bRes.data.branches);
        if (cRes.data.success) setClasses(cRes.data.classes);
        if (dRes.data.success) setDepartments(dRes.data.departments);
      } catch { /* non-fatal */ }
    };
    void load();
  }, []);

  useEffect((): void => { setFilterBranch(activeBranchId !== null ? String(activeBranchId) : ''); setPage(1); }, [activeBranchId]);

  useEffect((): void => {
    if (!filterClass || !filterDept) { setSubjects([]); setFilterSubject(''); return; }
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<SubjectListResponse>(`/api/shared/subjects?class_id=${filterClass}&department_id=${filterDept}`);
        if (res.data.success) setSubjects(res.data.subjects);
      } catch { setSubjects([]); }
    };
    void load();
  }, [filterClass, filterDept]);

  const fetchExams = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (filterBranch)   qp.set('branch_id',     filterBranch);
      if (filterClass)    qp.set('class_id',      filterClass);
      if (filterDept)     qp.set('department_id', filterDept);
      if (filterSubject)  qp.set('subject_id',    filterSubject);
      if (filterUploader) qp.set('created_by',    filterUploader);
      qp.set('page', String(page));
      qp.set('limit', String(PAGE_SIZE));
      const res = await axiosInstance.get<ExamAuditResponse>(`/api/superadmin/overview/questions?${qp.toString()}`);
      if (res.data.success) {
        setExams(res.data.exams);
        setPagination(res.data.pagination);
        const seen = new Set<number>();
        const opts: UploaderOption[] = [];
        res.data.exams.forEach((e) => {
          if (e.uploaded_by_id !== null && !seen.has(e.uploaded_by_id)) {
            seen.add(e.uploaded_by_id);
            opts.push({ id: e.uploaded_by_id, username: e.uploaded_by_name ?? '', role: e.uploaded_by_role ?? '' });
          }
        });
        setUploaders(opts);
      }
    } catch {
      setError('Failed to load question bank audit.');
    } finally {
      setIsLoading(false);
    }
  }, [filterBranch, filterClass, filterDept, filterSubject, filterUploader, page]);

  useEffect((): void => { void fetchExams(); }, [fetchExams]);

  const countColour = (count: number, target: number): string => {
    if (count === 0)    return 'text-[#991B1B]';
    if (count < target) return 'text-[#92400E]';
    return 'text-[#15803D]';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-[#EFF6FF] border border-[#BAE6FD] rounded-xl px-5 py-4">
        <FileQuestion size={16} className="text-[#0369A1] flex-shrink-0 mt-0.5" />
        <p className="text-[#0369A1] text-base leading-relaxed">
          <strong>Exam Content Audit:</strong> One row per exam. Questions column shows uploaded vs target.
          Red = no questions, Amber = partially loaded, Green = fully loaded.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect value={filterBranch} onChange={(v) => { setFilterBranch(v); setPage(1); }}>
          <option value="">All Branches</option>
          {branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </FilterSelect>
        <FilterSelect value={filterClass} onChange={(v) => { setFilterClass(v); setFilterDept(''); setFilterSubject(''); setPage(1); }}>
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </FilterSelect>
        <FilterSelect value={filterDept} onChange={(v) => { setFilterDept(v); setFilterSubject(''); setPage(1); }}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
        </FilterSelect>
        <FilterSelect value={filterSubject} onChange={(v) => { setFilterSubject(v); setPage(1); }}>
          <option value="">All Subjects</option>
          {subjects.map((s) => <option key={s.subject_id} value={String(s.subject_id)}>{s.subject_name}</option>)}
        </FilterSelect>
        {uploaders.length > 0 && (
          <FilterSelect value={filterUploader} onChange={(v) => { setFilterUploader(v); setPage(1); }}>
            <option value="">All Creators</option>
            {uploaders.map((u) => <option key={u.id} value={String(u.id)}>{u.username} ({u.role})</option>)}
          </FilterSelect>
        )}
        <button
          type="button" onClick={() => void fetchExams()} disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
        {error !== null && (
          <div className="flex items-center gap-3 px-6 py-3 bg-[#FEF2F2] border-b border-[#FCA5A5]">
            <AlertCircle size={16} className="text-[#991B1B]" />
            <p className="text-[#991B1B] text-base">{error}</p>
          </div>
        )}
        {isLoading ? <TableSkeleton rows={6} cols={7} /> : (
          <>
            {exams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-4">
                  <BookOpen size={28} className="text-[#6B8479]" />
                </div>
                <p className="text-[#0B1F14] text-base font-bold">No exams found</p>
                <p className="text-[#6B8479] text-sm mt-1">Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#D7F2E0] bg-[#F4FBF6]">
                      {['Exam Title', 'Subject', 'Class / Dept', 'Questions', 'Created By', 'Branch', 'Created', 'Status'].map((h) => (
                        <th key={h} className="text-left px-6 py-3.5 text-[#3D5347] font-semibold text-sm uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((exam, i) => (
                      <tr key={exam.exam_id} className={`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]'}`}>
                        <td className="px-6 py-4 max-w-[200px]">
                          <p className="text-[#0B1F14] text-base font-semibold truncate" title={exam.exam_title}>{exam.exam_title}</p>
                        </td>
                        <td className="px-6 py-4"><span className="text-[#3D5347] text-sm">{exam.subject_name}</span></td>
                        <td className="px-6 py-4">
                          <p className="text-[#0B1F14] text-sm font-semibold">{exam.class_name}</p>
                          <p className="text-[#6B8479] text-sm">{exam.department_name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-base font-bold tabular-nums ${countColour(exam.question_count, exam.total_questions_to_show)}`}>{exam.question_count}</span>
                            <span className="text-[#6B8479] text-sm">/ {exam.total_questions_to_show}</span>
                          </div>
                          <p className={`text-xs mt-0.5 ${countColour(exam.question_count, exam.total_questions_to_show)}`}>
                            {exam.question_count === 0 ? 'No questions yet' : exam.question_count < exam.total_questions_to_show ? 'Partially loaded' : 'Fully loaded'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {exam.uploaded_by_name !== null ? (
                            <><p className="text-[#0B1F14] text-sm font-semibold">{exam.uploaded_by_name}</p><RoleBadge role={exam.uploaded_by_role ?? ''} /></>
                          ) : <span className="text-[#6B8479] text-sm">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 size={13} className="text-[#15803D] flex-shrink-0" />
                            <span className="text-[#3D5347] text-sm">{exam.branch_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-[#6B8479] text-sm">{new Date(exam.created_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </td>
                        <td className="px-6 py-4">
                          {exam.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-[#E7FBEE] text-[#15803D] border border-[#4AE17A]">
                              <Zap size={12} />Live
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-[#F4FBF6] text-[#6B8479] border border-[#D7F2E0]">
                              Draft
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pagination !== null && exams.length > 0 && <Pagination meta={pagination} onPageChange={setPage} />}
          </>
        )}
      </div>
    </div>
  );
}


// ================================================================
//  TAB 4 — RESULTS OVERVIEW
// ================================================================

function ResultsTab({ activeBranchId }: { activeBranchId: number | null }): React.JSX.Element {
  const [kpis,        setKpis]        = useState<ResultsKpis | null>(null);
  const [byBranch,    setByBranch]    = useState<BranchPerformance[]>([]);
  const [byClass,     setByClass]     = useState<ClassPerformance[]>([]);
  const [topStudents, setTopStudents] = useState<TopStudent[]>([]);
  const [isLoading,   setIsLoading]   = useState<boolean>(true);
  const [error,       setError]       = useState<string | null>(null);
  const [filterSession, setFilterSession] = useState<string>('');
  const [filterTerm,    setFilterTerm]    = useState<string>('');

  const sessionOptions = React.useMemo(() => {
    const year = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => { const s = year - 2 + i; return { value: `${s}/${s + 1}`, label: `${s}/${s + 1}` }; });
  }, []);

  const fetchResults = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (activeBranchId !== null) qp.set('branch_id', String(activeBranchId));
      if (filterSession) qp.set('academic_session', filterSession);
      if (filterTerm)    qp.set('term', filterTerm);
      const res = await axiosInstance.get<ResultsResponse>(`/api/superadmin/overview/results?${qp.toString()}`);
      if (res.data.success) { setKpis(res.data.kpis); setByBranch(res.data.by_branch); setByClass(res.data.by_class); setTopStudents(res.data.top_students); }
    } catch {
      setError('Failed to load results overview.');
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId, filterSession, filterTerm]);

  useEffect((): void => { void fetchResults(); }, [fetchResults]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect value={filterSession} onChange={setFilterSession}>
          <option value="">All Sessions</option>
          {sessionOptions.map((o) => <option key={o.value} value={o.value}>{o.value}</option>)}
        </FilterSelect>
        <FilterSelect value={filterTerm} onChange={setFilterTerm}>
          <option value="">All Terms</option>
          <option value="1">1st Term</option>
          <option value="2">2nd Term</option>
          <option value="3">3rd Term</option>
        </FilterSelect>
        <button
          type="button" onClick={() => void fetchResults()} disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={16} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <p className="text-[#991B1B] text-base">{error}</p>
        </div>
      )}

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#D7F2E0] rounded-2xl p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : kpis !== null && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Submissions', value: toNum(kpis.total_submissions).toLocaleString(), icon: <BarChart3 size={20} />, iconBg: 'bg-[#EFF6FF] border-[#BAE6FD]', iconText: 'text-[#0369A1]', valCls: 'text-[#0369A1]' },
            { label: 'Average Score', value: `${toNum(kpis.average_score).toFixed(1)}%`, icon: <TrendingUp size={20} />, iconBg: toNum(kpis.average_score) >= 50 ? 'bg-[#E7FBEE] border-[#86EFAC]' : 'bg-[#FFFBEB] border-[#FCD34D]', iconText: toNum(kpis.average_score) >= 50 ? 'text-[#15803D]' : 'text-[#92400E]', valCls: toNum(kpis.average_score) >= 50 ? 'text-[#15803D]' : 'text-[#92400E]' },
            { label: 'Pass Rate', value: `${toNum(kpis.pass_rate).toFixed(1)}%`, icon: <CheckCircle size={20} />, iconBg: toNum(kpis.pass_rate) >= 60 ? 'bg-[#E7FBEE] border-[#86EFAC]' : 'bg-[#FFFBEB] border-[#FCD34D]', iconText: toNum(kpis.pass_rate) >= 60 ? 'text-[#15803D]' : 'text-[#92400E]', valCls: toNum(kpis.pass_rate) >= 60 ? 'text-[#15803D]' : 'text-[#92400E]' },
            { label: 'Distinction Rate', value: `${toNum(kpis.distinction_rate).toFixed(1)}%`, icon: <Trophy size={20} />, iconBg: 'bg-[#F5F3FF] border-[#DDD6FE]', iconText: 'text-[#7C3AED]', valCls: 'text-[#7C3AED]' },
          ].map((card) => (
            <div key={card.label} className="bg-white border border-[#D7F2E0] rounded-2xl p-5">
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-4 ${card.iconBg} ${card.iconText}`}>{card.icon}</div>
              <p className={`text-3xl font-bold tabular-nums leading-none ${card.valCls}`}>{card.value}</p>
              <p className="text-[#3D5347] text-sm font-semibold mt-2">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Branch performance */}
          <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
              <Building2 size={17} className="text-[#3D5347]" />
              <h3 className="text-[#0B1F14] text-base font-bold">Performance by Branch</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#0369A1] text-sm font-semibold ml-1">{byBranch.length}</span>
            </div>
            {byBranch.length === 0 ? (
              <div className="py-12 text-center">
                <TrendingDown size={24} className="text-[#6B8479] mx-auto mb-2" />
                <p className="text-[#6B8479] text-base">No results data yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F4FBF6]">
                {byBranch.map((b, i) => (
                  <div key={b.branch_id} className="px-6 py-4 hover:bg-[#F4FBF6] transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[#6B8479] text-sm tabular-nums w-5">{i + 1}.</span>
                        <span className="text-[#0B1F14] text-base font-semibold">{b.branch_name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[#6B8479]">
                        <span>{toNum(b.total_submissions).toLocaleString()} subs</span>
                        <span>Pass: {toNum(b.pass_rate).toFixed(0)}%</span>
                      </div>
                    </div>
                    <ScoreBar value={b.average_score} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Class performance */}
          <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
              <GraduationCap size={17} className="text-[#3D5347]" />
              <h3 className="text-[#0B1F14] text-base font-bold">Performance by Class</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#0369A1] text-sm font-semibold ml-1">{byClass.length}</span>
            </div>
            {byClass.length === 0 ? (
              <div className="py-12 text-center">
                <TrendingDown size={24} className="text-[#6B8479] mx-auto mb-2" />
                <p className="text-[#6B8479] text-base">No results data yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F4FBF6]">
                {byClass.map((c, i) => (
                  <div key={c.class_id} className="px-6 py-4 hover:bg-[#F4FBF6] transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[#6B8479] text-sm tabular-nums w-5">{i + 1}.</span>
                        <span className="text-[#0B1F14] text-base font-semibold">{c.class_name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[#6B8479]">
                        <span>{toNum(c.total_submissions).toLocaleString()} subs</span>
                        <span>Pass: {toNum(c.pass_rate).toFixed(0)}%</span>
                      </div>
                    </div>
                    <ScoreBar value={c.average_score} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top students */}
      {!isLoading && topStudents.length > 0 && (
        <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
            <Trophy size={17} className="text-[#92400E]" />
            <h3 className="text-[#0B1F14] text-base font-bold">Top Performing Students</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E] text-sm font-semibold ml-1">{topStudents.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D7F2E0]">
                  {['Rank', 'Student', 'Class', 'Department', 'Branch', 'Exams', 'Avg Score'].map((h) => (
                    <th key={h} className="text-left px-6 py-3.5 text-[#3D5347] font-semibold text-sm uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topStudents.map((s, i) => {
                  const avg = toNum(s.average_score);
                  const scoreCls = avg >= 70 ? 'text-[#15803D]' : avg >= 50 ? 'text-[#0369A1]' : avg >= 40 ? 'text-[#92400E]' : 'text-[#991B1B]';
                  return (
                    <tr key={s.student_id} className={`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]'}`}>
                      <td className="px-6 py-4">
                        <span className={[
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                          i === 0 ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FCD34D]'  :
                          i === 1 ? 'bg-[#F4FBF6] text-[#3D5347] border border-[#D7F2E0]'  :
                          i === 2 ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]'  :
                                    'bg-[#F4FBF6] text-[#6B8479] border border-[#D7F2E0]',
                        ].join(' ')}>{i + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center flex-shrink-0">
                            <span className="text-[#3D5347] text-sm font-bold">{s.full_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <p className="text-[#0B1F14] text-base font-semibold truncate max-w-[120px]">{s.full_name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="text-[#3D5347] text-sm">{s.class_name}</span></td>
                      <td className="px-6 py-4"><span className="text-[#3D5347] text-sm">{s.department_name}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 size={13} className="text-[#15803D] flex-shrink-0" />
                          <span className="text-[#3D5347] text-sm">{s.branch_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="text-[#3D5347] text-sm tabular-nums">{toNum(s.exam_count)}</span></td>
                      <td className="px-6 py-4"><span className={`text-base font-bold tabular-nums ${scoreCls}`}>{avg.toFixed(1)}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


// ================================================================
//  MAIN PAGE COMPONENT
// ================================================================

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'staff',     label: 'Staff Directory',     icon: <Users         size={16} /> },
  { id: 'students',  label: 'Student Registry',    icon: <GraduationCap size={16} /> },
  { id: 'questions', label: 'Question Bank Audit', icon: <BookOpen      size={16} /> },
  { id: 'results',   label: 'Results Overview',    icon: <BarChart3     size={16} /> },
];

export default function InstitutionOverviewPage(): React.JSX.Element {
  const [activeTab,   setActiveTab]   = useState<TabId>('staff');
  const activeBranch = useBranchContext();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">Institution Overview</h1>
        <p className="text-[#6B8479] text-base mt-1">
          System-wide visibility across all branches, staff, students, exams and results.
        </p>
        {activeBranch !== null && (
          <div className="flex items-center gap-2 mt-3 px-4 py-2.5 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl w-fit">
            <div className="w-2 h-2 rounded-full bg-[#4AE17A]" />
            <p className="text-[#15803D] text-sm font-semibold">
              Scoped to: {activeBranch.name}
              <span className="text-[#6B8479] font-normal ml-2">— Select "All Branches" in the sidebar to view globally</span>
            </p>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-white border border-[#D7F2E0] rounded-2xl p-1.5 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-2 px-5 py-3 rounded-xl text-base font-semibold',
              'transition-all duration-150 flex-1 justify-center',
              activeTab === tab.id
                ? 'bg-[#4AE17A] text-[#0B1F14]'
                : 'text-[#3D5347] hover:text-[#0B1F14] hover:bg-[#F4FBF6]',
            ].join(' ')}
          >
            {tab.icon}
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'staff'     && <StaffTab     activeBranchId={activeBranch?.id ?? null} />}
      {activeTab === 'students'  && <StudentsTab  activeBranchId={activeBranch?.id ?? null} />}
      {activeTab === 'questions' && <QuestionsTab activeBranchId={activeBranch?.id ?? null} />}
      {activeTab === 'results'   && <ResultsTab   activeBranchId={activeBranch?.id ?? null} />}
    </div>
  );
}