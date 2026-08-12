// ================================================================
//  CBT SYSTEM — EXAM MANAGEMENT PAGE
//  File    : src/pages/teacher/ExamManagementPage.tsx
//  Design  : Vibrant Institutional Light Mode
//
//  Addition: SubjectCascadeSelector now restricts the subject
//  dropdown to a teacher's assigned subjects (fetched once via
//  /api/teacher/my-subjects, filtered client-side by class+dept
//  as the cascade changes) — matching the server-side restriction
//  already enforced in createExamShell. Admins/super admins are
//  unrestricted, same as the backend.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
}                        from 'react';
import {
  ClipboardList,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit3,
  ChevronDown,
  Upload,
  Download,
  BookOpen,
  FileSpreadsheet,
  ChevronRight,
  Clock,
  Zap,
  Calendar,
  Tag,
  Award,
  Lock,
}                        from 'lucide-react';

import axiosInstance               from '../../api/axiosInstance';
import { useAuth }                 from '../../context/AuthContext';
import { useCurriculumConstraint } from '../../hooks/useCurriculumConstraint';
import type {
  ClassLevel,
  Department,
  Subject,
  Exam,
  TeacherSubjectAssignment,
}                                  from '../../types/exam';
import { formatDuration }          from '../../utils/timeFormatter';


interface ExamRecord extends Exam {
  exam_id                 : number;
  subject_id              : number;
  exam_title              : string;
  is_active               : boolean;
  question_count          : number;
  evaluation_type         : 'midterm' | 'terminal' | null;
  max_raw_mark            : number | null;
  score_weight            : number | null;
  academic_session        : string | null;
  term                    : number | null;
  created_by              : number;
  created_by_username     : string;
}

interface ActivePeriod {
  display       : string;
  active_session: string;
  active_term   : number;
  term_label    : string;
}

interface Toast { type: 'success' | 'error'; message: string }

interface QuestionFormState {
  questionText : string;
  optionA      : string;
  optionB      : string;
  optionC      : string;
  optionD      : string;
  correctOption: string;
}

interface BulkQuestionResponse {
  success       : boolean;
  message       : string;
  inserted_count: number;
  error_count   : number;
  row_errors    : Array<{ row: number; preview: string; errors: string[] }>;
}

interface ExamListResponse    { success: boolean; exams: ExamRecord[] }
interface ClassListResponse   { success: boolean; classes: ClassLevel[] }
interface DeptListResponse    { success: boolean; departments: Department[] }
interface SubjectListResponse { success: boolean; subjects: Subject[] }
interface MySubjectsResponse  { success: boolean; subjects: TeacherSubjectAssignment[] }
interface ToggleResponse      { success: boolean; exam: { id: number; is_active: boolean } }
interface DeleteResponse      { success: boolean; message: string }
interface ActivePeriodResponse {
  success       : boolean;
  display       : string;
  active_session: string;
  active_term   : number;
  term_label    : string;
}

interface ExistingExam {
  exam_id            : number;
  exam_title         : string;
  created_by_username: string;
  created_by_branch  : string | null;
  question_count     : number;
}

interface DuplicateCheckResponse {
  success      : boolean;
  has_duplicate: boolean;
  existing_exam: ExistingExam | null;
}

function ToastNotification({
  toast,
  onDismiss,
}: {
  toast    : Toast;
  onDismiss: () => void;
}): React.JSX.Element {
  useEffect((): (() => void) => {
    const t = setTimeout(onDismiss, 4500);
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
  title,
  message,
  confirmLabel,
  isLoading,
  onConfirm,
  onCancel,
}: {
  title        : string;
  message      : string;
  confirmLabel : string;
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
        <div className="w-full max-w-sm bg-white border border-[#D7F2E0] rounded-2xl p-6 space-y-4 shadow-2xl">
          <h3 className="text-[#0B1F14] text-lg font-bold">{title}</h3>
          <p className="text-[#3D5347] text-base leading-relaxed">{message}</p>
          <div className="flex justify-end gap-3 pt-1">
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
              className = "flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
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


function EvalTypeBadge({
  type,
}: {
  type: 'midterm' | 'terminal' | null | undefined;
}): React.JSX.Element | null {
  if (type === null || type === undefined) return null;
  return (
    <span className={[
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold border',
      type === 'midterm'
        ? 'bg-[#EFF6FF] text-[#0369A1] border-[#BAE6FD]'
        : 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
    ].join(' ')}>
      <Tag size={11} />
      {type === 'midterm' ? 'CA / Midterm' : 'Terminal'}
    </span>
  );
}


function SessionTermLabel({
  session,
  term,
}: {
  session: string | null | undefined;
  term   : number | null | undefined;
}): React.JSX.Element | null {
  if (!session) return null;
  return (
    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#6B8479] text-sm font-medium">
      <Calendar size={11} />
      {session}
      {term !== null && term !== undefined && <> · T{term}</>}
    </span>
  );
}


interface SubjectSelectorProps {
  classes        : ClassLevel[];
  departments    : Department[];
  classId        : string;
  deptId         : string;
  subjectId      : string;
  onClassChange  : (v: string) => void;
  onDeptChange   : (v: string) => void;
  onSubjectChange: (v: string) => void;
  disabled       : boolean;
  errors         : Record<string, string>;
}

function SubjectCascadeSelector({
  classes,
  departments,
  classId,
  deptId,
  subjectId,
  onClassChange,
  onDeptChange,
  onSubjectChange,
  disabled,
  errors,
}: SubjectSelectorProps): React.JSX.Element {
  const { role } = useAuth();
  const isRestrictedTeacher = role === 'teacher';

  const [subjects,        setSubjects]        = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(false);
  const [myAssignedSubjects, setMyAssignedSubjects] = useState<TeacherSubjectAssignment[]>([]);
  const [myAssignedLoaded,   setMyAssignedLoaded]   = useState<boolean>(false);

  const curriculum = useCurriculumConstraint(classId, classes, departments);

  useEffect((): void => {
    if (
      curriculum.effectiveDeptId !== '' &&
      curriculum.effectiveDeptId !== deptId
    ) {
      onDeptChange(curriculum.effectiveDeptId);
      onSubjectChange('');
    }
  }, [curriculum.effectiveDeptId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect((): void => {
    if (!isRestrictedTeacher) { setMyAssignedLoaded(true); return; }
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<MySubjectsResponse>('/api/teacher/my-subjects');
        if (res.data.success) setMyAssignedSubjects(res.data.subjects);
      } catch {
        setMyAssignedSubjects([]);
      } finally {
        setMyAssignedLoaded(true);
      }
    };
    void load();
  }, [isRestrictedTeacher]);

  useEffect((): (() => void) => {
    const resolvedDept = curriculum.isDepartmentLocked
      ? curriculum.effectiveDeptId
      : deptId;

    if (!classId || !resolvedDept) { setSubjects([]); return (): void => undefined; }

    if (isRestrictedTeacher) {
      const filtered = myAssignedSubjects
        .filter((s) => String(s.class_id) === classId && String(s.department_id) === resolvedDept)
        .map((s): Subject => ({
          subject_id     : s.subject_id,
          subject_name   : s.subject_name,
          class_id       : s.class_id,
          class_name     : s.class_name,
          department_id  : s.department_id,
          department_name: s.department_name,
        }));
      setSubjects(filtered);
      setLoadingSubjects(!myAssignedLoaded);
      return (): void => undefined;
    }

    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoadingSubjects(true);
      try {
        const res = await axiosInstance.get<SubjectListResponse>(
          `/api/shared/subjects?class_id=${classId}&department_id=${resolvedDept}`
        );
        if (!cancelled && res.data.success) setSubjects(res.data.subjects);
      } catch {
        if (!cancelled) setSubjects([]);
      } finally {
        if (!cancelled) setLoadingSubjects(false);
      }
    };
    void load();
    return (): void => { cancelled = true; };
  }, [classId, deptId, curriculum.isDepartmentLocked, curriculum.effectiveDeptId, isRestrictedTeacher, myAssignedSubjects, myAssignedLoaded]);

  const selCls = (field: string): string => [
    'w-full appearance-none bg-white border-2 rounded-xl px-4 py-3.5 text-base',
    'focus:outline-none transition-all cursor-pointer pr-12',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    errors[field]
      ? 'border-[#FCA5A5] focus:border-[#991B1B]'
      : 'border-[#D7F2E0] focus:border-[#4AE17A]',
  ].join(' ');

  const effectiveDeptValue = curriculum.effectiveDeptId || deptId;

  const noAssignedSubjectsAtAll = isRestrictedTeacher && myAssignedLoaded && myAssignedSubjects.length === 0;

  return (
    <div className="space-y-3">
      {noAssignedSubjectsAtAll && (
        <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-[#92400E] flex-shrink-0 mt-0.5" />
          <p className="text-[#92400E] text-sm leading-relaxed">
            You have no subjects assigned yet. Ask your admin to assign you at least one subject before creating an exam.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div>
          <label className="block text-[#3D5347] text-base font-semibold mb-2">
            Class Level
          </label>
          <div className="relative">
            <select
              value     = {classId}
              onChange  = {(e) => { onClassChange(e.target.value); onSubjectChange(''); }}
              disabled  = {disabled}
              className = {`${selCls('classId')} ${classId === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]'}`}
            >
              <option value="" disabled>Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
          </div>
          {errors.classId && <p className="text-[#991B1B] text-sm mt-1.5">{errors.classId}</p>}
        </div>

        <div>
          <label className="block text-[#3D5347] text-base font-semibold mb-2">
            Department
          </label>
          <div className="relative">
            <select
              value     = {effectiveDeptValue}
              onChange  = {(e) => {
                curriculum.setDeptId(e.target.value);
                onDeptChange(e.target.value);
                onSubjectChange('');
              }}
              disabled  = {disabled || curriculum.isDepartmentLocked}
              className = {[
                selCls('deptId'),
                curriculum.isDepartmentLocked
                  ? 'border-[#FCD34D] bg-[#FFFBEB] opacity-80'
                  : '',
                effectiveDeptValue === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]',
              ].join(' ')}
            >
              <option value="" disabled>
                {curriculum.isDepartmentLocked ? 'General (auto-assigned)' : 'Select dept…'}
              </option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
          </div>
          {curriculum.lockReason !== null && (
            <div className="flex items-start gap-2 mt-2 px-3 py-2 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-[#92400E] flex-shrink-0 mt-1.5" />
              <p className="text-[#92400E] text-sm leading-relaxed">
                {curriculum.lockReason}
              </p>
            </div>
          )}
          {errors.deptId && <p className="text-[#991B1B] text-sm mt-1.5">{errors.deptId}</p>}
        </div>

        <div>
          <label className="block text-[#3D5347] text-base font-semibold mb-2">
            Subject
          </label>
          <div className="relative">
            <select
              value     = {subjectId}
              onChange  = {(e) => onSubjectChange(e.target.value)}
              disabled  = {disabled || loadingSubjects || subjects.length === 0}
              className = {`${selCls('subjectId')} ${subjectId === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]'}`}
            >
              <option value="" disabled>
                {loadingSubjects
                  ? 'Loading…'
                  : subjects.length === 0
                  ? (classId && (deptId || curriculum.effectiveDeptId)
                      ? (isRestrictedTeacher ? 'No subjects assigned for this class/dept' : 'No subjects found')
                      : 'Select class & dept first')
                  : 'Select subject…'
                }
              </option>
              {subjects.map((s) => (
                <option key={s.subject_id} value={String(s.subject_id)}>{s.subject_name}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
          </div>
          {errors.subjectId && <p className="text-[#991B1B] text-sm mt-1.5">{errors.subjectId}</p>}
        </div>
      </div>
    </div>
  );
}


interface ExamModalProps {
  classes      : ClassLevel[];
  departments  : Department[];
  editingExam? : ExamRecord;
  activePeriod : ActivePeriod | null;
  periodLoading: boolean;
  onClose      : () => void;
  onSaved      : (exam: ExamRecord, isEdit: boolean) => void;
}

function ExamModal({
  classes,
  departments,
  editingExam,
  activePeriod,
  periodLoading,
  onClose,
  onSaved,
  onNavigateToExam,
}: ExamModalProps & {
  onNavigateToExam?: (examId: number) => void;
}): React.JSX.Element {
  const isEdit = editingExam !== undefined;

  const [title,       setTitle]       = useState<string>(editingExam?.exam_title ?? '');
  const [classId,     setClassId]     = useState<string>('');
  const [deptId,      setDeptId]      = useState<string>('');
  const [subjectId,   setSubjectId]   = useState<string>(
    editingExam?.subject_id !== undefined ? String(editingExam.subject_id) : ''
  );
  const [duration,    setDuration]    = useState<string>(
    editingExam?.duration_minutes !== undefined ? String(editingExam.duration_minutes) : ''
  );
  const [totalQ,      setTotalQ]      = useState<string>(
    editingExam?.total_questions_to_show !== undefined
      ? String(editingExam.total_questions_to_show)
      : ''
  );
  const [evalType,    setEvalType]    = useState<string>(
    editingExam?.evaluation_type ?? 'terminal'
  );
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [isSubmitting,setIsSubmitting]= useState<boolean>(false);
  const [duplicateWarning, setDuplicateWarning] = useState<ExistingExam | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState<boolean>(false);
  const duplicateCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect((): (() => void) => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return (): void => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect((): (() => void) => {
    if (isEdit || !subjectId || !activePeriod) {
      setDuplicateWarning(null);
      return (): void => undefined;
    }

    if (duplicateCheckRef.current !== null) {
      clearTimeout(duplicateCheckRef.current);
    }

    duplicateCheckRef.current = setTimeout(async (): Promise<void> => {
      setCheckingDuplicate(true);
      try {
        const res = await axiosInstance.get<DuplicateCheckResponse>(
          `/api/teacher/exams/check-duplicate` +
          `?subject_id=${subjectId}` +
          `&evaluation_type=${evalType}` +
          `&academic_session=${encodeURIComponent(activePeriod.active_session)}` +
          `&term=${activePeriod.active_term}`
        );
        if (res.data.success && res.data.has_duplicate && res.data.existing_exam !== null) {
          setDuplicateWarning(res.data.existing_exam);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        setDuplicateWarning(null);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 300);

    return (): void => {
      if (duplicateCheckRef.current !== null) clearTimeout(duplicateCheckRef.current);
    };
  }, [subjectId, evalType, activePeriod, isEdit]);



  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!title.trim())                      e.title     = 'Exam title is required.';
    if (!isEdit && !subjectId)              e.subjectId = 'Please select a subject.';
    if (!isEdit && !classId)                e.classId   = 'Please select a class.';
    if (!duration || Number(duration) <= 0) e.duration  = 'Duration must be a positive number.';
    if (!totalQ   || Number(totalQ)   <= 0) e.totalQ    = 'Questions to show must be a positive number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setApiError(null);

    try {
      let res;
      if (isEdit && editingExam !== undefined) {
        res = await axiosInstance.put<{ success: boolean; exam: ExamRecord }>(
          `/api/teacher/exams/${editingExam.exam_id}`,
          {
            title                   : title.trim(),
            duration_minutes        : Number(duration),
            total_questions_to_show : Number(totalQ),
            evaluation_type         : evalType,
          }
        );
      } else {
        res = await axiosInstance.post<{ success: boolean; exam: ExamRecord }>(
          '/api/teacher/exams',
          {
            title                   : title.trim(),
            subject_id              : Number(subjectId),
            duration_minutes        : Number(duration),
            total_questions_to_show : Number(totalQ),
            evaluation_type         : evalType,
          }
        );
      }
      if (res.data.success) onSaved(res.data.exam, isEdit);

    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as {
          response?: {
            status?: number;
            data?: {
              message?     : string;
              code?        : string;
              existing_exam?: ExistingExam;
            }
          }
        };

        if (
          err.response?.status === 409 &&
          err.response.data?.code === 'DUPLICATE_EXAM' &&
          err.response.data.existing_exam !== undefined
        ) {
          setDuplicateWarning(err.response.data.existing_exam);
          setApiError(err.response.data.message ?? 'This exam already exists.');
        } else {
          setApiError(err.response?.data?.message ?? 'Failed to save exam.');
        }
      } else {
        setApiError('Failed to save exam. Please try again.');
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
        className = "fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        role      = "dialog"
        aria-modal= "true"
      >
        <div className="w-full max-w-lg bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl my-4">

          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center">
                <ClipboardList size={17} className="text-[#15803D]" />
              </div>
              <h2 className="text-[#0B1F14] text-lg font-bold">
                {isEdit ? 'Edit Exam' : 'Create New Exam'}
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

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">

            {!isEdit && (
              <div className={[
                'flex items-center gap-3 rounded-xl px-4 py-3.5 border-2',
                periodLoading
                  ? 'bg-[#F4FBF6] border-[#D7F2E0]'
                  : 'bg-[#E7FBEE] border-[#86EFAC]',
              ].join(' ')}>
                <Calendar
                  size      = {16}
                  className = {periodLoading ? 'text-[#6B8479]' : 'text-[#15803D]'}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[#6B8479] text-sm font-medium uppercase tracking-wide">
                    This exam will be tagged to
                  </p>
                  {periodLoading ? (
                    <div className="h-4 w-48 bg-[#D7F2E0] rounded animate-pulse mt-1" />
                  ) : activePeriod !== null ? (
                    <p className="text-[#15803D] text-base font-bold mt-0.5">
                      {activePeriod.display}
                    </p>
                  ) : (
                    <p className="text-[#6B8479] text-base mt-0.5">
                      Period not configured — contact the Super Admin.
                    </p>
                  )}
                </div>
                <span className="text-[#6B8479] text-sm flex-shrink-0">Auto-stamped</span>
              </div>
            )}

            {duplicateWarning !== null && (
              <div className="bg-[#FEF2F2] border-2 border-[#FCA5A5] rounded-xl px-5 py-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[#991B1B] text-base font-bold">
                      This exam already exists
                    </p>
                    <p className="text-[#991B1B] text-sm mt-0.5 leading-relaxed">
                      A {evalType === 'midterm' ? 'CA / Midterm' : 'Terminal'} exam for this
                      subject already exists for the current academic period.
                      Upload your questions to the existing exam instead of creating a new one.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-[#FCA5A5] rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-[#0B1F14] text-sm font-bold">
                    "{duplicateWarning.exam_title}"
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[#6B8479] text-sm">
                      Created by <span className="font-semibold text-[#3D5347]">
                        {duplicateWarning.created_by_username}
                      </span>
                    </span>
                    {duplicateWarning.created_by_branch !== null && (
                      <>
                        <span className="text-[#D7F2E0] text-sm">·</span>
                        <span className="text-[#6B8479] text-sm">
                          {duplicateWarning.created_by_branch}
                        </span>
                      </>
                    )}
                    <span className="text-[#D7F2E0] text-sm">·</span>
                    <span className="text-[#6B8479] text-sm">
                      {duplicateWarning.question_count} question(s) uploaded
                    </span>
                  </div>
                </div>

                {onNavigateToExam !== undefined && (
                  <button
                    type      = "button"
                    onClick   = {() => {
                      onClose();
                      onNavigateToExam(duplicateWarning.exam_id);
                    }}
                    className = "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold transition-colors"
                  >
                    <BookOpen size={14} />
                    Go to existing exam and add questions there
                  </button>
                )}
              </div>
            )}

            {checkingDuplicate && !isEdit && subjectId !== '' && (
              <div className="flex items-center gap-2 text-[#6B8479] text-sm">
                <Loader2 size={14} className="animate-spin" />
                Checking for existing exams…
              </div>
            )}

            {apiError !== null && duplicateWarning === null && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                <p className="text-[#991B1B] text-base">{apiError}</p>
              </div>
            )}

            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                Exam Title
              </label>
              <input
                type        = "text"
                value       = {title}
                onChange    = {(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: '' })); }}
                disabled    = {isSubmitting}
                placeholder = "e.g., SS2 Chemistry – First Term Exam"
                className   = {fieldCls('title')}
              />
              {errors.title && <p className="text-[#991B1B] text-sm mt-1.5">{errors.title}</p>}
            </div>

            {!isEdit && (
              <SubjectCascadeSelector
                classes        = {classes}
                departments    = {departments}
                classId        = {classId}
                deptId         = {deptId}
                subjectId      = {subjectId}
                onClassChange  = {setClassId}
                onDeptChange   = {setDeptId}
                onSubjectChange= {setSubjectId}
                disabled       = {isSubmitting}
                errors         = {errors}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#3D5347] text-base font-semibold mb-2">
                  Duration (minutes)
                </label>
                <input
                  type        = "number"
                  min         = {1}
                  value       = {duration}
                  onChange    = {(e) => { setDuration(e.target.value); setErrors((p) => ({ ...p, duration: '' })); }}
                  disabled    = {isSubmitting}
                  placeholder = "60"
                  className   = {fieldCls('duration')}
                />
                {errors.duration && <p className="text-[#991B1B] text-sm mt-1.5">{errors.duration}</p>}
              </div>
              <div>
                <label className="block text-[#3D5347] text-base font-semibold mb-2">
                  Questions to Show
                </label>
                <input
                  type        = "number"
                  min         = {1}
                  value       = {totalQ}
                  onChange    = {(e) => { setTotalQ(e.target.value); setErrors((p) => ({ ...p, totalQ: '' })); }}
                  disabled    = {isSubmitting}
                  placeholder = "40"
                  className   = {fieldCls('totalQ')}
                />
                {errors.totalQ && <p className="text-[#991B1B] text-sm mt-1.5">{errors.totalQ}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">

              <div>
                <label className="block text-[#3D5347] text-base font-semibold mb-2">
                  Exam Type
                </label>
                <div className="relative">
                  <select
                    value     = {evalType}
                    onChange  = {(e) => {
                      const t = e.target.value;
                      setEvalType(t);
                     
                    }}
                    disabled  = {isSubmitting}
                    className = "w-full appearance-none bg-white border-2 border-[#D7F2E0] rounded-xl px-4 py-3.5 text-base text-[#0B1F14] focus:outline-none focus:border-[#4AE17A] transition-all cursor-pointer pr-12 disabled:opacity-50"
                  >
                    <option value="terminal">Terminal Exam</option>
                    <option value="midterm">CA / Midterm</option>
                  </select>
                  <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
                </div>
                <div className="mt-2">
                  <span className={[
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold border',
                    evalType === 'midterm'
                      ? 'bg-[#EFF6FF] text-[#0369A1] border-[#BAE6FD]'
                      : 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
                  ].join(' ')}>
                    <Tag size={11} />
                    {evalType === 'midterm' ? 'CA / Midterm' : 'Terminal Exam'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[#3D5347] text-base font-semibold mb-2">
                  Max Mark
                </label>
                <div className="flex items-center gap-1.5 px-4 py-3.5 bg-[#F4FBF6] border-2 border-[#D7F2E0] rounded-xl">
                  <Lock size={13} className="text-[#6B8479] flex-shrink-0" />
                  <span className="text-[#3D5347] text-base font-semibold tabular-nums">
                    {evalType === 'midterm' ? '30' : '60'}
                  </span>
                  <span className="text-[#6B8479] text-sm ml-auto">
                    {evalType === 'midterm' ? 'matches 30% weight' : 'matches 60% weight'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl px-4 py-3.5">
              <Award size={15} className="text-[#6B8479] flex-shrink-0 mt-0.5" />
              <p className="text-[#3D5347] text-sm leading-relaxed">
                <strong className="text-[#0B1F14]">How this counts toward the report card:</strong>{' '}
                Report card grades use a fixed, school-wide split — Exam 60%, Test 30%, Other 10% —
                set once for every subject, not per exam. Max Mark is fixed to match each
                component's weight exactly (Test out of 30, Exam out of 60), so every exam of the
                same type is scored against the same denominator across the whole school.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
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
                {isSubmitting
                  ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
                  : <><Plus size={16} /> {isEdit ? 'Save Changes' : 'Create Exam'}</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}


type QuestionTab = 'manual' | 'upload';

function QuestionBankPanel({
  exam,
  onQuestionAdded,
}: {
  exam           : ExamRecord;
  onQuestionAdded: (examId: number) => void;
}): React.JSX.Element {
  const [activeTab,    setActiveTab]    = useState<QuestionTab>('manual');
  const [form,         setForm]         = useState<QuestionFormState>({
    questionText: '', optionA: '', optionB: '',
    optionC: '', optionD: '', correctOption: '',
  });
  const [formErrors,   setFormErrors]   = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [manualToast,  setManualToast]  = useState<Toast | null>(null);
  const [uploadFile,   setUploadFile]   = useState<File | null>(null);
  const [isUploading,  setIsUploading]  = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<BulkQuestionResponse | null>(null);
  const [isDragOver,   setIsDragOver]   = useState<boolean>(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const VALID_OPTIONS = ['A', 'B', 'C', 'D'];

  const validateManual = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.questionText.trim()) e.questionText  = 'Question text is required.';
    if (!form.optionA.trim())      e.optionA       = 'Option A is required.';
    if (!form.optionB.trim())      e.optionB       = 'Option B is required.';
    if (!form.optionC.trim())      e.optionC       = 'Option C is required.';
    if (!form.optionD.trim())      e.optionD       = 'Option D is required.';
    if (!VALID_OPTIONS.includes(form.correctOption)) e.correctOption = 'Select A, B, C, or D.';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleManualSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!validateManual()) return;
    setIsSubmitting(true);
    try {
      const csvContent =
        'Question Text,Option A,Option B,Option C,Option D,Correct Answer\n' +
        `"${form.questionText.replace(/"/g, '""')}","${form.optionA}","${form.optionB}","${form.optionC}","${form.optionD}","${form.correctOption}"`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const fd   = new FormData();
      fd.append('file', blob, 'question.csv');
      const res = await axiosInstance.post<BulkQuestionResponse>(
        `/api/upload/questions?exam_id=${exam.exam_id}`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (res.data.inserted_count > 0) {
        setForm({ questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: '' });
        setManualToast({ type: 'success', message: 'Question added successfully.' });
        onQuestionAdded(exam.exam_id);
      } else if (res.data.row_errors.length > 0) {
        setManualToast({ type: 'error', message: res.data.row_errors[0]?.errors[0] ?? 'Failed to add question.' });
      }
    } catch {
      setManualToast({ type: 'error', message: 'Failed to add question. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async (): Promise<void> => {
    if (uploadFile === null) return;
    setIsUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const res = await axiosInstance.post<BulkQuestionResponse>(
        `/api/upload/questions?exam_id=${exam.exam_id}`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setUploadResult(res.data);
      if (res.data.inserted_count > 0) onQuestionAdded(exam.exam_id);
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setUploadResult({
          success: false, message: err.response?.data?.message ?? 'Upload failed.',
          inserted_count: 0, error_count: 0, row_errors: [],
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const fieldCls = (f: string): string => [
    'w-full bg-white border-2 rounded-xl px-3.5 py-2.5 text-[#0B1F14] text-sm',
    'placeholder:text-[#6B8479] focus:outline-none transition-all',
    formErrors[f]
      ? 'border-[#FCA5A5] focus:border-[#991B1B]'
      : 'border-[#D7F2E0] focus:border-[#4AE17A]',
  ].join(' ');

  return (
    <div className="bg-[#F4FBF6] border-t border-[#D7F2E0]">

      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-[#D7F2E0]">
        <BookOpen size={15} className="text-[#15803D]" />
        <p className="text-[#3D5347] text-base font-semibold">
          Question Bank —{' '}
          <span className="text-[#15803D]">{exam.exam_title}</span>
        </p>
        <span className="ml-auto px-3 py-0.5 rounded-full bg-[#E7FBEE] text-[#15803D] text-sm font-semibold border border-[#86EFAC]">
          {exam.question_count} / {exam.total_questions_to_show} questions
        </span>
      </div>

      <div className="flex border-b border-[#D7F2E0]">
        {(['manual', 'upload'] as const).map((tab) => (
          <button
            key       = {tab}
            type      = "button"
            onClick   = {() => setActiveTab(tab)}
            className = {[
              'flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all border-b-2',
              activeTab === tab
                ? 'text-[#15803D] border-[#4AE17A] bg-[#E7FBEE]'
                : 'text-[#6B8479] border-transparent hover:text-[#3D5347] hover:bg-[#F4FBF6]',
            ].join(' ')}
          >
            {tab === 'manual' ? <Plus size={14} /> : <Upload size={14} />}
            {tab === 'manual' ? 'Manual Entry' : 'Excel Upload'}
          </button>
        ))}
      </div>

      {activeTab === 'manual' && (
        <div className="p-6">
          {manualToast !== null && (
            <div className={[
              'flex items-center gap-2 mb-4 px-4 py-3 rounded-xl border text-base',
              manualToast.type === 'success'
                ? 'bg-[#E7FBEE] border-[#86EFAC] text-[#15803D]'
                : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]',
            ].join(' ')}>
              {manualToast.type === 'success'
                ? <CheckCircle size={16} />
                : <AlertCircle size={16} />
              }
              {manualToast.message}
              <button type="button" onClick={() => setManualToast(null)} className="ml-auto">
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={handleManualSubmit} noValidate className="space-y-4">
            <div>
              <label className="block text-[#3D5347] text-sm font-semibold mb-1.5">
                Question Text
              </label>
              <textarea
                rows        = {3}
                value       = {form.questionText}
                onChange    = {(e) => { setForm((p) => ({ ...p, questionText: e.target.value })); setFormErrors((p) => ({ ...p, questionText: '' })); }}
                disabled    = {isSubmitting}
                placeholder = "Enter the full question stem…"
                className   = {`${fieldCls('questionText')} resize-none`}
              />
              {formErrors.questionText && <p className="text-[#991B1B] text-sm mt-1">{formErrors.questionText}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                const key = `option${letter}` as keyof QuestionFormState;
                return (
                  <div key={letter}>
                    <label className="block text-[#3D5347] text-sm font-semibold mb-1.5">
                      Option {letter}
                    </label>
                    <input
                      type        = "text"
                      value       = {form[key]}
                      onChange    = {(e) => { setForm((p) => ({ ...p, [key]: e.target.value })); setFormErrors((p) => ({ ...p, [key]: '' })); }}
                      disabled    = {isSubmitting}
                      placeholder = {`Choice ${letter}`}
                      className   = {fieldCls(key)}
                    />
                    {formErrors[key] && <p className="text-[#991B1B] text-sm mt-0.5">{formErrors[key]}</p>}
                  </div>
                );
              })}
            </div>

            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-[#3D5347] text-sm font-semibold mb-1.5">
                  Correct Answer
                </label>
                <div className="relative">
                  <select
                    value     = {form.correctOption}
                    onChange  = {(e) => { setForm((p) => ({ ...p, correctOption: e.target.value })); setFormErrors((p) => ({ ...p, correctOption: '' })); }}
                    disabled  = {isSubmitting}
                    className = {`${fieldCls('correctOption')} appearance-none pr-10 ${form.correctOption === '' ? 'text-[#6B8479]' : 'text-[#15803D] font-bold'}`}
                  >
                    <option value="" disabled>Select…</option>
                    {VALID_OPTIONS.map((o) => (
                      <option key={o} value={o} className="text-[#0B1F14] font-bold">{o}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
                </div>
                {formErrors.correctOption && <p className="text-[#991B1B] text-sm mt-0.5">{formErrors.correctOption}</p>}
              </div>
              <button
                type      = "submit"
                disabled  = {isSubmitting}
                className = "flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Add Question
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 bg-white border border-[#D7F2E0] rounded-xl px-5 py-3.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-[#15803D]" />
              <p className="text-[#3D5347] text-sm font-semibold">
                Columns: Question Text · Option A–D · Correct Answer
              </p>
            </div>
            <a
              href      = "/templates/question_upload_template.xlsx"
              download
              className = "flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14] text-sm font-bold transition-colors flex-shrink-0"
            >
              <Download size={14} /> Template
            </a>
          </div>

          <div
            onDragOver = {(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave= {() => setIsDragOver(false)}
            onDrop     = {(e: React.DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              setIsDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f !== undefined) { setUploadFile(f); setUploadResult(null); }
            }}
            onClick    = {() => fileRef.current?.click()}
            className  = {[
              'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
              isDragOver
                ? 'border-[#4AE17A] bg-[#E7FBEE]'
                : uploadFile !== null
                ? 'border-[#86EFAC] bg-[#E7FBEE]'
                : 'border-[#D7F2E0] hover:border-[#22B85C] bg-white',
            ].join(' ')}
          >
            <input
              ref      = {fileRef}
              type     = "file"
              accept   = ".xlsx,.xls,.csv"
              className= "hidden"
              onChange = {(e) => {
                const f = e.target.files?.[0];
                if (f !== undefined) { setUploadFile(f); setUploadResult(null); }
              }}
            />
            <Upload
              size      = {28}
              className = {[
                'mx-auto mb-3',
                isDragOver    ? 'text-[#4AE17A]' :
                uploadFile !== null ? 'text-[#15803D]' :
                'text-[#6B8479]',
              ].join(' ')}
            />
            {uploadFile !== null ? (
              <p className="text-[#15803D] text-base font-semibold">{uploadFile.name}</p>
            ) : (
              <>
                <p className="text-[#3D5347] text-base font-semibold">Drag & drop spreadsheet here</p>
                <p className="text-[#6B8479] text-sm mt-1">or click to browse · .xlsx, .xls, .csv</p>
              </>
            )}
          </div>

          {uploadFile !== null && (
            <div className="flex items-center justify-between">
              <button
                type      = "button"
                onClick   = {() => { setUploadFile(null); setUploadResult(null); }}
                className = "text-[#6B8479] text-sm hover:text-[#3D5347] transition-colors flex items-center gap-1.5 font-medium"
              >
                <X size={14} /> Remove file
              </button>
              <button
                type      = "button"
                onClick   = {() => void handleBulkUpload()}
                disabled  = {isUploading}
                className = "flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
              >
                {isUploading
                  ? <><Loader2 size={15} className="animate-spin" /> Uploading…</>
                  : <><Upload size={15} /> Upload Questions</>
                }
              </button>
            </div>
          )}

          {uploadResult !== null && (
            <div className={[
              'rounded-xl border px-5 py-4 text-base',
              uploadResult.inserted_count > 0
                ? 'bg-[#E7FBEE] border-[#86EFAC] text-[#15803D]'
                : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]',
            ].join(' ')}>
              <p className="font-semibold">{uploadResult.message}</p>
              {uploadResult.row_errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {uploadResult.row_errors.slice(0, 5).map((err) => (
                    <li key={err.row}>Row {err.row}: {err.errors[0]}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function ExamManagementPage(): React.JSX.Element {
  const { staffUser, role } = useAuth();
  const [exams,          setExams]          = useState<ExamRecord[]>([]);
  const [classes,        setClasses]        = useState<ClassLevel[]>([]);
  const [departments,    setDepartments]    = useState<Department[]>([]);
  const [isLoading,      setIsLoading]      = useState<boolean>(true);
  const [error,          setError]          = useState<string | null>(null);
  const [showModal,      setShowModal]      = useState<boolean>(false);
  const [editingExam,    setEditingExam]    = useState<ExamRecord | undefined>(undefined);
  const [deleteTarget,   setDeleteTarget]   = useState<ExamRecord | null>(null);
  const [isDeleting,     setIsDeleting]     = useState<boolean>(false);
  const [expandedExamId, setExpandedExamId] = useState<number | null>(null);
  const [toggling,       setToggling]       = useState<number | null>(null);
  const [toast,          setToast]          = useState<Toast | null>(null);
  const [activePeriod,   setActivePeriod]   = useState<ActivePeriod | null>(null);
  const [periodLoading,  setPeriodLoading]  = useState<boolean>(true);

  useEffect((): void => {
    const fetch = async (): Promise<void> => {
      setPeriodLoading(true);
      try {
        const res = await axiosInstance.get<ActivePeriodResponse>('/api/settings/active-period');
        if (res.data.success) {
          setActivePeriod({
            display       : res.data.display,
            active_session: res.data.active_session,
            active_term   : res.data.active_term,
            term_label    : res.data.term_label,
          });
        }
      } catch { /* non-fatal */ } finally {
        setPeriodLoading(false);
      }
    };
    void fetch();
  }, []);

  const fetchExams = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get<ExamListResponse>('/api/teacher/exams');
      if (res.data.success) setExams(res.data.exams);
    } catch {
      setError('Failed to load exams. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLookups = useCallback(async (): Promise<void> => {
    try {
      const [clsRes, deptRes] = await Promise.all([
        axiosInstance.get<ClassListResponse>('/api/shared/classes'),
        axiosInstance.get<DeptListResponse>('/api/shared/departments'),
      ]);
      if (clsRes.data.success)  setClasses(clsRes.data.classes);
      if (deptRes.data.success) setDepartments(deptRes.data.departments);
    } catch { /* non-fatal */ }
  }, []);

  useEffect((): void => { void fetchExams(); void fetchLookups(); }, [fetchExams, fetchLookups]);

  const handleToggle = async (exam: ExamRecord): Promise<void> => {
    setToggling(exam.exam_id);
    try {
      const res = await axiosInstance.put<ToggleResponse>(`/api/teacher/exams/${exam.exam_id}/toggle`);
      if (res.data.success) {
        setExams((prev) => prev.map((e) =>
          e.exam_id === exam.exam_id ? { ...e, is_active: res.data.exam.is_active } : e
        ));
        setToast({ type: 'success', message: `"${exam.exam_title}" is now ${res.data.exam.is_active ? 'LIVE' : 'inactive'}.` });
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setToast({ type: 'error', message: err.response?.data?.message ?? 'Failed to toggle exam status.' });
      } else {
        setToast({ type: 'error', message: 'Failed to toggle exam status.' });
      }
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (deleteTarget === null) return;
    setIsDeleting(true);
    try {
      const res = await axiosInstance.delete<DeleteResponse>(`/api/teacher/exams/${deleteTarget.exam_id}`);
      if (res.data.success) {
        setExams((prev) => prev.filter((e) => e.exam_id !== deleteTarget.exam_id));
        setToast({ type: 'success', message: `"${deleteTarget.exam_title}" deleted.` });
        setDeleteTarget(null);
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setToast({ type: 'error', message: err.response?.data?.message ?? 'Delete failed.' });
      } else {
        setToast({ type: 'error', message: 'Delete failed.' });
      }
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExamSaved = (exam: ExamRecord, isEdit: boolean): void => {
    if (isEdit) {
      setExams((prev) => prev.map((e) => e.exam_id === exam.exam_id ? { ...e, ...exam } : e));
      setToast({ type: 'success', message: `"${exam.exam_title}" updated.` });
    } else {
      setExams((prev) => [{ ...exam, question_count: 0 }, ...prev]);
      setToast({ type: 'success', message: `"${exam.exam_title}" created. Add questions below.` });
      setExpandedExamId(exam.exam_id);
    }
    setShowModal(false);
    setEditingExam(undefined);
  };

  const handleQuestionAdded = (examId: number): void => {
    setExams((prev) => prev.map((e) =>
      e.exam_id === examId ? { ...e, question_count: e.question_count + 1 } : e
    ));
  };

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Exams & Question Banks
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            Create, manage, and toggle exam availability for your students.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {activePeriod !== null && (
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl">
              <Calendar size={14} className="text-[#15803D] flex-shrink-0" />
              <p className="text-[#15803D] text-sm font-semibold">
                {activePeriod.display}
              </p>
            </div>
          )}
          <button
            type      = "button"
            onClick   = {() => void fetchExams()}
            disabled  = {isLoading}
            className = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type      = "button"
            onClick   = {() => { setEditingExam(undefined); setShowModal(true); }}
            className = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors"
          >
            <Plus size={16} />
            New Exam
          </button>
        </div>
      </div>

      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <p className="text-[#991B1B] text-base font-semibold">{error}</p>
        </div>
      )}

      <div className="space-y-3">

        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-[#D7F2E0] rounded-2xl p-5 animate-pulse h-24" />
        ))}

        {!isLoading && exams.length === 0 && error === null && (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-[#D7F2E0] rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-5">
              <ClipboardList size={28} className="text-[#6B8479]" />
            </div>
            <p className="text-[#0B1F14] text-lg font-bold">No exams yet</p>
            <p className="text-[#6B8479] text-base mt-1.5 max-w-xs leading-relaxed">
              Create your first exam to begin building question banks.
            </p>
            <button
              type      = "button"
              onClick   = {() => setShowModal(true)}
              className = "mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14] text-base font-bold transition-colors"
            >
              <Plus size={17} />
              Create First Exam
            </button>
          </div>
        )}

        {!isLoading && exams.map((exam) => {
          const isExpanded = expandedExamId === exam.exam_id;
          return (
            <div
              key       = {exam.exam_id}
              id        = {`exam-row-${exam.exam_id}`}
              className = {[
                'bg-white border-2 rounded-2xl overflow-hidden transition-all duration-200',
                exam.is_active
                  ? 'border-[#4AE17A]'
                  : 'border-[#D7F2E0]',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 px-5 py-4">

                <button
                  type      = "button"
                  onClick   = {() => setExpandedExamId(isExpanded ? null : exam.exam_id)}
                  className = "p-1.5 rounded-lg text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE] transition-colors flex-shrink-0"
                >
                  <ChevronRight
                    size      = {17}
                    className = {`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>

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
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#4AE17A] text-[#15803D] text-sm font-semibold">
                        <Zap size={11} />
                        LIVE
                      </span>
                    )}
                    <EvalTypeBadge type={exam.evaluation_type} />
                    <SessionTermLabel session={exam.academic_session} term={exam.term} />
                  </div>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[#6B8479] text-sm">{exam.subject_name}</span>
                    <span className="text-[#D7F2E0] text-sm">·</span>
                    <span className="text-[#6B8479] text-sm">{exam.class_name}</span>
                    <span className="text-[#D7F2E0] text-sm">·</span>
                    <span className="text-[#6B8479] text-sm">{exam.department_name}</span>
                    <span className="text-[#D7F2E0] text-sm">·</span>
                    <div className="flex items-center gap-1 text-[#6B8479] text-sm">
                      <Clock size={12} />
                      {formatDuration(exam.duration_minutes)}
                    </div>
                    <span className="text-[#D7F2E0] text-sm">·</span>
                    <span className="text-[#6B8479] text-sm">
                      {exam.question_count}/{exam.total_questions_to_show} Q
                    </span>
                    {exam.max_raw_mark !== null && exam.max_raw_mark !== undefined && (
                      <>
                        <span className="text-[#D7F2E0] text-sm">·</span>
                        <span className="text-[#6B8479] text-sm">/{exam.max_raw_mark} marks</span>
                      </>
                    )}
                    <span className="text-[#D7F2E0] text-sm">·</span>
                    <span className="text-[#6B8479] text-sm">by {exam.created_by_username}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type      = "button"
                    onClick   = {() => void handleToggle(exam)}
                    disabled  = {toggling === exam.exam_id}
                    title     = {exam.is_active ? 'Deactivate exam' : 'Go live'}
                    className = "p-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {exam.is_active
                      ? <ToggleRight size={24} className="text-[#4AE17A]" />
                      : <ToggleLeft  size={24} className="text-[#6B8479]" />
                    }
                  </button>

                  {(() => {
                    // Edit/Delete deliberately stay creator-only (or
                    // Admin/Super Admin) even though viewing and adding
                    // questions is now shared with every teacher assigned
                    // to the subject — see teacherController.js for why.
                    const isOwnerOrAdmin = role !== 'teacher' || staffUser?.id === exam.created_by;
                    const editTitle = exam.is_active
                      ? 'Deactivate to edit'
                      : isOwnerOrAdmin
                      ? 'Edit exam'
                      : `Only ${exam.created_by_username} can edit this exam`;
                    const deleteTitle = exam.is_active
                      ? 'Deactivate to delete'
                      : isOwnerOrAdmin
                      ? 'Delete exam'
                      : `Only ${exam.created_by_username} can delete this exam`;
                    return (
                      <>
                        <button
                          type      = "button"
                          onClick   = {() => { setEditingExam(exam); setShowModal(true); }}
                          disabled  = {exam.is_active || !isOwnerOrAdmin}
                          title     = {editTitle}
                          className = "p-1.5 rounded-lg text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Edit3 size={16} />
                        </button>

                        <button
                          type      = "button"
                          onClick   = {() => setDeleteTarget(exam)}
                          disabled  = {exam.is_active || !isOwnerOrAdmin}
                          title     = {deleteTitle}
                          className = "p-1.5 rounded-lg text-[#6B8479] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>

              {isExpanded && (
                <QuestionBankPanel
                  exam            = {exam}
                  onQuestionAdded = {handleQuestionAdded}
                />
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <ExamModal
          classes          = {classes}
          departments      = {departments}
          editingExam      = {editingExam}
          activePeriod     = {activePeriod}
          periodLoading    = {periodLoading}
          onClose          = {() => { setShowModal(false); setEditingExam(undefined); }}
          onSaved          = {handleExamSaved}
          onNavigateToExam = {(examId) => {
            setShowModal(false);
            setEditingExam(undefined);
            setExpandedExamId(examId);
            setTimeout(() => {
              document.getElementById(`exam-row-${examId}`)?.scrollIntoView({
                behavior: 'smooth',
                block   : 'center',
              });
            }, 100);
          }}
        />
      )}

      {deleteTarget !== null && (
        <ConfirmDialog
          title        = {`Delete "${deleteTarget.exam_title}"?`}
          message      = {`This will permanently delete the exam and its ${deleteTarget.question_count} question(s). This cannot be undone. Deletion is blocked if student results exist for this exam.`}
          confirmLabel = "Delete Exam"
          isLoading    = {isDeleting}
          onConfirm    = {() => void handleDelete()}
          onCancel     = {() => setDeleteTarget(null)}
        />
      )}

      {toast !== null && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}