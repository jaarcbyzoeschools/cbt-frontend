// ================================================================
//  CBT SYSTEM — GRADE ENTRY PAGE
//  File    : src/pages/teacher/GradeEntryPage.tsx
//  Design  : Vibrant Institutional Light Mode (matches existing pages)
//
//  New page — closes the last gap in the three-component grading
//  work: the backend (submitOtherScore, submitTestScore,
//  getGradeEntrySheet) existed with nothing rendering it. This is
//  that screen.
//
//  Role behavior:
//    - Plain teacher: subject picker restricted to their own
//      assigned subjects (GET /api/teacher/my-subjects), matching
//      every other subject-scoped screen in this app.
//    - Admin/Super Admin: unrestricted Class -> Department ->
//      Subject cascade, matching the backend's unrestricted access
//      for these roles.
//
//  Per student row:
//    - Exam (terminal): always read-only, CBT only, shown for
//      context -- there is no manual fallback for Exam, only Test.
//    - Test (midterm): read-only "72% (from CBT)" if a real CBT
//      result exists (test_is_locked); otherwise an editable input
//      -- manual entry only ever fills the gap, never overrides a
//      real CBT result.
//    - Other: always editable -- no CBT path exists for this
//      component at all.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useState,
}                        from 'react';
import {
  PenLine,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  Lock,
  Calendar,
  Users,
  X,
  Save,
}                        from 'lucide-react';

import axiosInstance               from '../../api/axiosInstance';
import { useAuth }                 from '../../context/AuthContext';
import { useCurriculumConstraint } from '../../hooks/useCurriculumConstraint';
import type {
  ClassLevel,
  Department,
  Subject,
  TeacherSubjectAssignment,
}                                  from '../../types/exam';


interface GradeEntryStudent {
  student_id             : number;
  full_name              : string;
  login_pin              : string;
  cbt_test_percentage    : number | null;
  cbt_exam_percentage    : number | null;
  manual_test_percentage : number | null;
  other_percentage       : number | null;
  test_is_locked         : boolean;
  is_excluded            : boolean
}

interface GradeEntrySheetResponse {
  success : boolean;
  subject : { id: number; name: string };
  count   : number;
  students: GradeEntryStudent[];
}

interface MySubjectsResponse   { success: boolean; subjects: TeacherSubjectAssignment[] }
interface ClassListResponse    { success: boolean; classes: ClassLevel[] }
interface DeptListResponse     { success: boolean; departments: Department[] }
interface SubjectListResponse  { success: boolean; subjects: Subject[] }
interface ActivePeriodResponse {
  success       : boolean;
  display       : string;
  active_session: string;
  active_term   : number;
  term_label    : string;
}
interface SaveScoreResponse {
  success: boolean;
  message: string;
  entry  : { id: number; score_percentage: number; entered_at: string };
}

interface Toast { type: 'success' | 'error'; message: string }


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


function ScoreCell({
  value,
  maxMark,
  locked,
  lockedNote,
  onSave,
}: {
  value      : number | null;  // percentage (0-100), as stored/returned by the backend
  maxMark    : number;         // the raw-mark ceiling this cell represents (30 for Test, 10 for Other)
  locked     : boolean;
  lockedNote?: string;
  onSave     : (newPercentage: number) => Promise<void>;  // still sends a PERCENTAGE to the backend
}): React.JSX.Element {
  const toRaw = (pct: number | null): number | null =>
    pct !== null ? Math.round(((pct / 100) * maxMark) * 10) / 10 : null;

  const rawValue = toRaw(value);
  const [draft,      setDraft]      = useState<string>(rawValue !== null ? String(rawValue) : '');
  const [isSaving,   setIsSaving]   = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect((): void => {
    const rv = toRaw(value);
    setDraft(rv !== null ? String(rv) : '');
  }, [value, maxMark]); // eslint-disable-line react-hooks/exhaustive-deps

  if (locked) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#F4FBF6] border border-[#D7F2E0] rounded-lg">
        <Lock size={11} className="text-[#6B8479] flex-shrink-0" />
        <span className="text-[#3D5347] text-sm font-semibold tabular-nums">
          {rawValue !== null ? `${rawValue}/${maxMark}` : '\u2014'}
        </span>
        {lockedNote !== undefined && (
          <span className="text-[#6B8479] text-xs">{lockedNote}</span>
        )}
      </div>
    );
  }

  const isDirty = draft !== (rawValue !== null ? String(rawValue) : '');

  const handleSave = async (): Promise<void> => {
    const parsedRaw = parseFloat(draft);
    if (isNaN(parsedRaw) || parsedRaw < 0 || parsedRaw > maxMark) {
      setLocalError(`0\u2013${maxMark} only`);
      return;
    }
    setLocalError(null);
    setIsSaving(true);
    try {
      const percentage = (parsedRaw / maxMark) * 100;
      await onSave(percentage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1">
        <input
          type        = "number"
          min         = {0}
          max         = {maxMark}
          step        = {0.5}
          value       = {draft}
          onChange    = {(e) => { setDraft(e.target.value); setLocalError(null); }}
          onKeyDown   = {(e) => { if (e.key === 'Enter' && isDirty) void handleSave(); }}
          disabled    = {isSaving}
          placeholder = {`out of ${maxMark}`}
          className   = {[
            'w-16 bg-white border-2 rounded-lg px-2 py-1.5 text-sm text-[#0B1F14]',
            'focus:outline-none transition-all disabled:opacity-50',
            localError !== null
              ? 'border-[#FCA5A5] focus:border-[#991B1B]'
              : 'border-[#D7F2E0] focus:border-[#4AE17A]',
          ].join(' ')}
        />
        <span className="text-[#6B8479] text-sm flex-shrink-0">/ {maxMark}</span>
      </div>
      <button
        type      = "button"
        onClick   = {() => void handleSave()}
        disabled  = {isSaving || !isDirty || draft === ''}
        title     = "Save"
        className = "p-1.5 rounded-lg text-[#15803D] hover:bg-[#E7FBEE] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
      >
        {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
      </button>
      {localError !== null && (
        <span className="text-[#991B1B] text-xs whitespace-nowrap">{localError}</span>
      )}
    </div>
  );
}



export default function GradeEntryPage(): React.JSX.Element {
  const { role } = useAuth();
  const isRestrictedTeacher = role === 'teacher';

  const [activePeriod,    setActivePeriod]    = useState<{ session: string; term: number; display: string } | null>(null);
  const [periodLoading,   setPeriodLoading]   = useState<boolean>(true);

  const [mySubjects,       setMySubjects]       = useState<TeacherSubjectAssignment[]>([]);
  const [mySubjectsLoaded, setMySubjectsLoaded] = useState<boolean>(false);
  const [classes,          setClasses]          = useState<ClassLevel[]>([]);
  const [departments,      setDepartments]      = useState<Department[]>([]);
  const [cascadeSubjects,  setCascadeSubjects]  = useState<Subject[]>([]);
  const [classId,          setClassId]          = useState<string>('');
  const [deptId,           setDeptId]           = useState<string>('');
  const curriculum = useCurriculumConstraint(classId, classes, departments);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  const [sheet,        setSheet]        = useState<GradeEntrySheetResponse | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState<boolean>(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [sheetError,   setSheetError]   = useState<string | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      setPeriodLoading(true);
      try {
        const res = await axiosInstance.get<ActivePeriodResponse>('/api/settings/active-period');
        if (res.data.success) {
          setActivePeriod({
            session: res.data.active_session,
            term   : res.data.active_term,
            display: res.data.display,
          });
        }
      } catch { /* non-fatal */ } finally {
        setPeriodLoading(false);
      }
    };
    void load();
  }, []);

  useEffect((): void => {
    if (!isRestrictedTeacher) { setMySubjectsLoaded(true); return; }
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<MySubjectsResponse>('/api/teacher/my-subjects');
        if (res.data.success) setMySubjects(res.data.subjects);
      } catch {
        setMySubjects([]);
      } finally {
        setMySubjectsLoaded(true);
      }
    };
    void load();
  }, [isRestrictedTeacher]);

  useEffect((): void => {
    if (isRestrictedTeacher) return;
    const load = async (): Promise<void> => {
      try {
        const [clsRes, deptRes] = await Promise.all([
          axiosInstance.get<ClassListResponse>('/api/shared/classes'),
          axiosInstance.get<DeptListResponse>('/api/shared/departments'),
        ]);
        if (clsRes.data.success)  setClasses(clsRes.data.classes);
        if (deptRes.data.success) setDepartments(deptRes.data.departments);
      } catch { /* non-fatal */ }
    };
    void load();
  }, [isRestrictedTeacher]);

  useEffect(() => {
    if (isRestrictedTeacher) return;
    const resolvedDept = curriculum.isDepartmentLocked ? curriculum.effectiveDeptId : deptId;
    if (!classId || !resolvedDept) { setCascadeSubjects([]); return; }
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<SubjectListResponse>(
          `/api/shared/subjects?class_id=${classId}&department_id=${resolvedDept}`
        );
        if (!cancelled && res.data.success) setCascadeSubjects(res.data.subjects);
      } catch {
        if (!cancelled) setCascadeSubjects([]);
      }
    };
    void load();
    return (): void => { cancelled = true; };
  }, [isRestrictedTeacher, classId, deptId, curriculum.isDepartmentLocked, curriculum.effectiveDeptId]);

  const fetchSheet = useCallback(async (): Promise<void> => {
    if (!selectedSubjectId || activePeriod === null) return;
    setIsLoadingSheet(true);
    setSheetError(null);
    try {
      const res = await axiosInstance.get<GradeEntrySheetResponse>(
        `/api/teacher/report-cards/grade-entry-sheet` +
        `?subject_id=${selectedSubjectId}` +
        `&academic_session=${encodeURIComponent(activePeriod.session)}` +
        `&term=${activePeriod.term}`
      );
      if (res.data.success) setSheet(res.data);
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setSheetError(err.response?.data?.message ?? 'Failed to load the grade entry sheet.');
      } else {
        setSheetError('Failed to load the grade entry sheet.');
      }
      setSheet(null);
    } finally {
      setIsLoadingSheet(false);
    }
  }, [selectedSubjectId, activePeriod]);

  useEffect((): void => { void fetchSheet(); }, [fetchSheet]);

  const saveScore = async (
    endpoint  : 'test-score' | 'other-score',
    studentId : number,
    scoreValue: number
  ): Promise<void> => {
    if (activePeriod === null) return;
    try {
      const res = await axiosInstance.post<SaveScoreResponse>(
        `/api/teacher/report-cards/${endpoint}`,
        {
          student_id      : studentId,
          subject_id      : Number(selectedSubjectId),
          academic_session: activePeriod.session,
          term            : activePeriod.term,
          score_percentage: scoreValue,
        }
      );
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        void fetchSheet();
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setToast({ type: 'error', message: err.response?.data?.message ?? 'Failed to save score.' });
      } else {
        setToast({ type: 'error', message: 'Failed to save score.' });
      }
      throw thrown;
    }
  };

  const handleToggleExclusion = async (
  studentId: number,
  subjectId: number,
  currentlyExcluded: boolean
): Promise<void> => {
  setTogglingId(studentId);
  setSheetError(null);

  try {
    await axiosInstance.post(
      '/api/teacher/report-cards/toggle-subject-exclusion',
      {
        student_id: studentId,
        subject_id: subjectId,
        academic_session: activePeriod?.session,
        term: activePeriod?.term,
        excluded: !currentlyExcluded,
      }
    );

    await fetchSheet();
  } catch {
    setSheetError(
      'Failed to update subject exclusion for this student.'
    );
  } finally {
    setTogglingId(null);
  }
};

  const noAssignedSubjects = isRestrictedTeacher && mySubjectsLoaded && mySubjects.length === 0;

  const selCls = [
    'w-full appearance-none bg-white border-2 border-[#D7F2E0] rounded-xl px-4 py-3',
    'text-base text-[#0B1F14] focus:outline-none focus:border-[#4AE17A] transition-all',
    'cursor-pointer pr-11 disabled:opacity-50',
  ].join(' ');


  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Enter Grades
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            Enter Test scores for subjects with no CBT sitting, and the Other (10%) component for every student.
          </p>
        </div>
        {activePeriod !== null && (
          <div className="flex items-center gap-2 px-3.5 py-2 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl">
            <Calendar size={14} className="text-[#15803D] flex-shrink-0" />
            <p className="text-[#15803D] text-sm font-semibold">{activePeriod.display}</p>
          </div>
        )}
      </div>

      {!periodLoading && activePeriod === null && (
        <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#92400E] flex-shrink-0 mt-0.5" />
          <p className="text-[#92400E] text-base">
            No active academic period is set — grade entry is unavailable until a Super Admin sets one.
          </p>
        </div>
      )}

      <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-5">
        <label className="block text-[#3D5347] text-base font-semibold mb-3">
          Select a Subject
        </label>

        {noAssignedSubjects ? (
          <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-[#92400E] flex-shrink-0 mt-0.5" />
            <p className="text-[#92400E] text-sm leading-relaxed">
              You have no subjects assigned yet. Ask your admin to assign you at least one subject.
            </p>
          </div>
        ) : isRestrictedTeacher ? (
          <div className="relative max-w-md">
            <select
              value     = {selectedSubjectId}
              onChange  = {(e) => setSelectedSubjectId(e.target.value)}
              disabled  = {!mySubjectsLoaded}
              className = {selCls}
            >
              <option value="" disabled>
                {!mySubjectsLoaded ? 'Loading…' : 'Choose a subject…'}
              </option>
              {mySubjects.map((s) => (
                <option key={s.subject_id} value={String(s.subject_id)}>
                  {s.class_name} · {s.subject_name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <select
                value     = {classId}
                onChange  = {(e) => { setClassId(e.target.value); setDeptId(''); setSelectedSubjectId(''); }}
                className = {selCls}
              >
                <option value="" disabled>Select class…</option>
                {classes.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value     = {curriculum.effectiveDeptId || deptId}
                onChange  = {(e) => { curriculum.setDeptId(e.target.value); setDeptId(e.target.value); setSelectedSubjectId(''); }}
                disabled  = {curriculum.isDepartmentLocked}
                className = {`${selCls} ${curriculum.isDepartmentLocked ? 'bg-[#FFFBEB] border-[#FCD34D]' : ''}`}
              >
                <option value="" disabled>
                  {curriculum.isDepartmentLocked ? 'General (auto-assigned)' : 'Select department…'}
                </option>
                {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value     = {selectedSubjectId}
                onChange  = {(e) => setSelectedSubjectId(e.target.value)}
                disabled  = {cascadeSubjects.length === 0}
                className = {selCls}
              >
                <option value="" disabled>
                  {cascadeSubjects.length === 0 ? 'Select class & dept first' : 'Select subject…'}
                </option>
                {cascadeSubjects.map((s) => (
                  <option key={s.subject_id} value={String(s.subject_id)}>{s.subject_name}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {sheetError !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#991B1B] text-base font-semibold">{sheetError}</p>
            <button
              type      = "button"
              onClick   = {() => void fetchSheet()}
              className = "text-[#991B1B] text-sm underline mt-1 hover:opacity-80"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {selectedSubjectId !== '' && (
        <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
            <div className="flex items-center gap-3">
              <Users size={17} className="text-[#3D5347]" />
              <h2 className="text-[#0B1F14] text-base font-bold">
                {sheet !== null ? sheet.subject.name : 'Roster'}
              </h2>
              {sheet !== null && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                  {sheet.count} students
                </span>
              )}
            </div>
            <button
              type      = "button"
              onClick   = {() => void fetchSheet()}
              disabled  = {isLoadingSheet}
              className = "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoadingSheet ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {isLoadingSheet && (
            <div className="divide-y divide-[#F4FBF6]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-[#F4FBF6] flex-shrink-0" />
                  <div className="flex-1 h-4 bg-[#F4FBF6] rounded w-1/3" />
                  <div className="h-8 w-24 bg-[#F4FBF6] rounded-lg" />
                  <div className="h-8 w-24 bg-[#F4FBF6] rounded-lg" />
                  <div className="h-8 w-24 bg-[#F4FBF6] rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {!isLoadingSheet && sheet !== null && sheet.students.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <p className="text-[#0B1F14] text-base font-bold">No students found</p>
              <p className="text-[#6B8479] text-sm mt-1">No active students are enrolled in this subject yet.</p>
            </div>
          )}

          {!isLoadingSheet && sheet !== null && sheet.students.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#D7F2E0]">
                    {['Student', 'Exam (CBT only, /60)', 'Test (/30)', 'Other (/10)'].map((h) => (
                      <th
                        key       = {h}
                        className = "text-left px-5 py-3.5 text-[#3D5347] font-semibold text-sm uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.students.map((student, i) => {
                    const isEven = i % 2 === 0;
                    return (
                      <tr
                        key       = {student.student_id}
                        className = {`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors ${isEven ? 'bg-white' : 'bg-[#F4FBF6]'}`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="min-w-0">
                            <p className="text-[#0B1F14] text-base font-semibold truncate max-w-[180px]">
                              {student.full_name}
                            </p>
                            <p className="text-[#6B8479] text-sm font-mono">{student.login_pin}</p>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#F4FBF6] border border-[#D7F2E0] rounded-lg w-fit">
                            <Lock size={11} className="text-[#6B8479] flex-shrink-0" />
                            <span className="text-[#3D5347] text-sm font-semibold tabular-nums">
                              {student.cbt_exam_percentage !== null
                                ? `${Math.round((student.cbt_exam_percentage / 100) * 60 * 10) / 10}/60`
                                : '\u2014'}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <ScoreCell
                            value      = {student.test_is_locked ? student.cbt_test_percentage : student.manual_test_percentage}
                            maxMark    = {30}
                            locked     = {student.test_is_locked}
                            lockedNote = "from CBT"
                            onSave     = {(v) => saveScore('test-score', student.student_id, v)}
                          />
                        </td>

                        <td className="px-5 py-3.5">
                          <ScoreCell
                            value      = {student.other_percentage}
                            maxMark    = {10}
                            locked     = {false}
                            onSave     = {(v) => saveScore('other-score', student.student_id, v)}
                          />
                        </td>
                        <td className="px-5 py-3.5">
  <div className="flex items-center justify-between gap-3 min-w-[280px]">
    <div className="min-w-0">
      <p className="text-[#0B1F14] text-base font-semibold truncate max-w-[180px]">
        {student.full_name}
      </p>

      <p className="text-[#6B8479] text-sm font-mono">
        {student.login_pin}
      </p>
    </div>

    <button
      type="button"
      onClick={() =>
        void handleToggleExclusion(
          student.student_id,
          Number(selectedSubjectId),
          student.is_excluded
        )
      }
      disabled={togglingId === student.student_id}
      className={[
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0',
        student.is_excluded
          ? 'text-[#92400E] bg-[#FFFBEB] border border-[#FCD34D] hover:bg-[#FEF3C7]'
          : 'text-[#6B8479] bg-white border border-[#D7F2E0] hover:border-[#FCD34D]',
      ].join(' ')}
    >
      {togglingId === student.student_id ? (
        <Loader2 size={12} className="animate-spin" />
      ) : null}

      {student.is_excluded
        ? 'Excluded — tap to include'
        : 'Exclude subject'}
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
      )}

      {selectedSubjectId === '' && !noAssignedSubjects && (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-[#D7F2E0] rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-5">
            <PenLine size={28} className="text-[#6B8479]" />
          </div>
          <p className="text-[#0B1F14] text-lg font-bold">Select a subject above</p>
          <p className="text-[#6B8479] text-base mt-1 max-w-xs text-center">
            Your class roster will appear here, ready for grade entry.
          </p>
        </div>
      )}

      {toast !== null && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}