// ================================================================
//  CBT SYSTEM — PROMOTE STUDENTS PANEL
//  File    : src/components/admin/PromoteStudentsPanel.tsx
//
//  Per-student promotion: a JSS3 class legitimately splits across
//  multiple SS1 tracks, and some students repeat instead of moving
//  at all. Each row gets its own destination class/department,
//  defaulting to a bulk-selected target that can be overridden
//  per student before submitting — one atomic call either way.
//
//  Inline card (not modal) to match AcademicPeriodPage.tsx's
//  existing card layout, since promotion naturally happens
//  alongside the academic period switch.
//
//  Branch-scoped: Super Admin must pick a branch via the sidebar's
//  Branch Context switcher (useBranchContext) before promoting —
//  same requirement enforceBranchScope applies server-side.
//
//  ASSUMPTION FLAGGED: GET /api/admin/classes and
//  /api/admin/departments response shapes are assumed to be
//  { success, classes } / { success, departments } by analogy
//  with confirmed patterns elsewhere — adjust if the real key differs.
// ================================================================

import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, AlertCircle, Loader2, CheckCircle, Users, RotateCcw, Wand2 } from 'lucide-react';

import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { useBranchContext } from '../../../components/layout/StaffSidebar';

import type {
  ClassLevel,
  Department,
  PromotableStudent,
  ListPromotableStudentsResponse,
  PromoteStudentsResponse,
  PromotionEntry,
} from '../../types/exam';

// Per-student working state for the picker UI. Kept separate from
// PromotionEntry (the wire type) since '' is a valid "not chosen
// yet" UI state that shouldn't leak into the submitted payload.
interface RowDestination {
  toClassId  : number | '';
  toDeptId   : number | '';
}

export default function PromoteStudentsPanel(): React.JSX.Element {
  const { role } = useAuth();
  const activeBranch = useBranchContext();

  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [fromClassId, setFromClassId] = useState<number | ''>('');
  const [fromDeptId, setFromDeptId] = useState<number | ''>('');

  const [students, setStudents] = useState<PromotableStudent[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [destinations, setDestinations] = useState<Record<number, RowDestination>>({});

  const [bulkToClassId, setBulkToClassId] = useState<number | ''>('');
  const [bulkToDeptId, setBulkToDeptId] = useState<number | ''>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<PromoteStudentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const branchId: number | null = role === 'super_admin' ? (activeBranch?.id ?? null) : null;
  // Non-super_admin callers (branch admins) don't have a branch context
  // switcher here — this panel currently assumes Super Admin usage on
  // this page. If branch admins get their own promotion UI later, swap
  // this for staffUser.branch_id the way ReportCardPanel does.

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const [classRes, deptRes] = await Promise.all([
          axiosInstance.get<{ success: boolean; classes: ClassLevel[] }>('/api/admin/classes'),
          axiosInstance.get<{ success: boolean; departments: Department[] }>('/api/admin/departments'),
        ]);
        if (classRes.data.success) setClasses(classRes.data.classes);
        if (deptRes.data.success) setDepartments(deptRes.data.departments);
      } catch {
        setError('Failed to load classes and departments.');
      }
    };
    void load();
  }, []);

  // ── Fetch the class roster whenever source class/dept/branch changes ──
  useEffect((): void => {
    if (fromClassId === '' || branchId === null) {
      setStudents([]);
      setDestinations({});
      return;
    }
    const load = async (): Promise<void> => {
      setIsLoadingStudents(true);
      setResult(null);
      setValidationErrors([]);
      try {
        const res = await axiosInstance.get<ListPromotableStudentsResponse>(
          '/api/admin/students/promotable',
          { params: { class_id: fromClassId, department_id: fromDeptId || undefined, branch_id: branchId } }
        );
        if (res.data.success) {
          setStudents(res.data.students);
          setDestinations({});
        }
      } catch {
        setError('Failed to load students for this class.');
      } finally {
        setIsLoadingStudents(false);
      }
    };
    void load();
  }, [fromClassId, fromDeptId, branchId]);

  const rowIsJssToSs = (student: PromotableStudent, toClassId: number | ''): boolean => {
    if (toClassId === '') return false;
    const toName = classes.find((c) => c.id === toClassId)?.name ?? '';
    return student.class_name.startsWith('JSS') && toName.startsWith('SS');
  };

  const setRowDestination = (studentId: number, patch: Partial<RowDestination>): void => {
    setDestinations((prev) => ({
      ...prev,
      [studentId]: { toClassId: '', toDeptId: '', ...prev[studentId], ...patch },
    }));
  };

  const applyBulkToAll = (): void => {
    if (bulkToClassId === '') return;
    const next: Record<number, RowDestination> = {};
    for (const s of students) {
      next[s.student_id] = { toClassId: bulkToClassId, toDeptId: bulkToDeptId };
    }
    setDestinations(next);
  };

  const markRepeat = (student: PromotableStudent): void => {
    setRowDestination(student.student_id, {
      toClassId: student.class_id,
      toDeptId: student.department_id,
    });
  };

  // Rows that are ready to submit — a destination class has been chosen.
  const readyRows = students.filter((s) => destinations[s.student_id]?.toClassId !== '' && destinations[s.student_id]?.toClassId !== undefined);

  const canSubmit = branchId !== null && readyRows.length > 0 && readyRows.every((s) => {
    const dest = destinations[s.student_id];
    if (!rowIsJssToSs(s, dest.toClassId)) return true;
    return dest.toDeptId !== '' && departments.find((d) => d.id === dest.toDeptId)?.name !== 'General';
  });

  const handlePromote = async (): Promise<void> => {
    if (!canSubmit || branchId === null) return;
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    setValidationErrors([]);
    try {
      const promotions: PromotionEntry[] = readyRows.map((s) => {
        const dest = destinations[s.student_id];
        const entry: PromotionEntry = { student_id: s.student_id, to_class_id: Number(dest.toClassId) };
        if (dest.toDeptId !== '') entry.to_department_id = Number(dest.toDeptId);
        return entry;
      });

      const res = await axiosInstance.post<PromoteStudentsResponse>('/api/admin/students/promote', {
        branch_id: branchId,
        promotions,
      });
      if (res.data.success) {
        setResult(res.data);
        setStudents([]);
        setDestinations({});
        setFromClassId('');
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string; errors?: string[] } } };
        setError(err.response?.data?.message ?? 'Promotion failed.');
        setValidationErrors(err.response?.data?.errors ?? []);
      } else {
        setError('Promotion failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

      {/* Card header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
        <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center flex-shrink-0">
          <ArrowRightLeft size={17} className="text-[#0369A1]" />
        </div>
        <h2 className="text-[#0B1F14] text-base font-bold">Promote Students</h2>
        <span className="ml-auto px-3 py-1 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#6B8479] text-sm font-semibold">
          Per-student destinations
        </span>
      </div>

      <div className="px-6 py-6 space-y-5">

        {error !== null && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-[#991B1B] flex-shrink-0" />
              <p className="text-[#991B1B] text-sm">{error}</p>
            </div>
            {validationErrors.length > 0 && (
              <ul className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3 space-y-1">
                {validationErrors.map((e, i) => (
                  <li key={i} className="text-[#991B1B] text-sm">• {e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {result !== null && (
          <div className="flex items-center gap-3 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-4 py-3">
            <CheckCircle size={16} className="text-[#15803D] flex-shrink-0" />
            <p className="text-[#15803D] text-sm">
              {result.promoted_count} student(s) promoted. Their {result.archived_session} class was archived to history.
            </p>
          </div>
        )}

        {/* Branch context notice — super_admin only */}
        {role === 'super_admin' && branchId === null && (
          <div className="flex items-center gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-[#92400E] flex-shrink-0" />
            <p className="text-[#92400E] text-sm">Select a branch from the sidebar Branch Context switcher first.</p>
          </div>
        )}

        {/* Source class picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-[#3D5347] text-sm font-semibold mb-1.5">From Class</label>
            <select
              value={fromClassId}
              onChange={(e) => setFromClassId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-white border-2 border-[#D7F2E0] rounded-xl px-3 py-2.5 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A]"
            >
              <option value="">Select…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[#3D5347] text-sm font-semibold mb-1.5">
              From Department <span className="text-[#6B8479] font-normal">(optional — all if blank)</span>
            </label>
            <select
              value={fromDeptId}
              onChange={(e) => setFromDeptId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-white border-2 border-[#D7F2E0] rounded-xl px-3 py-2.5 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A]"
            >
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        {isLoadingStudents && (
          <div className="flex items-center gap-2 text-[#6B8479] text-sm">
            <Loader2 size={14} className="animate-spin" /> Loading students…
          </div>
        )}

        {!isLoadingStudents && fromClassId !== '' && students.length === 0 && (
          <p className="text-[#6B8479] text-sm">No active students found for this class.</p>
        )}

        {students.length > 0 && (
          <>
            {/* Bulk default */}
            <div className="bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl px-4 py-4">
              <p className="text-[#3D5347] text-sm font-semibold mb-3">
                Set a default for everyone, then override individual students below
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div>
                  <label className="block text-[#6B8479] text-xs mb-1">Default → Class</label>
                  <select
                    value={bulkToClassId}
                    onChange={(e) => setBulkToClassId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-[#D7F2E0] rounded-lg px-3 py-2 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A]"
                  >
                    <option value="">Select…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[#6B8479] text-xs mb-1">Default → Department</label>
                  <select
                    value={bulkToDeptId}
                    onChange={(e) => setBulkToDeptId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-[#D7F2E0] rounded-lg px-3 py-2 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A]"
                  >
                    <option value="">Keep current</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={applyBulkToAll}
                  disabled={bulkToClassId === ''}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
                >
                  <Wand2 size={13} />
                  Apply to All
                </button>
              </div>
            </div>

            {/* Per-student rows */}
            <div className="border border-[#D7F2E0] rounded-xl overflow-hidden">
              {students.map((s, i) => {
                const dest = destinations[s.student_id] ?? { toClassId: '', toDeptId: '' };
                const needsTrack = rowIsJssToSs(s, dest.toClassId);
                const isRepeat = dest.toClassId === s.class_id;
                return (
                  <div
                    key={s.student_id}
                    className={[
                      'flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[#F4FBF6] last:border-0',
                      i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]',
                    ].join(' ')}
                  >
                    <div className="min-w-[140px] flex-1">
                      <p className="text-[#0B1F14] text-sm font-semibold truncate">{s.full_name}</p>
                      <p className="text-[#6B8479] text-xs">
                        {s.login_pin} · currently {s.class_name} · {s.department_name}
                      </p>
                    </div>

                    <select
                      value={dest.toClassId}
                      onChange={(e) => setRowDestination(s.student_id, {
                        toClassId: e.target.value === '' ? '' : Number(e.target.value),
                      })}
                      className="bg-white border border-[#D7F2E0] rounded-lg px-2 py-1.5 text-xs text-[#0B1F14] focus:outline-none focus:border-[#4AE17A]"
                    >
                      <option value="">→ Class…</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <select
                      value={dest.toDeptId}
                      onChange={(e) => setRowDestination(s.student_id, {
                        toDeptId: e.target.value === '' ? '' : Number(e.target.value),
                      })}
                      className={[
                        'bg-white border rounded-lg px-2 py-1.5 text-xs text-[#0B1F14] focus:outline-none',
                        needsTrack && dest.toDeptId === '' ? 'border-[#FCA5A5]' : 'border-[#D7F2E0] focus:border-[#4AE17A]',
                      ].join(' ')}
                    >
                      <option value="">{needsTrack ? 'Choose track…' : 'Keep dept'}</option>
                      {departments.filter((d) => !needsTrack || d.name !== 'General').map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => markRepeat(s)}
                      className={[
                        'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0',
                        isRepeat
                          ? 'bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E]'
                          : 'bg-white border border-[#D7F2E0] text-[#6B8479] hover:border-[#FCD34D] hover:text-[#92400E]',
                      ].join(' ')}
                      title="Keep this student in their current class (repeat)"
                    >
                      <RotateCcw size={11} />
                      Repeat
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[#6B8479] text-sm">
                {readyRows.length} of {students.length} student(s) have a destination set.
              </p>
              <button
                type="button"
                onClick={() => void handlePromote()}
                disabled={!canSubmit || isSubmitting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                {isSubmitting ? 'Promoting…' : `Promote ${readyRows.length} Student(s)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}