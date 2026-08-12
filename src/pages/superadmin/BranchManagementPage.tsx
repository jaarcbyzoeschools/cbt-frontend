// ================================================================
//  CBT SYSTEM — BRANCH MANAGEMENT PAGE
//  File    : src/pages/superadmin/BranchManagementPage.tsx
//  Design  : Vibrant Institutional Light Mode
// ================================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
}                         from 'react';
import {
  GitBranch,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Building2,
  Users,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
 
}                         from 'lucide-react';

import axiosInstance      from '../../api/axiosInstance';
import type { Branch }    from '../../types/exam';


// ================================================================
//  TYPES
// ================================================================

interface BranchListResponse   { success: boolean; count: number; branches: Branch[] }
interface CreateBranchResponse { success: boolean; message: string; branch: Branch   }
interface Toast                { type: 'success' | 'error'; message: string         }


// ================================================================
//  SHARED HELPERS
// ================================================================

function toNum(v: unknown): number {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') { const p = parseFloat(v); if (isFinite(p)) return p; }
  return 0;
}


// ================================================================
//  TOAST
// ================================================================

function ToastNotification({
  toast,
  onDismiss,
}: {
  toast    : Toast;
  onDismiss: () => void;
}): React.JSX.Element {
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
      <p className="text-base font-medium">{toast.message}</p>
      <button
        type      = "button"
        onClick   = {onDismiss}
        className = "ml-2 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={15} />
      </button>
    </div>
  );
}


// ================================================================
//  CREATE BRANCH MODAL
// ================================================================

function CreateBranchModal({
  onClose,
  onCreated,
}: {
  onClose  : () => void;
  onCreated: (branch: Branch) => void;
}): React.JSX.Element {
  const [name,         setName]         = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error,        setError]        = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect((): void => { inputRef.current?.focus(); }, []);

  useEffect((): (() => void) => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return (): void => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed)            { setError('Branch name is required.');                    return; }
    if (trimmed.length > 100){ setError('Branch name must not exceed 100 characters.'); return; }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await axiosInstance.post<CreateBranchResponse>(
        '/api/superadmin/branches', { name: trimmed }
      );
      if (res.data.success) onCreated(res.data.branch);
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { status?: number; data?: { message?: string } } };
        setError(
          err.response?.status === 409
            ? `A branch named "${trimmed}" already exists.`
            : (err.response?.data?.message ?? 'Failed to create branch. Please try again.')
        );
      } else {
        setError('Failed to create branch. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className  = "fixed inset-0 z-40 bg-[#0B1F14]/50"
        onClick    = {onClose}
        aria-hidden= "true"
      />

      {/* Modal */}
      <div
        className = "fixed inset-0 z-50 flex items-center justify-center p-4"
        role      = "dialog"
        aria-modal= "true"
      >
        <div className="w-full max-w-md bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center">
                <GitBranch size={17} className="text-[#15803D]" />
              </div>
              <h2 className="text-[#0B1F14] text-lg font-bold">
                Create New Branch
              </h2>
            </div>
            <button
              type      = "button"
              onClick   = {onClose}
              className = "p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
            {error !== null && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                <p className="text-[#991B1B] text-base">{error}</p>
              </div>
            )}

            <div>
              <label
                htmlFor   = "branch-name"
                className = "block text-[#3D5347] text-base font-semibold mb-2"
              >
                Branch Name
              </label>
              <input
                ref         = {inputRef}
                id          = "branch-name"
                type        = "text"
                value       = {name}
                onChange    = {(e) => { setName(e.target.value); setError(null); }}
                disabled    = {isSubmitting}
                placeholder = "e.g., Main Campus, North Annex"
                maxLength   = {100}
                className   = {[
                  'w-full bg-white border-2 rounded-xl px-4 py-3.5',
                  'text-[#0B1F14] text-base placeholder:text-[#6B8479]',
                  'focus:outline-none transition-all duration-100',
                  error !== null
                    ? 'border-[#FCA5A5] focus:border-[#991B1B]'
                    : 'border-[#D7F2E0] focus:border-[#4AE17A]',
                ].join(' ')}
              />
              <p className="text-[#6B8479] text-sm mt-1.5">
                {name.trim().length}/100 characters
              </p>
            </div>

            <p className="text-[#6B8479] text-sm leading-relaxed">
              Branch names must be unique. Once created, a branch can be
              assigned to an Administrator account.
            </p>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type      = "button"
                onClick   = {onClose}
                disabled  = {isSubmitting}
                className = "px-5 py-2.5 rounded-xl text-base font-semibold text-[#3D5347] bg-[#F4FBF6] border border-[#D7F2E0] hover:bg-[#E7FBEE] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type      = "submit"
                disabled  = {isSubmitting || name.trim().length === 0}
                className = "flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? <><Loader2 size={16} className="animate-spin" /> Creating…</>
                  : <><Plus size={16} /> Create Branch</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}


// ================================================================
//  MAIN PAGE
// ================================================================

export default function BranchManagementPage(): React.JSX.Element {
  const [branches,  setBranches]  = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [toast,     setToast]     = useState<Toast | null>(null);

  const fetchBranches = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get<BranchListResponse>('/api/superadmin/branches');
      if (res.data.success) setBranches(res.data.branches);
    } catch {
      setError('Failed to load branches. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void fetchBranches(); }, [fetchBranches]);

  const handleBranchCreated = (newBranch: Branch): void => {
    setBranches((prev) => [
      ...prev,
      {
        ...newBranch,
        admin_count  : newBranch.admin_count   ?? 0,
        teacher_count: newBranch.teacher_count ?? 0,
        student_count: newBranch.student_count ?? 0,
      },
    ]);
    setShowModal(false);
    setToast({ type: 'success', message: `Branch "${newBranch.name}" created successfully.` });
  };

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Branch Management
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            Configure physical campus locations. Each branch isolates
            student registration while sharing the central exam pool.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type      = "button"
            onClick   = {() => void fetchBranches()}
            disabled  = {isLoading}
            className = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type      = "button"
            onClick   = {() => setShowModal(true)}
            className = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors"
          >
            <Plus size={16} />
            New Branch
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#991B1B] text-base font-semibold">{error}</p>
            <button
              type      = "button"
              onClick   = {() => void fetchBranches()}
              className = "text-[#991B1B] text-sm underline mt-1 hover:opacity-80"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Branch table card ─────────────────────────────────── */}
      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
          <div className="flex items-center gap-3">
            <Building2 size={18} className="text-[#3D5347]" />
            <h2 className="text-[#0B1F14] text-base font-bold">
              All Campus Branches
            </h2>
            {!isLoading && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                {branches.length}
              </span>
            )}
          </div>
          <button
            type      = "button"
            onClick   = {() => setShowModal(true)}
            className = "flex items-center gap-1.5 text-[#15803D] text-sm font-semibold hover:text-[#22B85C] transition-colors"
          >
            Add Branch
            <Plus size={15} />
          </button>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="divide-y divide-[#F4FBF6]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-[#F4FBF6] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F4FBF6] rounded w-1/3" />
                  <div className="h-3 bg-[#F4FBF6] rounded w-1/5" />
                </div>
                <div className="h-9 w-20 rounded-lg bg-[#F4FBF6]" />
                <div className="h-9 w-20 rounded-lg bg-[#F4FBF6]" />
                <div className="h-9 w-24 rounded-lg bg-[#F4FBF6]" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && branches.length === 0 && error === null && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-5">
              <GitBranch size={28} className="text-[#6B8479]" />
            </div>
            <p className="text-[#0B1F14] text-lg font-bold">No branches configured</p>
            <p className="text-[#6B8479] text-base mt-1.5 max-w-xs leading-relaxed">
              Create your first campus branch to begin organising the
              school's exam infrastructure.
            </p>
            <button
              type      = "button"
              onClick   = {() => setShowModal(true)}
              className = "mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14] text-base font-bold transition-colors"
            >
              <Plus size={17} />
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
                  {['Branch', 'Admins', 'Teachers', 'Students'].map((h, i) => (
                    <th
                      key       = {h}
                      className = {[
                        'py-3.5 text-[#3D5347] font-semibold text-sm uppercase tracking-wider',
                        i === 0 ? 'text-left px-6' : 'text-center px-4',
                      ].join(' ')}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches.map((branch, rowIdx) => {
                  const isEven = rowIdx % 2 === 0;
                  return (
                    <tr
                      key       = {branch.id}
                      className = {`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors ${isEven ? 'bg-white' : 'bg-[#F4FBF6]'}`}
                    >
                      {/* Branch identity */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
                            <Building2 size={18} className="text-[#15803D]" />
                          </div>
                          <div>
                            <p className="text-[#0B1F14] text-base font-semibold">
                              {branch.name}
                            </p>
                            <p className="text-[#6B8479] text-sm">
                              Branch ID: {branch.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Admins */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <ShieldCheck size={15} className="text-[#7C3AED]" />
                          <span className="text-[#0B1F14] text-base font-bold tabular-nums">
                            {toNum(branch.admin_count)}
                          </span>
                        </div>
                      </td>

                      {/* Teachers */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Users size={15} className="text-[#0369A1]" />
                          <span className="text-[#0B1F14] text-base font-bold tabular-nums">
                            {toNum(branch.teacher_count)}
                          </span>
                        </div>
                      </td>

                      {/* Students */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <GraduationCap size={15} className="text-[#92400E]" />
                          <span className="text-[#0B1F14] text-base font-bold tabular-nums">
                            {toNum(branch.student_count).toLocaleString()}
                          </span>
                        </div>
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
                        {branches.reduce((s, b) => s + toNum(b.admin_count), 0)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-[#0369A1] text-base font-bold tabular-nums">
                        {branches.reduce((s, b) => s + toNum(b.teacher_count), 0)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-[#92400E] text-base font-bold tabular-nums">
                        {branches.reduce((s, b) => s + toNum(b.student_count), 0).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <CreateBranchModal
          onClose   = {() => setShowModal(false)}
          onCreated = {handleBranchCreated}
        />
      )}

      {toast !== null && (
        <ToastNotification
          toast     = {toast}
          onDismiss = {() => setToast(null)}
        />
      )}
    </div>
  );
}