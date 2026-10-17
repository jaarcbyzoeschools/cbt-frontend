// ================================================================
//  CBT SYSTEM — TEACHER ACCOUNTS PAGE (ADMIN VIEW)
//  File    : src/pages/admin/TeacherAccountsPage.tsx
//  Design  : Vibrant Institutional Light Mode
//
//  Addition: "Manage Assignments" action per teacher, opening
//  ManageAssignmentsModal — subject-teacher assignments and the
//  single class-teacher (homeroom) assignment, both enforced
//  server-side (class teacher requires >=1 subject assignment
//  first; one classroom per teacher).
// ================================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
}                       from 'react';
import {
  UserCheck,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  UserX,
  Trash2,
  Calendar,
  Mail,
  BookOpen,
  Star,
  Award,
}                       from 'lucide-react';

import axiosInstance        from '../../api/axiosInstance';
import { useAuth }          from '../../context/AuthContext';
import { useBranchContext } from '../../../components/layout/StaffSidebar';
import { useCurriculumConstraint } from '../../hooks/useCurriculumConstraint';
import type {
  ClassLevel,
  Department,
  Subject,
  ClassArm,
  TeacherSubjectAssignment,
  ClassTeacherAssignment,
}                            from '../../types/exam';


// ================================================================
//  TYPES
// ================================================================

interface TeacherRecord {
  id                  : number;
  username            : string;
  email               : string;
  role                : string;
  branch_id           : number;
  branch_name         : string;
  created_by_username : string | null;
  created_at          : string;
  is_active?          : boolean;
}

interface TeacherListResponse  { success: boolean; count: number; teachers: TeacherRecord[] }
interface CreateTeacherResponse { success: boolean; message: string; teacher: TeacherRecord }
interface ToggleTeacherResponse {
  success: boolean; message: string; action: string; teacher_id: number;
}
interface Toast { type: 'success' | 'error'; message: string }
type TeacherAction = 'suspend' | 'reactivate' | 'delete';

interface ClassListResponse   { success: boolean; classes: ClassLevel[] }
interface DeptListResponse    { success: boolean; departments: Department[] }
interface SubjectListResponse { success: boolean; subjects: Subject[] }
interface ArmListResponse     { success: boolean; arms: ClassArm[] }
interface TeacherSubjectsResponse { success: boolean; subjects: TeacherSubjectAssignment[] }
interface ClassTeachersResponse   { success: boolean; assignments: ClassTeacherAssignment[] }


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
      <p className="text-base font-medium flex-1">{toast.message}</p>
      <button type="button" onClick={onDismiss}>
        <X size={15} className="opacity-60 hover:opacity-100" />
      </button>
    </div>
  );
}


// ================================================================
//  CONFIRM DIALOG
// ================================================================

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  isLoading,
  onConfirm,
  onCancel,
}: {
  title        : string;
  message      : string;
  confirmLabel : string;
  danger?      : boolean;
  isLoading    : boolean;
  onConfirm    : () => void;
  onCancel     : () => void;
}): React.JSX.Element {
  return (
    <>
      <div
        className  = "fixed inset-0 z-40 bg-[#0B1F14]/50"
        onClick    = {onCancel}
        aria-hidden= "true"
      />
      <div
        className = "fixed inset-0 z-50 flex items-center justify-center p-4"
        role      = "dialog"
        aria-modal= "true"
      >
        <div className="w-full max-w-sm bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl p-6 space-y-4">
          <h3 className="text-[#0B1F14] text-lg font-bold">{title}</h3>
          <p className="text-[#3D5347] text-base leading-relaxed">{message}</p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type      = "button"
              onClick   = {onCancel}
              disabled  = {isLoading}
              className = "px-5 py-2.5 rounded-xl text-base font-semibold text-[#3D5347] bg-[#F4FBF6] border border-[#D7F2E0] hover:bg-[#E7FBEE] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type      = "button"
              onClick   = {onConfirm}
              disabled  = {isLoading}
              className = {[
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold transition-colors disabled:opacity-50',
                danger
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


// ================================================================
//  CREATE TEACHER MODAL
// ================================================================

function CreateTeacherModal({
  onClose,
  onCreated,
}: {
  onClose  : () => void;
  onCreated: (teacher: TeacherRecord) => void;
}): React.JSX.Element {
  const [username,    setUsername]    = useState<string>('');
  const [email,       setEmail]       = useState<string>('');
  const [password,    setPassword]    = useState<string>('');
  const [showPass,    setShowPass]    = useState<boolean>(false);
  const [isSubmitting,setIsSubmitting]= useState<boolean>(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [apiError,    setApiError]    = useState<string | null>(null);

  const activeBranch = useBranchContext();
  const { role }     = useAuth();
  const firstRef     = useRef<HTMLInputElement>(null);

  useEffect((): void => { firstRef.current?.focus(); }, []);

  useEffect((): (() => void) => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return (): void => document.removeEventListener('keydown', h);
  }, [onClose]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!username.trim())                                e.username = 'Username is required.';
    if (!email.trim())                                   e.email    = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email    = 'Enter a valid email.';
    if (!password)                                       e.password = 'Password is required.';
    else if (password.length < 8)                        e.password = 'Minimum 8 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!validate()) return;

    const isSuperAdmin = role === 'super_admin';
    if (isSuperAdmin && activeBranch === null) {
      setApiError('Please select a branch from the Branch Context switcher before creating a Teacher account.');
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const res = await axiosInstance.post<CreateTeacherResponse>(
        '/api/admin/teachers',
        {
          username : username.trim(),
          email    : email.trim().toLowerCase(),
          password,
          ...(isSuperAdmin && activeBranch !== null && { branch_id: activeBranch.id }),
        }
      );
      if (res.data.success) onCreated(res.data.teacher);
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { status?: number; data?: { message?: string } } };
        setApiError(
          err.response?.status === 409
            ? 'An account with this email already exists.'
            : (err.response?.data?.message ?? 'Failed to create teacher. Please try again.')
        );
      } else {
        setApiError('Failed to create teacher. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldCls = (f: string): string => [
    'w-full bg-white border-2 rounded-xl px-4 py-3.5 text-[#0B1F14] text-base',
    'placeholder:text-[#6B8479] focus:outline-none transition-all duration-100',
    errors[f]
      ? 'border-[#FCA5A5] focus:border-[#991B1B]'
      : 'border-[#D7F2E0] focus:border-[#4AE17A]',
  ].join(' ');

  return (
    <>
      <div
        className  = "fixed inset-0 z-40 bg-[#0B1F14]/50"
        onClick    = {onClose}
        aria-hidden= "true"
      />
      <div
        className = "fixed inset-0 z-50 flex items-center justify-center p-4"
        role      = "dialog"
        aria-modal= "true"
      >
        <div className="w-full max-w-md bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl">

          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center">
                <UserCheck size={17} className="text-[#15803D]" />
              </div>
              <h2 className="text-[#0B1F14] text-lg font-bold">Add Teacher</h2>
            </div>
            <button
              type      = "button"
              onClick   = {onClose}
              className = "p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">

            {apiError !== null && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                <p className="text-[#991B1B] text-base">{apiError}</p>
              </div>
            )}

            <div className="flex items-start gap-3 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-4 py-3">
              <CheckCircle size={16} className="text-[#15803D] flex-shrink-0 mt-0.5" />
              <p className="text-[#15803D] text-sm leading-relaxed">
                This teacher will be automatically assigned to your branch. The branch cannot be overridden.
              </p>
            </div>

            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                Full Name / Username
              </label>
              <input
                ref         = {firstRef}
                type        = "text"
                value       = {username}
                onChange    = {(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: '' })); }}
                disabled    = {isSubmitting}
                placeholder = "e.g., Mr. Adeyemi"
                className   = {fieldCls('username')}
              />
              {errors.username && <p className="text-[#991B1B] text-sm mt-1.5">{errors.username}</p>}
            </div>

            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                Email Address
              </label>
              <input
                type        = "email"
                value       = {email}
                onChange    = {(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
                disabled    = {isSubmitting}
                placeholder = "teacher@school.edu.ng"
                className   = {fieldCls('email')}
              />
              {errors.email && <p className="text-[#991B1B] text-sm mt-1.5">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type        = {showPass ? 'text' : 'password'}
                  value       = {password}
                  onChange    = {(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
                  disabled    = {isSubmitting}
                  placeholder = "Min. 8 characters"
                  className   = {`${fieldCls('password')} pr-12`}
                />
                <button
                  type      = "button"
                  tabIndex  = {-1}
                  onClick   = {() => setShowPass((p) => !p)}
                  className = "absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] hover:text-[#3D5347] transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-[#991B1B] text-sm mt-1.5">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
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
                disabled  = {isSubmitting}
                className = "flex items-center gap-2 px-6 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {isSubmitting ? 'Adding…' : 'Add Teacher'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}


// ================================================================
//  MANAGE ASSIGNMENTS MODAL
//  Subject-teacher assignments + the single class-teacher
//  (homeroom) assignment for one teacher.
// ================================================================

function ManageAssignmentsModal({
  teacher,
  onClose,
  onToast,
}: {
  teacher: TeacherRecord;
  onClose: () => void;
  onToast: (t: Toast) => void;
}): React.JSX.Element {
  const [classes,     setClasses]     = useState<ClassLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [mySubjects,      setMySubjects]      = useState<TeacherSubjectAssignment[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState<boolean>(true);
  const [myClassTeacher,  setMyClassTeacher]  = useState<ClassTeacherAssignment | null>(null);
  const [isLoadingCT,     setIsLoadingCT]     = useState<boolean>(true);

  // Add-subject form
  const [addClassId,   setAddClassId]   = useState<string>('');
  const [addDeptId,     setAddDeptId]   = useState<string>('');
  const [addSubjectId,  setAddSubjectId]= useState<string>('');
  const [subjectOptions, setSubjectOptions] = useState<Subject[]>([]);
  const [isAssigningSubject, setIsAssigningSubject] = useState<boolean>(false);

  // Class-teacher form
  const [ctClassId, setCtClassId] = useState<string>('');
  const [ctDeptId,  setCtDeptId]  = useState<string>('');
  const [ctArmId,   setCtArmId]   = useState<string>('');
  const [armOptions, setArmOptions] = useState<ClassArm[]>([]);
  const [isAssigningCT, setIsAssigningCT] = useState<boolean>(false);
  const [isRemovingCT,  setIsRemovingCT]  = useState<boolean>(false);

  const addCurriculum = useCurriculumConstraint(addClassId, classes, departments);
  const ctCurriculum  = useCurriculumConstraint(ctClassId, classes, departments);

  useEffect((): void => {
    if (addCurriculum.effectiveDeptId !== '') setAddDeptId(addCurriculum.effectiveDeptId);
  }, [addCurriculum.effectiveDeptId]);

  useEffect((): void => {
    if (ctCurriculum.effectiveDeptId !== '') setCtDeptId(ctCurriculum.effectiveDeptId);
  }, [ctCurriculum.effectiveDeptId]);

  // ── Load lookups + current assignments ─────────────────────
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

  const fetchSubjectAssignments = useCallback(async (): Promise<void> => {
    setIsLoadingSubjects(true);
    try {
      const res = await axiosInstance.get<TeacherSubjectsResponse>(`/api/admin/teachers/${teacher.id}/subjects`);
      if (res.data.success) setMySubjects(res.data.subjects);
    } catch { /* non-fatal */ } finally {
      setIsLoadingSubjects(false);
    }
  }, [teacher.id]);

  const fetchClassTeacher = useCallback(async (): Promise<void> => {
    setIsLoadingCT(true);
    try {
      const res = await axiosInstance.get<ClassTeachersResponse>(
        `/api/admin/class-teachers?branch_id=${teacher.branch_id}`
      );
      if (res.data.success) {
        const mine = res.data.assignments.find((a) => a.teacher_id === teacher.id) ?? null;
        setMyClassTeacher(mine);
      }
    } catch { /* non-fatal */ } finally {
      setIsLoadingCT(false);
    }
  }, [teacher.id, teacher.branch_id]);

  useEffect((): void => { void fetchSubjectAssignments(); void fetchClassTeacher(); }, [fetchSubjectAssignments, fetchClassTeacher]);

  // ── Subject dropdown for "add subject" form ─────────────────
  useEffect((): void => {
    const resolvedDept = addCurriculum.isDepartmentLocked ? addCurriculum.effectiveDeptId : addDeptId;
    if (!addClassId || !resolvedDept) { setSubjectOptions([]); return; }
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<SubjectListResponse>(
          `/api/admin/subjects?class_id=${addClassId}&department_id=${resolvedDept}`
        );
        if (res.data.success) setSubjectOptions(res.data.subjects);
      } catch { setSubjectOptions([]); }
    };
    void load();
  }, [addClassId, addDeptId, addCurriculum.isDepartmentLocked, addCurriculum.effectiveDeptId]);

  // ── Arm dropdown for "class teacher" form ───────────────────
  useEffect((): void => {
    const resolvedDept = ctCurriculum.isDepartmentLocked ? ctCurriculum.effectiveDeptId : ctDeptId;
    if (!ctClassId || !resolvedDept) { setArmOptions([]); return; }
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<ArmListResponse>(
          `/api/admin/arms?class_id=${ctClassId}&department_id=${resolvedDept}&branch_id=${teacher.branch_id}`
        );
        if (res.data.success) setArmOptions(res.data.arms);
      } catch { setArmOptions([]); }
    };
    void load();
  }, [ctClassId, ctDeptId, ctCurriculum.isDepartmentLocked, ctCurriculum.effectiveDeptId, teacher.branch_id]);

  // ── Assign subject ───────────────────────────────────────────
  const handleAssignSubject = async (): Promise<void> => {
    if (!addSubjectId) return;
    setIsAssigningSubject(true);
    try {
      await axiosInstance.post(`/api/admin/teachers/${teacher.id}/subjects`, {
        subject_id: Number(addSubjectId),
      });
      onToast({ type: 'success', message: 'Subject assigned.' });
      setAddClassId(''); setAddDeptId(''); setAddSubjectId('');
      void fetchSubjectAssignments();
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        onToast({ type: 'error', message: err.response?.data?.message ?? 'Failed to assign subject.' });
      }
    } finally {
      setIsAssigningSubject(false);
    }
  };

  const handleRemoveSubject = async (subjectId: number): Promise<void> => {
    try {
      await axiosInstance.delete(`/api/admin/teachers/${teacher.id}/subjects/${subjectId}`);
      onToast({ type: 'success', message: 'Subject assignment removed.' });
      void fetchSubjectAssignments();
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        onToast({ type: 'error', message: err.response?.data?.message ?? 'Failed to remove assignment.' });
      }
    }
  };

  // ── Assign / remove class teacher ───────────────────────────
  const handleAssignClassTeacher = async (): Promise<void> => {
    if (!ctClassId || !ctDeptId || !ctArmId) return;
    setIsAssigningCT(true);
    try {
      await axiosInstance.post(`/api/admin/teachers/${teacher.id}/class-teacher`, {
        class_id: Number(ctClassId),
        department_id: Number(ctDeptId),
        arm_id: Number(ctArmId),
      });
      onToast({ type: 'success', message: `${teacher.username} assigned as class teacher.` });
      setCtClassId(''); setCtDeptId(''); setCtArmId('');
      void fetchClassTeacher();
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        onToast({ type: 'error', message: err.response?.data?.message ?? 'Failed to assign class teacher.' });
      }
    } finally {
      setIsAssigningCT(false);
    }
  };

  const handleRemoveClassTeacher = async (): Promise<void> => {
    setIsRemovingCT(true);
    try {
      await axiosInstance.delete(`/api/admin/teachers/${teacher.id}/class-teacher`);
      onToast({ type: 'success', message: `${teacher.username} is no longer a class teacher.` });
      setMyClassTeacher(null);
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        onToast({ type: 'error', message: err.response?.data?.message ?? 'Failed to remove class teacher.' });
      }
    } finally {
      setIsRemovingCT(false);
    }
  };

  const selCls = 'w-full appearance-none bg-white border-2 border-[#D7F2E0] rounded-xl px-3 py-2.5 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A] transition-all cursor-pointer pr-9';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0B1F14]/50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
        <div className="w-full max-w-2xl bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl my-4">

          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div>
              <h2 className="text-[#0B1F14] text-lg font-bold">{teacher.username}</h2>
              <p className="text-[#6B8479] text-sm">Manage subject & class teacher assignments</p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5 max-h-[75vh] overflow-y-auto space-y-6">

            {/* Subject assignments */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={16} className="text-[#15803D]" />
                <h3 className="text-[#0B1F14] text-base font-bold">Subjects Taught</h3>
              </div>

              {isLoadingSubjects ? (
                <div className="flex items-center gap-2 text-[#6B8479] text-sm"><Loader2 size={14} className="animate-spin" /> Loading…</div>
              ) : mySubjects.length === 0 ? (
                <p className="text-[#6B8479] text-sm mb-3">No subjects assigned yet.</p>
              ) : (
                <div className="space-y-1.5 mb-3">
                  {mySubjects.map((s) => (
                    <div key={s.assignment_id} className="flex items-center gap-3 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl px-4 py-2.5">
                      <span className="flex-1 text-[#0B1F14] text-sm font-semibold">
                        {s.subject_name} <span className="text-[#6B8479] font-normal">— {s.class_name} · {s.department_name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleRemoveSubject(s.subject_id)}
                        className="p-1.5 rounded-lg text-[#6B8479] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add subject form */}
              <div className="grid grid-cols-3 gap-2">
                <select value={addClassId} onChange={(e) => { setAddClassId(e.target.value); setAddSubjectId(''); }} className={selCls}>
                  <option value="">Class…</option>
                  {classes.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                </select>
                <select
                  value={addCurriculum.effectiveDeptId || addDeptId}
                  onChange={(e) => { addCurriculum.setDeptId(e.target.value); setAddDeptId(e.target.value); setAddSubjectId(''); }}
                  disabled={addCurriculum.isDepartmentLocked}
                  className={selCls}
                >
                  <option value="">{addCurriculum.isDepartmentLocked ? 'General' : 'Dept…'}</option>
                  {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                </select>
                <select value={addSubjectId} onChange={(e) => setAddSubjectId(e.target.value)} className={selCls} disabled={subjectOptions.length === 0}>
                  <option value="">{subjectOptions.length === 0 ? 'Select class/dept' : 'Subject…'}</option>
                  {subjectOptions.map((s) => <option key={s.subject_id} value={String(s.subject_id)}>{s.subject_name}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void handleAssignSubject()}
                disabled={!addSubjectId || isAssigningSubject}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
              >
                {isAssigningSubject ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Assign Subject
              </button>
            </div>

            {/* Class teacher */}
            <div className="border-t border-[#D7F2E0] pt-5">
              <div className="flex items-center gap-2 mb-3">
                <Award size={16} className="text-[#0369A1]" />
                <h3 className="text-[#0B1F14] text-base font-bold">Class Teacher (Homeroom)</h3>
              </div>

              {isLoadingCT ? (
                <div className="flex items-center gap-2 text-[#6B8479] text-sm"><Loader2 size={14} className="animate-spin" /> Loading…</div>
              ) : myClassTeacher !== null ? (
                <div className="flex items-center justify-between gap-3 bg-[#EFF6FF] border border-[#BAE6FD] rounded-xl px-4 py-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Star size={14} className="text-[#0369A1]" />
                    <p className="text-[#0369A1] text-sm font-semibold">
                      Class teacher of {myClassTeacher.class_name} · {myClassTeacher.department_name} · Arm {myClassTeacher.arm_name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveClassTeacher()}
                    disabled={isRemovingCT}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#991B1B] bg-white border border-[#FCA5A5] hover:bg-[#FEF2F2] transition-colors disabled:opacity-50"
                  >
                    {isRemovingCT ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[#6B8479] text-sm mb-3">Not currently a class teacher.</p>
                  <div className="grid grid-cols-3 gap-2">
                    <select value={ctClassId} onChange={(e) => { setCtClassId(e.target.value); setCtArmId(''); }} className={selCls}>
                      <option value="">Class…</option>
                      {classes.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                    </select>
                    <select
                      value={ctCurriculum.effectiveDeptId || ctDeptId}
                      onChange={(e) => { ctCurriculum.setDeptId(e.target.value); setCtDeptId(e.target.value); setCtArmId(''); }}
                      disabled={ctCurriculum.isDepartmentLocked}
                      className={selCls}
                    >
                      <option value="">{ctCurriculum.isDepartmentLocked ? 'General' : 'Dept…'}</option>
                      {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                    </select>
                    <select value={ctArmId} onChange={(e) => setCtArmId(e.target.value)} className={selCls} disabled={armOptions.length === 0}>
                      <option value="">{armOptions.length === 0 ? 'Select class/dept' : 'Arm…'}</option>
                      {armOptions.map((a) => <option key={a.id} value={String(a.id)}>Arm {a.name}</option>)}
                    </select>
                  </div>
                  {mySubjects.length === 0 && (
                    <p className="text-[#92400E] text-sm mt-2">Assign at least one subject above first.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleAssignClassTeacher()}
                    disabled={!ctArmId || isAssigningCT || mySubjects.length === 0}
                    className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#0369A1] bg-[#EFF6FF] border border-[#BAE6FD] hover:bg-[#DBEAFE] transition-colors disabled:opacity-50"
                  >
                    {isAssigningCT ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                    Assign as Class Teacher
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


// ================================================================
//  STATUS BADGE
// ================================================================

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


// ================================================================
//  MAIN PAGE
// ================================================================

export default function TeacherAccountsPage(): React.JSX.Element {
  const { role }     = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const [teachers,     setTeachers]     = useState<TeacherRecord[]>([]);
  const [isLoading,    setIsLoading]    = useState<boolean>(true);
  const [error,        setError]        = useState<string | null>(null);
  const [searchQuery,  setSearchQuery]  = useState<string>('');
  const [showModal,    setShowModal]    = useState<boolean>(false);
  const [toast,        setToast]        = useState<Toast | null>(null);
  const [actionTarget, setActionTarget] = useState<{
    teacher: TeacherRecord;
    action : TeacherAction;
  } | null>(null);
  const [isActioning,  setIsActioning]  = useState<boolean>(false);
  const [assignmentsTarget, setAssignmentsTarget] = useState<TeacherRecord | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const fetchTeachers = useCallback(async (search?: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await axiosInstance.get<TeacherListResponse>(`/api/admin/teachers${params}`);
      if (res.data.success) setTeachers(res.data.teachers);
    } catch {
      setError('Failed to load teacher accounts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void fetchTeachers(); }, [fetchTeachers]);


  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setSearchQuery(value);
    if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout((): void => {
      void fetchTeachers(value.trim() || undefined);
    }, 350);
  };


  const handleAction = async (): Promise<void> => {
    if (actionTarget === null) return;
    const { teacher, action } = actionTarget;
    setIsActioning(true);
    try {
      const res = await axiosInstance.put<ToggleTeacherResponse>(
        `/api/admin/teachers/${teacher.id}/status`,
        { action }
      );
      if (res.data.success) {
        if (action === 'delete') {
          setTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
          setToast({ type: 'success', message: `Teacher "${teacher.username}" deleted.` });
        } else {
          setTeachers((prev) => prev.map((t) =>
            t.id === teacher.id ? { ...t, is_active: action === 'reactivate' } : t
          ));
          setToast({
            type   : 'success',
            message: `Teacher "${teacher.username}" ${action === 'suspend' ? 'suspended' : 'reactivated'}.`,
          });
        }
        setActionTarget(null);
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setToast({ type: 'error', message: err.response?.data?.message ?? 'Action failed.' });
      } else {
        setToast({ type: 'error', message: 'Action failed. Please try again.' });
      }
      setActionTarget(null);
    } finally {
      setIsActioning(false);
    }
  };


  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">Teacher Accounts</h1>
          <p className="text-[#6B8479] text-base mt-1">
            {isSuperAdmin
              ? 'All teacher accounts across all branches.'
              : 'Teaching staff registered in your branch.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type      = "button"
            onClick   = {() => void fetchTeachers(searchQuery.trim() || undefined)}
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
            Add Teacher
          </button>
        </div>
      </div>


      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
        <input
          type        = "text"
          value       = {searchQuery}
          onChange    = {handleSearchChange}
          placeholder = "Search by name or email…"
          className   = "w-full bg-white border border-[#D7F2E0] rounded-xl pl-11 pr-4 py-3 text-[#0B1F14] text-base placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A] transition-all"
        />
      </div>


      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <p className="text-[#991B1B] text-base font-semibold">{error}</p>
        </div>
      )}


      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
          <UserCheck size={18} className="text-[#3D5347]" />
          <h2 className="text-[#0B1F14] text-base font-bold">Teacher Directory</h2>
          {!isLoading && (
            <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
              {teachers.length}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="divide-y divide-[#F4FBF6]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-[#F4FBF6] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F4FBF6] rounded w-1/4" />
                  <div className="h-3 bg-[#F4FBF6] rounded w-1/3" />
                </div>
                <div className="h-7 w-20 rounded-full bg-[#F4FBF6]" />
                <div className="h-9 w-24 rounded-xl bg-[#F4FBF6]" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && teachers.length === 0 && error === null && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-5">
              <UserCheck size={28} className="text-[#6B8479]" />
            </div>
            <p className="text-[#0B1F14] text-base font-bold">
              {searchQuery ? 'No teachers match your search' : 'No teachers registered yet'}
            </p>
            <p className="text-[#6B8479] text-sm mt-1.5 max-w-xs leading-relaxed">
              {searchQuery
                ? 'Try a different name or email address.'
                : 'Add your first teacher to begin managing your campus.'}
            </p>
            {!searchQuery && (
              <button
                type      = "button"
                onClick   = {() => setShowModal(true)}
                className = "mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14] text-base font-bold transition-colors"
              >
                <Plus size={17} />
                Add First Teacher
              </button>
            )}
          </div>
        )}

        {!isLoading && teachers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D7F2E0]">
                  {['Teacher', 'Email', 'Branch', 'Added', 'Status', 'Actions'].map((h) => (
                    <th
                      key       = {h}
                      className = "text-left px-6 py-3.5 text-[#3D5347] font-semibold text-sm uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher, i) => {
                  const isActive = teacher.is_active !== false;
                  const isEven   = i % 2 === 0;
                  return (
                    <tr
                      key       = {teacher.id}
                      className = {`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors ${isEven ? 'bg-white' : 'bg-[#F4FBF6]'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
                            <span className="text-[#15803D] text-base font-bold">
                              {teacher.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[#0B1F14] text-base font-semibold whitespace-nowrap">
                            {teacher.username}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Mail size={13} className="text-[#6B8479] flex-shrink-0" />
                          <span className="text-[#3D5347] text-sm">{teacher.email}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-[#3D5347] text-sm whitespace-nowrap">
                          {teacher.branch_name}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[#6B8479] text-sm">
                          <Calendar size={13} />
                          {new Date(teacher.created_at).toLocaleDateString('en-NG', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge active={isActive} />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type      = "button"
                            title     = "Manage subject & class teacher assignments"
                            onClick   = {() => setAssignmentsTarget(teacher)}
                            className = "p-2 rounded-lg text-[#6B8479] hover:text-[#0369A1] hover:bg-[#EFF6FF] transition-colors"
                          >
                            <BookOpen size={16} />
                          </button>
                          {isActive ? (
                            <button
                              type      = "button"
                              title     = "Suspend"
                              onClick   = {() => setActionTarget({ teacher, action: 'suspend' })}
                              className = "p-2 rounded-lg text-[#6B8479] hover:text-[#92400E] hover:bg-[#FFFBEB] transition-colors"
                            >
                              <UserX size={16} />
                            </button>
                          ) : (
                            <button
                              type      = "button"
                              title     = "Reactivate"
                              onClick   = {() => setActionTarget({ teacher, action: 'reactivate' })}
                              className = "p-2 rounded-lg text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE] transition-colors"
                            >
                              <UserCheck size={16} />
                            </button>
                          )}
                          <button
                            type      = "button"
                            title     = "Delete"
                            onClick   = {() => setActionTarget({ teacher, action: 'delete' })}
                            className = "p-2 rounded-lg text-[#6B8479] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {showModal && (
        <CreateTeacherModal
          onClose   = {() => setShowModal(false)}
          onCreated = {(teacher) => {
            setTeachers((prev) => [teacher, ...prev]);
            setShowModal(false);
            setToast({ type: 'success', message: `Teacher "${teacher.username}" added successfully.` });
          }}
        />
      )}

      {assignmentsTarget !== null && (
        <ManageAssignmentsModal
          teacher = {assignmentsTarget}
          onClose = {() => setAssignmentsTarget(null)}
          onToast = {setToast}
        />
      )}

      {actionTarget !== null && (
        <ConfirmDialog
          title        = {
            actionTarget.action === 'delete'  ? `Delete "${actionTarget.teacher.username}"?`     :
            actionTarget.action === 'suspend' ? `Suspend "${actionTarget.teacher.username}"?`    :
                                                `Reactivate "${actionTarget.teacher.username}"?`
          }
          message      = {
            actionTarget.action === 'delete'
              ? 'This permanently deletes the teacher account including all exams and student data they created. This cannot be undone.'
              : actionTarget.action === 'suspend'
              ? 'This teacher will immediately lose login access. Their student and exam records remain intact.'
              : 'This teacher will regain access to their dashboard.'
          }
          confirmLabel = {
            actionTarget.action === 'delete'  ? 'Delete Account' :
            actionTarget.action === 'suspend' ? 'Suspend Access' : 'Reactivate'
          }
          danger       = {actionTarget.action === 'delete' || actionTarget.action === 'suspend'}
          isLoading    = {isActioning}
          onConfirm    = {() => void handleAction()}
          onCancel     = {() => setActionTarget(null)}
        />
      )}

      {toast !== null && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}