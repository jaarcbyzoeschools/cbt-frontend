// ================================================================
//  CBT SYSTEM — CLASS ARMS PAGE
//  File    : src/pages/admin/ClassArmsPage.tsx
//  Design  : Vibrant Institutional Light Mode
//
//  New standalone page — no existing Classes & Departments page
//  was available to extend, so arm management lives here on its
//  own. Reuses useCurriculumConstraint for the same JSS-locks-to-
//  General behavior already used on the Student Enrolment and
//  Exam Management pages, for consistency.
//
//  Arms attach to (class_id, department_id, branch_id) — a school
//  might need "SS1 Science A" and "SS1 Science B" but only one
//  "SS1 Commercial A", since arms scale independently per track.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
}                       from 'react';
import {
  Layers,
  Plus,
  Trash2,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  Users,
}                       from 'lucide-react';

import axiosInstance               from '../../api/axiosInstance';
import { useCurriculumConstraint } from '../../hooks/useCurriculumConstraint';
import { useBranchContext }        from '../../../components/layout/StaffSidebar';
import { useAuth }                 from '../../context/AuthContext';
import type {
  ClassLevel,
  Department,
  ClassArm,
}                                  from '../../types/exam';


interface ClassListResponse  { success: boolean; classes: ClassLevel[] }
interface DeptListResponse   { success: boolean; departments: Department[] }
interface ListArmsResponse   { success: boolean; count: number; arms: ClassArm[] }
interface CreateArmResponse  { success: boolean; message: string; arm: ClassArm }
interface Toast { type: 'success' | 'error'; message: string }


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
      {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      <p className="text-base font-medium flex-1">{toast.message}</p>
      <button type="button" onClick={onDismiss}><X size={15} className="opacity-60 hover:opacity-100" /></button>
    </div>
  );
}


function ConfirmDialog({
  title, message, confirmLabel, isLoading, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string;
  isLoading: boolean; onConfirm: () => void; onCancel: () => void;
}): React.JSX.Element {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0B1F14]/50" onClick={onCancel} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl p-6 space-y-4">
          <h3 className="text-[#0B1F14] text-lg font-bold">{title}</h3>
          <p className="text-[#3D5347] text-base leading-relaxed">{message}</p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-base font-semibold text-[#3D5347] bg-[#F4FBF6] border border-[#D7F2E0] hover:bg-[#E7FBEE] transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={onConfirm} disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors disabled:opacity-50">
              {isLoading && <Loader2 size={15} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


export default function ClassArmsPage(): React.JSX.Element {
  const { role }      = useAuth();
  const activeBranch  = useBranchContext();

  const [classes,     setClasses]     = useState<ClassLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selClassId,  setSelClassId]  = useState<string>('');
  const [selDeptId,   setSelDeptId]   = useState<string>('');

  const [arms,        setArms]        = useState<ClassArm[]>([]);
  const [isLoading,   setIsLoading]   = useState<boolean>(false);
  const [error,       setError]       = useState<string | null>(null);

  const [newArmName,  setNewArmName]  = useState<string>('');
  const [isCreating,  setIsCreating]  = useState<boolean>(false);
  const [deleteTarget,setDeleteTarget]= useState<ClassArm | null>(null);
  const [isDeleting,  setIsDeleting]  = useState<boolean>(false);
  const [toast,       setToast]       = useState<Toast | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const curriculum = useCurriculumConstraint(selClassId, classes, departments);

  useEffect((): void => {
    if (curriculum.effectiveDeptId !== '') setSelDeptId(curriculum.effectiveDeptId);
  }, [curriculum.effectiveDeptId]);

  const isSuperAdmin = role === 'super_admin';
  const branchReady  = !isSuperAdmin || activeBranch !== null;

  // ── Fixed track-letter rule (mirrors the backend) ──────────────
  // Senior classes + a real track (Science/Art/Commercial) no
  // longer get a free-text arm name — the letter is fixed:
  // Science = A, Art = B, Commercial = C. JSS keeps free-form naming.
  const FIXED_TRACK_LETTER: Record<string, string> = { Science: 'A', Art: 'B', Commercial: 'C' };
  const selectedClassName = classes.find((c) => String(c.id) === selClassId)?.name;
  const selectedDeptName  = departments.find((d) => String(d.id) === (curriculum.effectiveDeptId || selDeptId))?.name;
  const isSeniorClass      = selectedClassName !== undefined && /^SS[123]$/.test(selectedClassName);
  const fixedLetter        = selectedDeptName !== undefined ? FIXED_TRACK_LETTER[selectedDeptName] : undefined;
  const isFixedTrackArm    = isSeniorClass && fixedLetter !== undefined;

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const [clsRes, deptRes] = await Promise.all([
          axiosInstance.get<ClassListResponse>('/api/admin/classes'),
          axiosInstance.get<DeptListResponse>('/api/admin/departments'),
        ]);
        if (clsRes.data.success)  setClasses(clsRes.data.classes);
        if (deptRes.data.success) setDepartments(deptRes.data.departments);
      } catch { /* non-fatal */ }
    };
    void load();
  }, []);

  const fetchArms = useCallback(async (): Promise<void> => {
    if (!selClassId || !selDeptId || !branchReady) { setArms([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      qp.set('class_id', selClassId);
      qp.set('department_id', selDeptId);
      if (isSuperAdmin && activeBranch !== null) qp.set('branch_id', String(activeBranch.id));
      const res = await axiosInstance.get<ListArmsResponse>(`/api/admin/arms?${qp.toString()}`);
      if (res.data.success) setArms(res.data.arms);
    } catch {
      setError('Failed to load arms.');
    } finally {
      setIsLoading(false);
    }
  }, [selClassId, selDeptId, isSuperAdmin, activeBranch, branchReady]);

  useEffect((): void => { void fetchArms(); }, [fetchArms]);

  const handleCreateArm = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!selClassId || !selDeptId) return;
    if (!isFixedTrackArm && !newArmName.trim()) return;
    if (isSuperAdmin && activeBranch === null) {
      setToast({ type: 'error', message: 'Select a branch from the Branch Context switcher first.' });
      return;
    }
    setIsCreating(true);
    try {
      const res = await axiosInstance.post<CreateArmResponse>('/api/admin/arms', {
        class_id: Number(selClassId),
        department_id: Number(selDeptId),
        ...(!isFixedTrackArm && { name: newArmName.trim() }),
        ...(isSuperAdmin && activeBranch !== null && { branch_id: activeBranch.id }),
      });
      if (res.data.success) {
        setArms((prev) => [...prev, res.data.arm].sort((a, b) => a.name.localeCompare(b.name)));
        setNewArmName('');
        setToast({ type: 'success', message: `Arm "${res.data.arm.name}" created.` });
        nameInputRef.current?.focus();
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setToast({ type: 'error', message: err.response?.data?.message ?? 'Failed to create arm.' });
      } else {
        setToast({ type: 'error', message: 'Failed to create arm.' });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (deleteTarget === null) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/api/admin/arms/${deleteTarget.id}`);
      setArms((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setToast({ type: 'success', message: `Arm "${deleteTarget.name}" deleted.` });
      setDeleteTarget(null);
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setToast({ type: 'error', message: err.response?.data?.message ?? 'Failed to delete arm.' });
      } else {
        setToast({ type: 'error', message: 'Failed to delete arm.' });
      }
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">Class Arms</h1>
        <p className="text-[#6B8479] text-base mt-1">
          Manage arms (e.g. "A", "B") within each class and track. Every arm shares
          identical subjects and exams — arms are purely for grouping students.
        </p>
      </div>

      {isSuperAdmin && activeBranch === null && (
        <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-5 py-4">
          <AlertCircle size={17} className="text-[#92400E] flex-shrink-0 mt-0.5" />
          <p className="text-[#92400E] text-base">
            Select a branch from the Branch Context switcher in the sidebar — arms are branch-specific.
          </p>
        </div>
      )}

      <div className="bg-white border border-[#D7F2E0] rounded-2xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-[#3D5347] text-base font-semibold mb-2">Class Level</label>
            <div className="relative">
              <select
                value={selClassId}
                onChange={(e) => setSelClassId(e.target.value)}
                className="w-full appearance-none bg-white border-2 border-[#D7F2E0] rounded-xl px-4 py-3.5 text-base text-[#0B1F14] focus:outline-none focus:border-[#4AE17A] transition-all cursor-pointer pr-12"
              >
                <option value="">Select class…</option>
                {classes.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-[#3D5347] text-base font-semibold mb-2">Department Track</label>
            <div className="relative">
              <select
                value={curriculum.effectiveDeptId || selDeptId}
                onChange={(e) => { curriculum.setDeptId(e.target.value); setSelDeptId(e.target.value); }}
                disabled={curriculum.isDepartmentLocked}
                className={[
                  'w-full appearance-none bg-white border-2 rounded-xl px-4 py-3.5 text-base',
                  'focus:outline-none transition-all cursor-pointer pr-12 disabled:cursor-not-allowed',
                  curriculum.isDepartmentLocked ? 'border-[#FCD34D] bg-[#FFFBEB] opacity-80' : 'border-[#D7F2E0] focus:border-[#4AE17A]',
                ].join(' ')}
              >
                <option value="">{curriculum.isDepartmentLocked ? 'General (auto-assigned)' : 'Select track…'}</option>
                {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
            </div>
            {curriculum.lockReason !== null && (
              <p className="text-[#92400E] text-sm mt-2">{curriculum.lockReason}</p>
            )}
          </div>
        </div>
      </div>

      {selClassId && (curriculum.effectiveDeptId || selDeptId) && (
        <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
            <Layers size={18} className="text-[#3D5347]" />
            <h2 className="text-[#0B1F14] text-base font-bold">Arms</h2>
            {!isLoading && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                {arms.length}
              </span>
            )}
            <button
              type="button" onClick={() => void fetchArms()} disabled={isLoading}
              className="ml-auto p-2 rounded-lg text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {isFixedTrackArm ? (
            arms.some((a) => a.name === fixedLetter) ? (
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
                <CheckCircle size={16} className="text-[#15803D] flex-shrink-0" />
                <p className="text-[#3D5347] text-base">
                  {selectedClassName} {selectedDeptName} already has its arm — "{fixedLetter}".
                  Each senior track only ever has one, so there's nothing more to add here.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCreateArm} className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
                <p className="text-[#3D5347] text-base">
                  {selectedClassName} {selectedDeptName} arms are fixed — this will create{' '}
                  <span className="font-bold text-[#0B1F14]">"{fixedLetter}"</span>.
                </p>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Create "{fixedLetter}"
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleCreateArm} className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
              <input
                ref={nameInputRef}
                type="text"
                value={newArmName}
                onChange={(e) => setNewArmName(e.target.value)}
                placeholder="New arm name, e.g. A"
                disabled={isCreating}
                className="flex-1 bg-white border-2 border-[#D7F2E0] rounded-xl px-4 py-2.5 text-base text-[#0B1F14] placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A] transition-all"
              />
              <button
                type="submit"
                disabled={isCreating || !newArmName.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Add Arm
              </button>
            </form>
          )}

          {error !== null && (
            <div className="flex items-center gap-3 px-6 py-3 bg-[#FEF2F2] border-b border-[#FCA5A5]">
              <AlertCircle size={16} className="text-[#991B1B]" />
              <p className="text-[#991B1B] text-base">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="divide-y divide-[#F4FBF6]">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="px-6 py-4 h-14 bg-[#F4FBF6] animate-pulse" />
              ))}
            </div>
          ) : arms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <Layers size={28} className="text-[#6B8479] mb-3" />
              <p className="text-[#0B1F14] text-base font-bold">No arms yet</p>
              <p className="text-[#6B8479] text-sm mt-1">Add your first arm above.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F4FBF6]">
              {arms.map((arm, i) => (
                <div
                  key={arm.id}
                  className={`flex items-center gap-4 px-6 py-4 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]'}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#15803D] text-base font-bold">{arm.name}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0B1F14] text-base font-semibold">
                      {arm.class_name} · {arm.department_name} · Arm {arm.name}
                    </p>
                    <p className="text-[#6B8479] text-sm flex items-center gap-1.5 mt-0.5">
                      <Users size={12} />
                      {arm.student_count} student{arm.student_count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(arm)}
                    title="Delete arm"
                    className="p-2 rounded-lg text-[#6B8479] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors flex-shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {deleteTarget !== null && (
        <ConfirmDialog
          title={`Delete arm "${deleteTarget.name}"?`}
          message={
            deleteTarget.student_count > 0
              ? `This arm has ${deleteTarget.student_count} student(s) still assigned — deletion will be blocked until they're reassigned.`
              : 'This cannot be undone.'
          }
          confirmLabel="Delete Arm"
          isLoading={isDeleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast !== null && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}