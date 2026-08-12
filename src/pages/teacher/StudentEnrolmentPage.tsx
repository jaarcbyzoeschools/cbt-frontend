// ================================================================
//  CBT SYSTEM — STUDENT ENROLMENT PAGE
//  File    : src/pages/teacher/StudentEnrolmentPage.tsx
//  Design  : Vibrant Institutional Light Mode
//
//  Addition: "My Subjects" and "My Class" sections, visible only
//  to role === 'teacher', placed above the existing Enrolment
//  panel. Reuses this file's existing ToastNotification/toast
//  state and StatusBadge rather than introducing duplicates.
//    — My Subjects : every subject the teacher is assigned to,
//                    expandable to show students offering it.
//    — My Class    : if the teacher is a class teacher, their full
//                    homeroom roster — activate/suspend scoped to
//                    their own classroom, plus report card viewing.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
}                       from 'react';
import {
  GraduationCap,
  Plus,
  Upload,
  Camera,
  Download,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  UserX,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  EyeOff,
  BarChart3,
  BookOpen,
  FileText,
  Star,
  Save,
  Lock,
}                       from 'lucide-react';

import axiosInstance               from '../../api/axiosInstance';
import type {
  ClassLevel,
  Department,
  StudentRecord,
  TeacherSubjectAssignment,
  SubjectStudent,
  MyClassTeacherAssignmentResponse,
  MyClassRosterStudent,
  ClassArm,
}                                  from '../../types/exam';
import { maskPin }                 from '../../utils/pinFormatter';
import { useCurriculumConstraint } from '../../hooks/useCurriculumConstraint';
import { useBranchContext }        from '../../../components/layout/StaffSidebar';
import { useAuth }                 from '../../context/AuthContext';
import StudentResultModal          from './StudentResultModal';


// ================================================================
//  TYPES
// ================================================================

interface ClassListResponse    { success: boolean; classes    : ClassLevel[]   }
interface DeptListResponse     { success: boolean; departments: Department[]   }
interface ArmListResponse      { success: boolean; arms: ClassArm[] }

// Shared across every place a student's extended profile shows up
// (admin table, class-teacher roster, detail modal, update payload)
// — defined once here instead of repeated per-type. All optional:
// types/exam.ts's base types may not yet declare any of this, and
// every field here is genuinely optional data a school may not have
// on file yet.
interface ExtendedProfileFields {
  gender?                : string | null;
  residential_address?   : string | null;
  mother_name?           : string | null;
  father_name?           : string | null;
  admission_number?      : string | null;
  photo_path?            : string | null;
  father_phone?          : string | null;
  mother_phone?          : string | null;
  guardian_name?         : string | null;
  guardian_relationship? : string | null;
  guardian_phone?        : string | null;
  date_of_birth?         : string | null;
  state_of_origin?       : string | null;
  lga?                   : string | null;
  blood_group?           : string | null;
  genotype?              : string | null;
  previous_school?       : string | null;
  date_joined?           : string | null;
}

// Locally extended — types/exam.ts's StudentRecord may not yet
// declare the new profile fields; the backend already returns them
// (listStudents was updated), so this keeps the frontend type-safe
// without editing a file not available in this session.
type StudentRecordExtended = StudentRecord & ExtendedProfileFields;

interface StudentListResponse  { success: boolean; count: number; students: StudentRecordExtended[] }
interface CreateStudentResponse {
  success: boolean;
  message: string;
  student: StudentRecord & { login_pin: string };
}
interface BulkUploadResponse {
  success          : boolean;
  message          : string;
  inserted_count   : number;
  error_count      : number;
  inserted_students: Array<{ id: number; full_name: string; login_pin: string }>;
  row_errors       : Array<{ row: number; full_name: string; errors: string[] }>;
}
interface UploadSummary {
  inserted_count   : number;
  error_count      : number;
  inserted_students: Array<{ id: number; full_name: string; login_pin: string }>;
  row_errors       : Array<{ row: number; full_name: string; errors: string[] }>;
}
interface Toast     { type: 'success' | 'error'; message: string }
type ActiveMode = 'manual' | 'bulk';

interface MySubjectsResponse    { success: boolean; subjects: TeacherSubjectAssignment[] }
interface SubjectStudentsResponse { success: boolean; students: SubjectStudent[] }
interface MyClassRosterResponse { success: boolean; students: MyClassRosterStudent[] }
interface ReportCardEntry {
  subject_name : string;
  ca_score     : number | null;
  ca_max       : number | null;
  exam_score   : number | null;
  exam_max     : number | null;
  other_score  : number | null;
  other_max    : number | null;
  total_score  : number | null;
  grade        : string | null;
  remark       : string | null;
  is_pending   : boolean;
}
interface ReportCardResponse {
  success: boolean;
  entries: ReportCardEntry[];
  summary: {
    attendance_present?: number;
    attendance_absent?  : number;
    class_teacher_comment?: string | null;
    principal_comment?    : string | null;
  } | null;
}
interface ActivePeriodResponse {
  success: boolean; active_session: string; active_term: number;
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
    const t = setTimeout(onDismiss, 5000);
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
//  MY CLASS — REPORT CARD MODAL
// ================================================================

function MyClassReportCardModal({
  studentId,
  studentName,
  onClose,
}: {
  studentId  : number;
  studentName: string;
  onClose    : () => void;
}): React.JSX.Element {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error,     setError]     = useState<string | null>(null);
  const [entries,   setEntries]   = useState<ReportCardEntry[]>([]);
  const [summary,   setSummary]   = useState<ReportCardResponse['summary']>(null);
  const [periodLabel, setPeriodLabel] = useState<string>('');

  useEffect((): void => {
    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const periodRes = await axiosInstance.get<ActivePeriodResponse>('/api/settings/active-period');
        if (!periodRes.data.success) { setError('Could not determine the active academic period.'); return; }
        const { active_session, active_term } = periodRes.data;
        setPeriodLabel(`${active_session} · Term ${active_term}`);

        const res = await axiosInstance.get<ReportCardResponse>(
          `/api/teacher/my-class/students/${studentId}/report-card?academic_session=${encodeURIComponent(active_session)}&term=${active_term}`
        );
        if (res.data.success) {
          setEntries(res.data.entries);
          setSummary(res.data.summary);
        }
      } catch (thrown: unknown) {
        if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
          const err = thrown as { response?: { data?: { message?: string } } };
          setError(err.response?.data?.message ?? 'Failed to load report card.');
        } else {
          setError('Failed to load report card.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [studentId]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0B1F14]/50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
        <div className="w-full max-w-xl bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl my-4">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div>
              <h2 className="text-[#0B1F14] text-lg font-bold">{studentName}</h2>
              <p className="text-[#6B8479] text-sm">{periodLabel || 'Report Card'}</p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-[#6B8479]">
                <Loader2 size={18} className="animate-spin" /> Loading report card…
              </div>
            )}

            {!isLoading && error !== null && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                <p className="text-[#991B1B] text-sm">{error}</p>
              </div>
            )}

            {!isLoading && error === null && entries.length === 0 && (
              <p className="text-[#6B8479] text-base text-center py-10">
                No report card has been generated for this student yet this term.
              </p>
            )}

            {!isLoading && entries.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#D7F2E0]">
                        {['Subject', 'Test', 'Exam', 'Other', 'Total', 'Grade'].map((h) => (
                          <th key={h} className="text-left px-3 py-2 text-[#3D5347] font-semibold text-xs uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e, i) => (
                        <tr key={e.subject_name} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]'}>
                          <td className="px-3 py-2 text-[#0B1F14] font-medium">{e.subject_name}</td>
                          <td className="px-3 py-2 text-[#3D5347]">{e.ca_score ?? '—'}{e.ca_max !== null ? `/${e.ca_max}` : ''}</td>
                          <td className="px-3 py-2 text-[#3D5347]">{e.exam_score ?? '—'}{e.exam_max !== null ? `/${e.exam_max}` : ''}</td>
                          <td className="px-3 py-2 text-[#3D5347]">{e.other_score ?? '—'}{e.other_max !== null ? `/${e.other_max}` : ''}</td>
                          <td className="px-3 py-2 text-[#0B1F14] font-bold">
                            {e.is_pending ? (
                              <span className="text-[#92400E] text-xs font-semibold">Pending</span>
                            ) : (
                              e.total_score ?? '—'
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {e.is_pending ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E] text-xs font-bold">
                                Pending
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-xs font-bold">
                                {e.grade ?? '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {summary !== null && (
                  <div className="mt-5 space-y-3 border-t border-[#D7F2E0] pt-4">
                    {(summary.attendance_present !== undefined || summary.attendance_absent !== undefined) && (
                      <p className="text-[#3D5347] text-sm">
                        <span className="font-semibold">Attendance:</span>{' '}
                        {summary.attendance_present ?? '—'} present · {summary.attendance_absent ?? '—'} absent
                      </p>
                    )}
                    {summary.class_teacher_comment && (
                      <p className="text-[#3D5347] text-sm"><span className="font-semibold">Class Teacher's comment:</span> {summary.class_teacher_comment}</p>
                    )}
                    {summary.principal_comment && (
                      <p className="text-[#3D5347] text-sm"><span className="font-semibold">Principal's comment:</span> {summary.principal_comment}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}


// ================================================================
//  MY SUBJECTS PANEL
// ================================================================

function MySubjectsPanel({ onToast }: { onToast: (t: Toast) => void }): React.JSX.Element {
  const [subjects,   setSubjects]   = useState<TeacherSubjectAssignment[]>([]);
  const [isLoading,  setIsLoading]  = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [students,   setStudents]   = useState<Record<number, SubjectStudent[]>>({});
  const [loadingStudents, setLoadingStudents] = useState<number | null>(null);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const res = await axiosInstance.get<MySubjectsResponse>('/api/teacher/my-subjects');
        if (res.data.success) setSubjects(res.data.subjects);
      } catch {
        onToast({ type: 'error', message: 'Failed to load your subject assignments.' });
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [onToast]);

  const toggleExpand = useCallback(async (subjectId: number): Promise<void> => {
    if (expandedId === subjectId) { setExpandedId(null); return; }
    setExpandedId(subjectId);
    if (students[subjectId] !== undefined) return;
    setLoadingStudents(subjectId);
    try {
      const res = await axiosInstance.get<SubjectStudentsResponse>(
        `/api/teacher/subjects/${subjectId}/students`
      );
      if (res.data.success) setStudents((prev) => ({ ...prev, [subjectId]: res.data.students }));
    } catch {
      onToast({ type: 'error', message: 'Failed to load students for this subject.' });
    } finally {
      setLoadingStudents(null);
    }
  }, [expandedId, students, onToast]);

  return (
    <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
        <BookOpen size={18} className="text-[#15803D]" />
        <h2 className="text-[#0B1F14] text-base font-bold">My Subjects</h2>
        {!isLoading && (
          <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
            {subjects.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="p-6"><Loader2 size={18} className="animate-spin text-[#6B8479]" /></div>
      ) : subjects.length === 0 ? (
        <p className="text-[#6B8479] text-base px-6 py-8 text-center">
          No subjects assigned yet. Ask your admin to assign you a subject.
        </p>
      ) : (
        <div className="divide-y divide-[#F4FBF6]">
          {subjects.map((s) => {
            const isExpanded = expandedId === s.subject_id;
            const list = students[s.subject_id];
            return (
              <div key={s.assignment_id}>
                <button
                  type="button"
                  onClick={() => void toggleExpand(s.subject_id)}
                  className="w-full flex items-center gap-3 px-6 py-3.5 text-left hover:bg-[#F4FBF6] transition-colors"
                >
                  <ChevronRight size={16} className={`text-[#6B8479] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <div className="flex-1">
                    <p className="text-[#0B1F14] text-base font-semibold">{s.subject_name}</p>
                    <p className="text-[#6B8479] text-sm">{s.class_name} · {s.department_name}</p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="bg-[#F4FBF6] px-6 py-4">
                    {loadingStudents === s.subject_id ? (
                      <div className="flex items-center gap-2 text-[#6B8479] text-sm"><Loader2 size={14} className="animate-spin" /> Loading students…</div>
                    ) : list === undefined || list.length === 0 ? (
                      <p className="text-[#6B8479] text-sm">No students found for this subject.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {list.map((st) => (
                          <div key={st.student_id} className="flex items-center gap-3 bg-white border border-[#D7F2E0] rounded-xl px-4 py-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
                              <span className="text-[#15803D] text-sm font-bold">{st.full_name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[#0B1F14] text-sm font-semibold truncate">{st.full_name}</p>
                              <p className="text-[#6B8479] text-xs">
                                {maskPin(st.login_pin)} · {st.class_name}{st.arm_name ?? ''} · {st.branch_name}
                              </p>
                            </div>
                            <StatusBadge active={st.is_active} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ================================================================
//  MY CLASS PANEL
// ================================================================

// Locally extended — same reasoning as StudentRecordExtended above:
// the backend endpoint powering this roster may not yet return the
// new profile fields (that update wasn't made to whichever
// controller powers /api/teacher/my-class/students — not available
// in this session to confirm/edit safely). Fields are optional here
// so the modal degrades gracefully to "not provided" rather than
// erroring if the backend genuinely doesn't send them yet.
type MyClassRosterStudentExtended = MyClassRosterStudent & ExtendedProfileFields;

function MyClassPanel({ onToast }: { onToast: (t: Toast) => void }): React.JSX.Element | null {
  const [isLoading,   setIsLoading]   = useState<boolean>(true);
  const [isClassTeacher, setIsClassTeacher] = useState<boolean>(false);
  const [classroomLabel, setClassroomLabel] = useState<string>('');
  const [roster,       setRoster]     = useState<MyClassRosterStudentExtended[]>([]);
  const [togglingId,   setTogglingId] = useState<number | null>(null);
  const [reportCardTarget, setReportCardTarget] = useState<MyClassRosterStudent | null>(null);
  const [selectedStudent,  setSelectedStudent]  = useState<MyClassRosterStudentExtended | null>(null);

  const fetchRoster = useCallback(async (): Promise<void> => {
    try {
      const res = await axiosInstance.get<MyClassRosterResponse>('/api/teacher/my-class/students');
      if (res.data.success) setRoster(res.data.students);
    } catch {
      onToast({ type: 'error', message: 'Failed to load your class roster.' });
    }
  }, [onToast]);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const res = await axiosInstance.get<MyClassTeacherAssignmentResponse>('/api/teacher/my-class');
        if (res.data.success && res.data.is_class_teacher && res.data.assignment !== null) {
          setIsClassTeacher(true);
          const a = res.data.assignment;
          setClassroomLabel(`${a.class_name}${a.arm_name} · ${a.department_name}`);
          await fetchRoster();
        }
      } catch {
        /* not a class teacher, or fetch failed — panel simply won't render */
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [fetchRoster]);

  const handleToggle = async (student: MyClassRosterStudent): Promise<void> => {
    setTogglingId(student.student_id);
    try {
      const action = student.is_active ? 'suspend' : 'reactivate';
      await axiosInstance.put(`/api/teacher/my-class/students/${student.student_id}/status`, { action });
      setRoster((prev) => prev.map((s) => s.student_id === student.student_id ? { ...s, is_active: !s.is_active } : s));
      onToast({ type: 'success', message: `${student.full_name} ${action === 'suspend' ? 'suspended' : 'reactivated'}.` });
    } catch {
      onToast({ type: 'error', message: 'Failed to update student status.' });
    } finally {
      setTogglingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-[#D7F2E0] rounded-2xl p-6">
        <Loader2 size={18} className="animate-spin text-[#6B8479]" />
      </div>
    );
  }

  if (!isClassTeacher) return null;

  return (
    <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#EFF6FF]">
        <Star size={18} className="text-[#0369A1]" />
        <div>
          <h2 className="text-[#0B1F14] text-base font-bold">My Class</h2>
          <p className="text-[#0369A1] text-sm">{classroomLabel}</p>
        </div>
        <span className="ml-auto px-2.5 py-0.5 rounded-full bg-white border border-[#BAE6FD] text-[#0369A1] text-sm font-semibold">
          {roster.length} students
        </span>
      </div>

      {roster.length === 0 ? (
        <p className="text-[#6B8479] text-base px-6 py-8 text-center">No students in this classroom yet.</p>
      ) : (
        <div className="divide-y divide-[#F4FBF6]">
          {roster.map((student, i) => (
            <div key={student.student_id} className={`flex items-center gap-3 px-6 py-3.5 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]'}`}>
              <button
                type      = "button"
                onClick   = {() => setSelectedStudent(student)}
                className = "flex items-center gap-3 text-left flex-1 min-w-0 group"
              >
                <div className="w-9 h-9 rounded-full bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {student.photo_path ? (
                    <img
                      src       = {`${axiosInstance.defaults.baseURL ?? ''}${student.photo_path}`}
                      alt       = {student.full_name}
                      className = "w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[#15803D] text-sm font-bold">{student.full_name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0B1F14] text-base font-semibold truncate group-hover:text-[#0369A1] group-hover:underline transition-colors">{student.full_name}</p>
                  <p className="text-[#6B8479] text-sm">{maskPin(student.login_pin)}</p>
                </div>
              </button>
              <StatusBadge active={student.is_active} />
              <button
                type="button"
                title="View report card"
                onClick={() => setReportCardTarget(student)}
                className="p-2 rounded-lg text-[#6B8479] hover:text-[#0369A1] hover:bg-[#EFF6FF] transition-colors flex-shrink-0"
              >
                <FileText size={16} />
              </button>
              <button
                type="button"
                title={student.is_active ? 'Suspend' : 'Reactivate'}
                onClick={() => void handleToggle(student)}
                disabled={togglingId === student.student_id}
                className={[
                  'p-2 rounded-lg transition-colors flex-shrink-0',
                  togglingId === student.student_id ? 'opacity-50 cursor-not-allowed' : '',
                  student.is_active
                    ? 'text-[#6B8479] hover:text-[#92400E] hover:bg-[#FFFBEB]'
                    : 'text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE]',
                ].join(' ')}
              >
                {togglingId === student.student_id
                  ? <Loader2 size={16} className="animate-spin" />
                  : <UserX size={16} />
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {reportCardTarget !== null && (
        <MyClassReportCardModal
          studentId  ={reportCardTarget.student_id}
          studentName={reportCardTarget.full_name}
          onClose    ={() => setReportCardTarget(null)}
        />
      )}

      {selectedStudent !== null && (
        <StudentDetailModal
          student = {{
            id       : selectedStudent.student_id,
            full_name: selectedStudent.full_name,
            login_pin: selectedStudent.login_pin,
            is_active: selectedStudent.is_active,
            arm_name : null,
            gender              : selectedStudent.gender,
            residential_address : selectedStudent.residential_address,
            mother_name         : selectedStudent.mother_name,
            father_name         : selectedStudent.father_name,
            admission_number    : selectedStudent.admission_number,
            photo_path          : selectedStudent.photo_path,
          }}
          onClose = {() => setSelectedStudent(null)}
          onSaved = {(updated) => {
            setRoster((prev) => prev.map((s) => s.student_id === updated.id ? { ...s, ...updated } : s));
            setSelectedStudent((prev) => prev !== null && prev.student_id === updated.id ? { ...prev, ...updated } : prev);
          }}
        />
      )}
    </div>
  );
}


// ================================================================
//  STUDENT DETAIL MODAL — NEW
//  Opens when a student's name is clicked. Shows every profile
//  field and lets it all be edited, including the photo. Does NOT
//  allow reassigning Class/Department/Arm/Branch — that's a
//  transfer operation with its own implications and belongs in a
//  dedicated promotion flow, not ad-hoc profile editing.
// ================================================================

interface DetailStudent extends ExtendedProfileFields {
  id                  : number;
  full_name           : string;
  login_pin           : string;
  is_active           : boolean;
  class_name?          : string | null;
  department_name?     : string | null;
  branch_name?         : string | null;
  arm_name?           : string | null;
}

interface UpdateStudentResponse {
  success: boolean;
  message: string;
  student: {
    id: number; full_name: string; gender: string | null;
    residential_address: string | null; mother_name: string | null;
    father_name: string | null; admission_number: string | null;
    photo_path: string | null;
    father_phone: string | null; mother_phone: string | null;
    guardian_name: string | null; guardian_relationship: string | null;
    guardian_phone: string | null; date_of_birth: string | null;
    state_of_origin: string | null; lga: string | null;
    blood_group: string | null; genotype: string | null;
    previous_school: string | null; date_joined: string | null;
  };
}

// What a save action can actually report back — only the profile
// fields this modal edits, never class_name/department_name/etc,
// which are read-only context and never part of an update. Keeping
// this narrow (rather than reusing Partial<DetailStudent>, whose
// context fields are typed nullable) is what avoids the type
// mismatch when merging into StudentRecordExtended/
// MyClassRosterStudentExtended below — those inherit non-nullable
// versions of those same field names from their base types.
interface StudentProfileUpdate extends ExtendedProfileFields {
  id        : number;
  full_name?: string;
}

function StudentDetailModal({
  student, onClose, onSaved,
}: {
  student : DetailStudent;
  onClose : () => void;
  onSaved : (updated: StudentProfileUpdate) => void;
}): React.JSX.Element {
  const { role } = useAuth();
  const canEditAdmissionNumber = role !== 'teacher';

  const [form, setForm] = useState({
    fullName          : student.full_name,
    gender            : student.gender ?? '',
    admissionNumber   : student.admission_number ?? '',
    fatherName        : student.father_name ?? '',
    motherName        : student.mother_name ?? '',
    residentialAddress: student.residential_address ?? '',
    fatherPhone       : student.father_phone ?? '',
    motherPhone       : student.mother_phone ?? '',
    guardianName      : student.guardian_name ?? '',
    guardianRelationship: student.guardian_relationship ?? '',
    guardianPhone     : student.guardian_phone ?? '',
    dateOfBirth       : student.date_of_birth ?? '',
    stateOfOrigin     : student.state_of_origin ?? '',
    lga               : student.lga ?? '',
    bloodGroup        : student.blood_group ?? '',
    genotype          : student.genotype ?? '',
    previousSchool    : student.previous_school ?? '',
    dateJoined        : student.date_joined ?? '',
  });
  const [photoPath,    setPhotoPath]    = useState<string | null>(student.photo_path ?? null);
  const [isSaving,     setIsSaving]     = useState<boolean>(false);
  const [isPhotoBusy,  setIsPhotoBusy]  = useState<boolean>(false);
  const [showPin,      setShowPin]      = useState<boolean>(false);
  const [error,        setError]        = useState<string | null>(null);
  const [successMsg,   setSuccessMsg]   = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect((): (() => void) => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return (): void => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await axiosInstance.put<UpdateStudentResponse>(
        `/api/teacher/students/${student.id}`,
        {
          full_name           : form.fullName.trim(),
          gender              : form.gender,
          father_name         : form.fatherName,
          mother_name         : form.motherName,
          residential_address : form.residentialAddress,
          father_phone          : form.fatherPhone,
          mother_phone          : form.motherPhone,
          guardian_name         : form.guardianName,
          guardian_relationship : form.guardianRelationship,
          guardian_phone        : form.guardianPhone,
          date_of_birth         : form.dateOfBirth || null,
          state_of_origin       : form.stateOfOrigin,
          lga                   : form.lga,
          blood_group           : form.bloodGroup,
          genotype              : form.genotype,
          previous_school       : form.previousSchool,
          date_joined           : form.dateJoined || null,
          ...(canEditAdmissionNumber && { admission_number: form.admissionNumber }),
        }
      );
      if (res.data.success) {
        setSuccessMsg('Saved.');
        onSaved(res.data.student);
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? 'Failed to save changes.');
      } else {
        setError('Failed to save changes.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (file === undefined) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG, or WEBP images are allowed.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB.');
      return;
    }

    setIsPhotoBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await axiosInstance.post<{ success: boolean; photo_path: string }>(
        `/api/media/students/${student.id}/photo`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (res.data.success) {
        setPhotoPath(res.data.photo_path);
        onSaved({ id: student.id, photo_path: res.data.photo_path });
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? 'Failed to upload photo.');
      } else {
        setError('Failed to upload photo.');
      }
    } finally {
      setIsPhotoBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const fieldCls = "w-full bg-white border-2 border-[#D7F2E0] rounded-xl px-3.5 py-2.5 text-[#0B1F14] text-base placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A] transition-all";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0B1F14]/50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
        <div className="w-full max-w-lg bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl my-4">

          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <h2 className="text-[#0B1F14] text-lg font-bold">Student Details</h2>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">

            {error !== null && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                <p className="text-[#991B1B] text-base">{error}</p>
              </div>
            )}
            {successMsg !== null && (
              <div className="flex items-center gap-2 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-4 py-3">
                <CheckCircle size={16} className="text-[#15803D] flex-shrink-0" />
                <p className="text-[#15803D] text-base">{successMsg}</p>
              </div>
            )}

            {/* Photo */}
            <div className="flex items-center gap-4">
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void handlePhotoSelected(e)} />
              {photoPath !== null ? (
                <img
                  src       = {`${axiosInstance.defaults.baseURL ?? ''}${photoPath}`}
                  alt       = {form.fullName}
                  className = "w-16 h-16 rounded-2xl object-cover border border-[#D7F2E0] flex-shrink-0"
                  onError   = {() => setPhotoPath(null)}
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
                  <span className="text-[#15803D] text-2xl font-bold">{form.fullName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <button
                type      = "button"
                onClick   = {() => photoInputRef.current?.click()}
                disabled  = {isPhotoBusy}
                className = "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#15803D] bg-[#F4FBF6] border border-[#D7F2E0] hover:border-[#4AE17A] transition-all disabled:opacity-50"
              >
                {isPhotoBusy ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Camera size={14} /> {photoPath !== null ? 'Change Photo' : 'Add Photo'}</>}
              </button>
            </div>

            {/* Read-only context — shown only if the caller supplied it;
                a class teacher's own roster already knows its one
                classroom via the panel header, so this can be omitted
                there without losing anything the student can't infer. */}
            {(student.class_name || student.branch_name) && (
              <div className="grid grid-cols-2 gap-3">
                {student.class_name && (
                  <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl">
                    <Lock size={11} className="text-[#6B8479] flex-shrink-0" />
                    <span className="text-[#3D5347] text-sm">{student.class_name}{student.arm_name ?? ''} · {student.department_name ?? ''}</span>
                  </div>
                )}
                {student.branch_name && (
                  <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl">
                    <Lock size={11} className="text-[#6B8479] flex-shrink-0" />
                    <span className="text-[#3D5347] text-sm">{student.branch_name}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl w-fit">
              <span className="text-[#6B8479] text-sm">Exam PIN:</span>
              <span className="font-mono text-base font-bold text-[#15803D] tracking-widest">
                {showPin ? student.login_pin : maskPin(student.login_pin)}
              </span>
              <button type="button" onClick={() => setShowPin((p) => !p)} className="text-[#6B8479] hover:text-[#15803D] transition-colors">
                {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Editable fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Full Name</label>
                <input type="text" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className={fieldCls} />
              </div>
              <div>
                <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Gender</label>
                <div className="relative">
                  <select value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))} className={`${fieldCls} appearance-none pr-10 cursor-pointer`}>
                    <option value="">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-[#3D5347] text-base font-semibold mb-1.5 flex items-center gap-1.5">
                  Admission Number
                  {!canEditAdmissionNumber && <Lock size={11} className="text-[#6B8479]" />}
                </label>
                {canEditAdmissionNumber ? (
                  <input type="text" value={form.admissionNumber} onChange={(e) => setForm((p) => ({ ...p, admissionNumber: e.target.value }))} className={fieldCls} />
                ) : (
                  <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl">
                    <span className="text-[#3D5347] text-base">{form.admissionNumber || 'Not provided'}</span>
                    <span className="text-[#6B8479] text-sm ml-auto">Admin only</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Father's Name</label>
                <input type="text" value={form.fatherName} onChange={(e) => setForm((p) => ({ ...p, fatherName: e.target.value }))} className={fieldCls} />
              </div>
              <div>
                <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Mother's Name</label>
                <input type="text" value={form.motherName} onChange={(e) => setForm((p) => ({ ...p, motherName: e.target.value }))} className={fieldCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Residential Address</label>
                <textarea rows={2} value={form.residentialAddress} onChange={(e) => setForm((p) => ({ ...p, residentialAddress: e.target.value }))} className={`${fieldCls} resize-none`} />
              </div>
            </div>

            {/* Contact numbers */}
            <div>
              <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider mb-3">Contact Numbers</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Father's Phone</label>
                  <input type="tel" value={form.fatherPhone} onChange={(e) => setForm((p) => ({ ...p, fatherPhone: e.target.value }))} placeholder="e.g., 08012345678" className={fieldCls} />
                </div>
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Mother's Phone</label>
                  <input type="tel" value={form.motherPhone} onChange={(e) => setForm((p) => ({ ...p, motherPhone: e.target.value }))} placeholder="e.g., 08012345678" className={fieldCls} />
                </div>
              </div>
            </div>

            {/* Guardian — for students not living with their parents */}
            <div>
              <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider mb-1">Guardian</p>
              <p className="text-[#6B8479] text-sm mb-3">Only needed if the student lives with someone other than their parents.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Guardian's Name</label>
                  <input type="text" value={form.guardianName} onChange={(e) => setForm((p) => ({ ...p, guardianName: e.target.value }))} className={fieldCls} />
                </div>
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Relationship to Student</label>
                  <input type="text" value={form.guardianRelationship} onChange={(e) => setForm((p) => ({ ...p, guardianRelationship: e.target.value }))} placeholder="e.g., Uncle, Grandmother" className={fieldCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Guardian's Phone</label>
                  <input type="tel" value={form.guardianPhone} onChange={(e) => setForm((p) => ({ ...p, guardianPhone: e.target.value }))} placeholder="e.g., 08012345678" className={fieldCls} />
                </div>
              </div>
            </div>

            {/* Bio-data & health */}
            <div>
              <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider mb-3">Bio-Data & Health</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))} className={fieldCls} />
                </div>
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">State of Origin</label>
                  <input type="text" value={form.stateOfOrigin} onChange={(e) => setForm((p) => ({ ...p, stateOfOrigin: e.target.value }))} className={fieldCls} />
                </div>
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">LGA</label>
                  <input type="text" value={form.lga} onChange={(e) => setForm((p) => ({ ...p, lga: e.target.value }))} className={fieldCls} />
                </div>
                <div />
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Blood Group</label>
                  <div className="relative">
                    <select value={form.bloodGroup} onChange={(e) => setForm((p) => ({ ...p, bloodGroup: e.target.value }))} className={`${fieldCls} appearance-none pr-10 cursor-pointer`}>
                      <option value="">Not specified</option>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                    <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Genotype</label>
                  <div className="relative">
                    <select value={form.genotype} onChange={(e) => setForm((p) => ({ ...p, genotype: e.target.value }))} className={`${fieldCls} appearance-none pr-10 cursor-pointer`}>
                      <option value="">Not specified</option>
                      {['AA','AS','SS','AC','SC','CC'].map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* School history */}
            <div>
              <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider mb-3">School History</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">
                    Date Joined
                    <span className="text-[#6B8479] font-normal text-sm ml-1">(actual admission date, not system entry date)</span>
                  </label>
                  <input type="date" value={form.dateJoined} onChange={(e) => setForm((p) => ({ ...p, dateJoined: e.target.value }))} className={fieldCls} />
                </div>
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Previous School</label>
                  <input type="text" value={form.previousSchool} onChange={(e) => setForm((p) => ({ ...p, previousSchool: e.target.value }))} className={fieldCls} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-base font-semibold text-[#3D5347] bg-[#F4FBF6] border border-[#D7F2E0] hover:bg-[#E7FBEE] transition-colors">
                Close
              </button>
              <button
                type      = "button"
                onClick   = {() => void handleSave()}
                disabled  = {isSaving}
                className = "flex items-center gap-2 px-6 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
              >
                {isSaving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


// ================================================================
//  MAIN COMPONENT
// ================================================================

export default function StudentEnrolmentPage(): React.JSX.Element {

  const [classes,     setClasses]     = useState<ClassLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeMode,  setActiveMode]  = useState<ActiveMode>('manual');

  // Manual form
  const [manualForm,       setManualForm]       = useState({
    fullName: '', classId: '', deptId: '', armId: '',
    gender: '', residentialAddress: '', motherName: '', fatherName: '', admissionNumber: '',
    fatherPhone: '', motherPhone: '', guardianName: '', guardianRelationship: '', guardianPhone: '',
    dateOfBirth: '', stateOfOrigin: '', lga: '', bloodGroup: '', genotype: '', previousSchool: '', dateJoined: '',
  });
  const [manualErrors,     setManualErrors]     = useState<Record<string, string>>({});
  const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);
  const [newPinBanner,     setNewPinBanner]     = useState<{ id: number; name: string; pin: string } | null>(null);
  const [showPin,          setShowPin]          = useState<boolean>(false);
  const [photoUploading,   setPhotoUploading]   = useState<boolean>(false);
  const [photoUploaded,    setPhotoUploaded]    = useState<boolean>(false);
  const [photoError,       setPhotoError]       = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [availableArms,    setAvailableArms]    = useState<ClassArm[]>([]);
  const [loadingArms,      setLoadingArms]      = useState<boolean>(false);
  const [myClassroom,        setMyClassroom]        = useState<{
    class_id: number; class_name: string;
    department_id: number; department_name: string;
    arm_id: number; arm_name: string;
  } | null>(null);
  const [myClassroomLoading, setMyClassroomLoading] = useState<boolean>(true);

  // Bulk upload
  const [isDragOver,    setIsDragOver]    = useState<boolean>(false);
  const [uploadFile,    setUploadFile]    = useState<File | null>(null);
  const [isUploading,   setIsUploading]   = useState<boolean>(false);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Student list
  const [students,          setStudents]          = useState<StudentRecordExtended[]>([]);
  const [selectedStudent,   setSelectedStudent]    = useState<StudentRecordExtended | null>(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(true);
  const [filterClassId,     setFilterClassId]     = useState<string>('');
  const [filterDeptId,      setFilterDeptId]      = useState<string>('');
  const [filterActive,      setFilterActive]      = useState<string>('');
  const [searchQuery,       setSearchQuery]       = useState<string>('');
  const [actionLoading,     setActionLoading]     = useState<number | null>(null);
  const [toast,             setToast]             = useState<Toast | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Result summary modal
  const [resultModalStudentId, setResultModalStudentId] = useState<number | null>(null);

  const activeBranch = useBranchContext();
  const { role }     = useAuth();

  const curriculum = useCurriculumConstraint(manualForm.classId, classes, departments);

  useEffect((): void => {
    setManualForm((prev) => ({ ...prev, deptId: curriculum.effectiveDeptId, armId: '' }));
  }, [curriculum.effectiveDeptId]);

  // ── Fetch arms for the selected class + department ────────────
  // Arms are optional — a class/dept may have none configured yet,
  // in which case the dropdown simply has nothing to offer and the
  // student is registered without an arm (arm_id stays NULL).
  useEffect(() => {
    const resolvedDept = manualForm.deptId;
    if (!manualForm.classId || !resolvedDept) { setAvailableArms([]); return; }

    const isSuperAdmin = role === 'super_admin';
    if (isSuperAdmin && activeBranch === null) { setAvailableArms([]); return; }

    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoadingArms(true);
      try {
        const qp = new URLSearchParams();
        qp.set('class_id', manualForm.classId);
        qp.set('department_id', resolvedDept);
        if (isSuperAdmin && activeBranch !== null) qp.set('branch_id', String(activeBranch.id));
        const res = await axiosInstance.get<ArmListResponse>(`/api/teacher/arms?${qp.toString()}`);
        if (!cancelled && res.data.success) setAvailableArms(res.data.arms);
      } catch {
        if (!cancelled) setAvailableArms([]);
      } finally {
        if (!cancelled) setLoadingArms(false);
      }
    };
    void load();
    return (): void => { cancelled = true; };
  }, [manualForm.classId, manualForm.deptId, role, activeBranch]);

  // ── Fetch my own classroom (teacher role only) ─────────────────
  // A plain teacher may only enrol students into the ONE arm they
  // are the class teacher of — never any other. Since a teacher can
  // only ever hold one class-teacher assignment (DB-enforced), this
  // is a single fetch, not a picker.
  useEffect((): void => {
    if (role !== 'teacher') { setMyClassroomLoading(false); return; }
    const load = async (): Promise<void> => {
      setMyClassroomLoading(true);
      try {
        const res = await axiosInstance.get<MyClassTeacherAssignmentResponse>('/api/teacher/my-class');
        if (res.data.success && res.data.is_class_teacher && res.data.assignment !== null) {
          const a = res.data.assignment;
          setMyClassroom({
            class_id: a.class_id, class_name: a.class_name,
            department_id: a.department_id, department_name: a.department_name,
            arm_id: a.arm_id, arm_name: a.arm_name,
          });
        }
      } catch { /* not a class teacher, or fetch failed */ } finally {
        setMyClassroomLoading(false);
      }
    };
    void load();
  }, [role]);


  // ── Fetch lookups ────────────────────────────────────────────

  useEffect((): void => {
    const fetch = async (): Promise<void> => {
      try {
        const [clsRes, deptRes] = await Promise.all([
          axiosInstance.get<ClassListResponse>('/api/shared/classes'),
          axiosInstance.get<DeptListResponse>('/api/shared/departments'),
        ]);
        if (clsRes.data.success)  setClasses(clsRes.data.classes);
        if (deptRes.data.success) setDepartments(deptRes.data.departments);
      } catch { /* non-fatal */ }
    };
    void fetch();
  }, []);


  // ── Fetch students ───────────────────────────────────────────

  const fetchStudents = useCallback(async (params?: {
    classId?: string; deptId?: string; active?: string; search?: string;
  }): Promise<void> => {
    setIsLoadingStudents(true);
    try {
      const qp = new URLSearchParams();
      if (params?.classId) qp.set('class_id',      params.classId);
      if (params?.deptId)  qp.set('department_id', params.deptId);
      if (params?.active)  qp.set('is_active',     params.active);
      if (params?.search)  qp.set('search',        params.search);
      const res = await axiosInstance.get<StudentListResponse>(
        `/api/teacher/students?${qp.toString()}`
      );
      if (res.data.success) setStudents(res.data.students);
    } catch { /* silent */ } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect((): void => {
    if (role === 'teacher') { setIsLoadingStudents(false); return; }
    void fetchStudents({
      classId: filterClassId || undefined,
      deptId : filterDeptId  || undefined,
      active : filterActive  || undefined,
      search : searchQuery   || undefined,
    });
  }, [fetchStudents, filterClassId, filterDeptId, filterActive, role]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = e.target.value;
    setSearchQuery(v);
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout((): void => {
      void fetchStudents({
        classId: filterClassId || undefined,
        deptId : filterDeptId  || undefined,
        active : filterActive  || undefined,
        search : v.trim()      || undefined,
      });
    }, 350);
  };


  // ── Manual form submit ───────────────────────────────────────

  const handleManualSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const isTeacherRole = role === 'teacher';
    const errs: Record<string, string> = {};

    if (!manualForm.fullName.trim()) errs.fullName = 'Full name is required.';

    if (isTeacherRole) {
      // Teacher path — no picker, just needs their own classroom to exist.
      if (myClassroom === null) {
        errs.general = 'You are not currently a class teacher, so you cannot enrol students. Ask your admin to assign you a classroom first.';
      }
    } else {
      if (!manualForm.classId)  errs.classId = 'Please select a class.';
      if (!manualForm.deptId)   errs.deptId  = 'Please select a department.';
      if (!manualForm.armId)    errs.armId   = availableArms.length === 0
        ? 'No arm exists for this class/department yet — create one on the Class Arms page first.'
        : 'Please select an arm.';
    }

    setManualErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const isSuperAdmin = role === 'super_admin';
    if (isSuperAdmin && activeBranch === null) {
      setManualErrors((p) => ({
        ...p,
        general: 'Please select a branch from the Branch Context switcher before enrolling a student.',
      }));
      return;
    }

    setManualSubmitting(true);
    setNewPinBanner(null);
    try {
      const res = await axiosInstance.post<CreateStudentResponse>(
        '/api/teacher/students/manual',
        {
          full_name    : manualForm.fullName.trim(),
          class_id     : isTeacherRole ? myClassroom!.class_id      : Number(manualForm.classId),
          department_id: isTeacherRole ? myClassroom!.department_id : Number(manualForm.deptId),
          arm_id       : isTeacherRole ? myClassroom!.arm_id        : Number(manualForm.armId),
          ...(isSuperAdmin && activeBranch !== null && { branch_id: activeBranch.id }),
          ...(manualForm.gender             !== '' && { gender: manualForm.gender }),
          ...(manualForm.residentialAddress !== '' && { residential_address: manualForm.residentialAddress.trim() }),
          ...(manualForm.motherName         !== '' && { mother_name: manualForm.motherName.trim() }),
          ...(manualForm.fatherName         !== '' && { father_name: manualForm.fatherName.trim() }),
          ...(manualForm.admissionNumber    !== '' && { admission_number: manualForm.admissionNumber.trim() }),
          ...(manualForm.fatherPhone          !== '' && { father_phone: manualForm.fatherPhone.trim() }),
          ...(manualForm.motherPhone          !== '' && { mother_phone: manualForm.motherPhone.trim() }),
          ...(manualForm.guardianName         !== '' && { guardian_name: manualForm.guardianName.trim() }),
          ...(manualForm.guardianRelationship !== '' && { guardian_relationship: manualForm.guardianRelationship.trim() }),
          ...(manualForm.guardianPhone        !== '' && { guardian_phone: manualForm.guardianPhone.trim() }),
          ...(manualForm.dateOfBirth          !== '' && { date_of_birth: manualForm.dateOfBirth }),
          ...(manualForm.stateOfOrigin        !== '' && { state_of_origin: manualForm.stateOfOrigin.trim() }),
          ...(manualForm.lga                  !== '' && { lga: manualForm.lga.trim() }),
          ...(manualForm.bloodGroup           !== '' && { blood_group: manualForm.bloodGroup }),
          ...(manualForm.genotype             !== '' && { genotype: manualForm.genotype }),
          ...(manualForm.previousSchool       !== '' && { previous_school: manualForm.previousSchool.trim() }),
          ...(manualForm.dateJoined           !== '' && { date_joined: manualForm.dateJoined }),
        }
      );
      if (res.data.success) {
        setNewPinBanner({
          id  : res.data.student.id,
          name: res.data.student.full_name,
          pin : res.data.student.login_pin,
        });
        setPhotoUploaded(false);
        setPhotoError(null);
        setManualForm({
          fullName: '', classId: '', deptId: '', armId: '',
          gender: '', residentialAddress: '', motherName: '', fatherName: '', admissionNumber: '',
          fatherPhone: '', motherPhone: '', guardianName: '', guardianRelationship: '', guardianPhone: '',
          dateOfBirth: '', stateOfOrigin: '', lga: '', bloodGroup: '', genotype: '', previousSchool: '', dateJoined: '',
        });
        setShowPin(false);
        void fetchStudents();
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setToast({ type: 'error', message: err.response?.data?.message ?? 'Failed to register student.' });
      } else {
        setToast({ type: 'error', message: 'Failed to register student.' });
      }
    } finally {
      setManualSubmitting(false);
    }
  };

  // ── Photo upload (post-registration step) ────────────────────
  // Photos can only be attached after the student exists, since
  // the upload endpoint needs a real student ID
  // (POST /api/media/students/:id/photo) — so this is a follow-up
  // action off the success banner, not part of the creation form.
  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (file === undefined || newPinBanner === null) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Only JPEG, PNG, or WEBP images are allowed.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Image must be under 2MB.');
      return;
    }

    setPhotoUploading(true);
    setPhotoError(null);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await axiosInstance.post<{ success: boolean; photo_path: string }>(
        `/api/media/students/${newPinBanner.id}/photo`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (res.data.success) {
        setPhotoUploaded(true);
        void fetchStudents();
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setPhotoError(err.response?.data?.message ?? 'Failed to upload photo.');
      } else {
        setPhotoError('Failed to upload photo.');
      }
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };


  // ── Bulk upload ──────────────────────────────────────────────

  const handleFileSelect = (file: File): void => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!allowed.includes(file.type)) {
      setToast({ type: 'error', message: 'Invalid file type. Please upload an .xlsx, .xls, or .csv file.' });
      return;
    }
    setUploadFile(file);
    setUploadSummary(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f !== undefined) handleFileSelect(f);
  };

  const handleBulkUpload = async (): Promise<void> => {
    if (uploadFile === null) return;
    setIsUploading(true);
    setUploadSummary(null);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const res = await axiosInstance.post<BulkUploadResponse>(
        '/api/upload/students', fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setUploadSummary({
        inserted_count   : res.data.inserted_count,
        error_count      : res.data.error_count,
        inserted_students: res.data.inserted_students,
        row_errors       : res.data.row_errors,
      });
      if (res.data.inserted_count > 0) void fetchStudents();
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setToast({ type: 'error', message: err.response?.data?.message ?? 'Upload failed.' });
      } else {
        setToast({ type: 'error', message: 'Upload failed. Please try again.' });
      }
    } finally {
      setIsUploading(false);
    }
  };


  // ── Status toggle ────────────────────────────────────────────

  const handleToggleStatus = async (
    studentId    : number,
    currentActive: boolean
  ): Promise<void> => {
    setActionLoading(studentId);
    const action = currentActive ? 'suspend' : 'reactivate';
    try {
      const res = await axiosInstance.put<{ success: boolean; message: string }>(
        `/api/teacher/students/${studentId}/status`, { action }
      );
      if (res.data.success) {
        setStudents((prev) => prev.map((s) =>
          s.id === studentId ? { ...s, is_active: !currentActive } : s
        ));
        setToast({
          type   : 'success',
          message: `Student ${action === 'suspend' ? 'suspended' : 'reactivated'} successfully.`,
        });
      }
    } catch {
      setToast({ type: 'error', message: 'Action failed. Please try again.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Shared input class builder for the manual form
  const inputCls = (field: string): string => [
    'w-full bg-white border-2 rounded-xl px-4 py-3.5 text-[#0B1F14] text-base',
    'placeholder:text-[#6B8479] focus:outline-none transition-all duration-100',
    manualErrors[field]
      ? 'border-[#FCA5A5] focus:border-[#991B1B]'
      : 'border-[#D7F2E0] focus:border-[#4AE17A]',
  ].join(' ');


  // ================================================================
  //  RENDER
  // ================================================================

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Student Enrolment
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            Register students individually or in bulk via Excel upload.
          </p>
        </div>
        <button
          type      = "button"
          onClick   = {() => void fetchStudents({
            classId: filterClassId || undefined,
            deptId : filterDeptId  || undefined,
            active : filterActive  || undefined,
            search : searchQuery   || undefined,
          })}
          disabled  = {isLoadingStudents}
          className = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
        >
          <RefreshCw size={15} className={isLoadingStudents ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>


      {/* ── My Subjects / My Class — teacher only ───────────── */}
      {role === 'teacher' && (
        <>
          <MySubjectsPanel onToast={setToast} />
          <MyClassPanel    onToast={setToast} />
        </>
      )}


      {/* ── Enrolment panel ─────────────────────────────────────
           Admin/Super Admin always see this. A teacher only sees
           it once we've confirmed they're an actual class teacher
           — a subject-only teacher never gets this panel at all,
           not even a disabled/blocked version of it. ──────────── */}
      {(role !== 'teacher' || (!myClassroomLoading && myClassroom !== null)) && (
      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

        {/* Tab strip */}
        <div className="flex border-b border-[#D7F2E0]">
          {(['manual', 'bulk'] as const).map((mode) => (
            <button
              key       = {mode}
              type      = "button"
              onClick   = {() => setActiveMode(mode)}
              className = {[
                'flex items-center gap-2 px-6 py-4 text-base font-semibold transition-all border-b-2',
                activeMode === mode
                  ? 'text-[#15803D] border-[#4AE17A] bg-[#E7FBEE]'
                  : 'text-[#6B8479] border-transparent hover:text-[#3D5347] hover:bg-[#F4FBF6]',
              ].join(' ')}
            >
              {mode === 'manual' ? <Plus size={16} /> : <Upload size={16} />}
              {mode === 'manual' ? 'Single Entry' : 'Bulk Upload'}
            </button>
          ))}
        </div>

        {/* ── TAB A: Manual Entry ──────────────────────────── */}
        {activeMode === 'manual' && (
          <div className="p-6">

            {/* New PIN banner */}
            {newPinBanner !== null && (
              <div className="mb-6 bg-[#E7FBEE] border border-[#86EFAC] rounded-2xl px-6 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle size={17} className="text-[#15803D]" />
                      <p className="text-[#15803D] text-base font-bold">
                        {newPinBanner.name} registered successfully
                      </p>
                    </div>
                    <p className="text-[#6B8479] text-sm mt-1">
                      Share this Exam PIN with the student securely:
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="font-mono text-3xl font-bold text-[#15803D] tracking-widest">
                        {showPin ? newPinBanner.pin : maskPin(newPinBanner.pin)}
                      </span>
                      <button
                        type      = "button"
                        onClick   = {() => setShowPin((p) => !p)}
                        className = "p-2 rounded-xl bg-white border border-[#D7F2E0] text-[#6B8479] hover:text-[#3D5347] hover:border-[#22B85C] transition-all"
                        aria-label= {showPin ? 'Hide PIN' : 'Reveal PIN'}
                      >
                        {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <button
                    type      = "button"
                    onClick   = {() => setNewPinBanner(null)}
                    className = "text-[#6B8479] hover:text-[#3D5347] transition-colors flex-shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Photo upload step — only possible now that the
                    student has a real ID. Optional; the enrolment
                    itself is already complete regardless. */}
                <div className="mt-4 pt-4 border-t border-[#86EFAC]">
                  <input
                    ref      = {photoInputRef}
                    type     = "file"
                    accept   = "image/jpeg,image/png,image/webp"
                    className= "hidden"
                    onChange = {(e) => void handlePhotoSelected(e)}
                  />
                  {photoUploaded ? (
                    <div className="flex items-center gap-2 text-[#15803D] text-sm font-semibold">
                      <CheckCircle size={15} />
                      Photo uploaded
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type      = "button"
                        onClick   = {() => photoInputRef.current?.click()}
                        disabled  = {photoUploading}
                        className = "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#15803D] bg-white border border-[#86EFAC] hover:border-[#4AE17A] transition-all disabled:opacity-50"
                      >
                        {photoUploading
                          ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                          : <><Camera size={14} /> Add Photo (optional)</>
                        }
                      </button>
                      <span className="text-[#6B8479] text-sm">JPEG, PNG, or WEBP, under 2MB</span>
                    </div>
                  )}
                  {photoError !== null && (
                    <p className="text-[#991B1B] text-sm mt-2">{photoError}</p>
                  )}
                </div>
              </div>
            )}

            {/* Branch warning for super admin */}
            {role === 'super_admin' && activeBranch === null && (
              <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-5 py-4 mb-5">
                <AlertCircle size={17} className="text-[#92400E] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[#92400E] text-base font-bold">No branch selected</p>
                  <p className="text-[#92400E]/80 text-sm mt-0.5 leading-relaxed">
                    Select a branch from the Branch Context switcher in the sidebar
                    before enrolling students. Students must belong to a specific branch.
                  </p>
                </div>
              </div>
            )}

            {/* General API error */}
            {manualErrors.general !== undefined && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4 mb-5">
                <AlertCircle size={17} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                <p className="text-[#991B1B] text-base">{manualErrors.general}</p>
              </div>
            )}

            {/* Teacher path: not a class teacher — enrolment is blocked entirely */}
            {role === 'teacher' && !myClassroomLoading && myClassroom === null && manualErrors.general === undefined && (
              <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-5 py-4 mb-5">
                <AlertCircle size={17} className="text-[#92400E] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[#92400E] text-base font-bold">Only class teachers can enrol students</p>
                  <p className="text-[#92400E]/80 text-sm mt-0.5 leading-relaxed">
                    You are not currently assigned as a class teacher for any classroom.
                    Ask your admin to assign you as a class teacher before you can enrol students.
                  </p>
                </div>
              </div>
            )}

            {/* Form — hidden entirely for a teacher with no classroom */}
            {(role !== 'teacher' || myClassroomLoading || myClassroom !== null) && (
              <form onSubmit={handleManualSubmit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                {/* Full name */}
                <div className="sm:col-span-2">
                  <label className="block text-[#3D5347] text-base font-semibold mb-2">
                    Student Full Name
                  </label>
                  <input
                    type        = "text"
                    value       = {manualForm.fullName}
                    onChange    = {(e) => { setManualForm((p) => ({ ...p, fullName: e.target.value })); setManualErrors((p) => ({ ...p, fullName: '' })); }}
                    disabled    = {manualSubmitting || (role === 'teacher' && myClassroomLoading)}
                    placeholder = "e.g., Adaeze Okafor"
                    className   = {inputCls('fullName')}
                  />
                  {manualErrors.fullName && <p className="text-[#991B1B] text-sm mt-1.5">{manualErrors.fullName}</p>}
                </div>

                {/* New optional profile fields — confirmed scope:
                    Gender, Address, Mother's Name, Father's Name,
                    Admission Number. All optional; can be filled in
                    later if not known at enrolment time. */}
                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-2">
                    Gender <span className="text-[#6B8479] font-normal text-sm">(optional)</span>
                  </label>
                  <div className="relative">
                    <select
                      value     = {manualForm.gender}
                      onChange  = {(e) => setManualForm((p) => ({ ...p, gender: e.target.value }))}
                      disabled  = {manualSubmitting}
                      className = {`${inputCls('gender')} appearance-none pr-12 cursor-pointer ${manualForm.gender === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]'}`}
                    >
                      <option value="">Not specified</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-2">
                    Admission Number <span className="text-[#6B8479] font-normal text-sm">(optional)</span>
                  </label>
                  <input
                    type        = "text"
                    value       = {manualForm.admissionNumber}
                    onChange    = {(e) => setManualForm((p) => ({ ...p, admissionNumber: e.target.value }))}
                    disabled    = {manualSubmitting}
                    placeholder = "e.g., 2026/0142"
                    className   = {inputCls('admissionNumber')}
                  />
                </div>

                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-2">
                    Father's Name <span className="text-[#6B8479] font-normal text-sm">(optional)</span>
                  </label>
                  <input
                    type        = "text"
                    value       = {manualForm.fatherName}
                    onChange    = {(e) => setManualForm((p) => ({ ...p, fatherName: e.target.value }))}
                    disabled    = {manualSubmitting}
                    placeholder = "e.g., Zulfiqar Ali"
                    className   = {inputCls('fatherName')}
                  />
                </div>

                <div>
                  <label className="block text-[#3D5347] text-base font-semibold mb-2">
                    Mother's Name <span className="text-[#6B8479] font-normal text-sm">(optional)</span>
                  </label>
                  <input
                    type        = "text"
                    value       = {manualForm.motherName}
                    onChange    = {(e) => setManualForm((p) => ({ ...p, motherName: e.target.value }))}
                    disabled    = {manualSubmitting}
                    placeholder = "e.g., Amina Ali"
                    className   = {inputCls('motherName')}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[#3D5347] text-base font-semibold mb-2">
                    Residential Address <span className="text-[#6B8479] font-normal text-sm">(optional)</span>
                  </label>
                  <textarea
                    rows        = {2}
                    value       = {manualForm.residentialAddress}
                    onChange    = {(e) => setManualForm((p) => ({ ...p, residentialAddress: e.target.value }))}
                    disabled    = {manualSubmitting}
                    placeholder = "e.g., 14 Fazil Road, Fazil Nagar"
                    className   = {`${inputCls('residentialAddress')} resize-none`}
                  />
                </div>

                {/* Contact numbers */}
                <div className="sm:col-span-2">
                  <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider mb-3">Contact Numbers</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Father's Phone</label>
                      <input type="tel" value={manualForm.fatherPhone} onChange={(e) => setManualForm((p) => ({ ...p, fatherPhone: e.target.value }))} disabled={manualSubmitting} placeholder="e.g., 08012345678" className={inputCls('fatherPhone')} />
                    </div>
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Mother's Phone</label>
                      <input type="tel" value={manualForm.motherPhone} onChange={(e) => setManualForm((p) => ({ ...p, motherPhone: e.target.value }))} disabled={manualSubmitting} placeholder="e.g., 08012345678" className={inputCls('motherPhone')} />
                    </div>
                  </div>
                </div>

                {/* Guardian */}
                <div className="sm:col-span-2">
                  <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider mb-1">Guardian</p>
                  <p className="text-[#6B8479] text-sm mb-3">Only needed if the student lives with someone other than their parents.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Guardian's Name</label>
                      <input type="text" value={manualForm.guardianName} onChange={(e) => setManualForm((p) => ({ ...p, guardianName: e.target.value }))} disabled={manualSubmitting} className={inputCls('guardianName')} />
                    </div>
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Relationship to Student</label>
                      <input type="text" value={manualForm.guardianRelationship} onChange={(e) => setManualForm((p) => ({ ...p, guardianRelationship: e.target.value }))} disabled={manualSubmitting} placeholder="e.g., Uncle, Grandmother" className={inputCls('guardianRelationship')} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Guardian's Phone</label>
                      <input type="tel" value={manualForm.guardianPhone} onChange={(e) => setManualForm((p) => ({ ...p, guardianPhone: e.target.value }))} disabled={manualSubmitting} placeholder="e.g., 08012345678" className={inputCls('guardianPhone')} />
                    </div>
                  </div>
                </div>

                {/* Bio-data & health */}
                <div className="sm:col-span-2">
                  <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider mb-3">Bio-Data & Health</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Date of Birth</label>
                      <input type="date" value={manualForm.dateOfBirth} onChange={(e) => setManualForm((p) => ({ ...p, dateOfBirth: e.target.value }))} disabled={manualSubmitting} className={inputCls('dateOfBirth')} />
                    </div>
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">State of Origin</label>
                      <input type="text" value={manualForm.stateOfOrigin} onChange={(e) => setManualForm((p) => ({ ...p, stateOfOrigin: e.target.value }))} disabled={manualSubmitting} className={inputCls('stateOfOrigin')} />
                    </div>
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">LGA</label>
                      <input type="text" value={manualForm.lga} onChange={(e) => setManualForm((p) => ({ ...p, lga: e.target.value }))} disabled={manualSubmitting} className={inputCls('lga')} />
                    </div>
                    <div />
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Blood Group</label>
                      <div className="relative">
                        <select value={manualForm.bloodGroup} onChange={(e) => setManualForm((p) => ({ ...p, bloodGroup: e.target.value }))} disabled={manualSubmitting} className={`${inputCls('bloodGroup')} appearance-none pr-12 cursor-pointer ${manualForm.bloodGroup === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]'}`}>
                          <option value="">Not specified</option>
                          {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                        </select>
                        <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Genotype</label>
                      <div className="relative">
                        <select value={manualForm.genotype} onChange={(e) => setManualForm((p) => ({ ...p, genotype: e.target.value }))} disabled={manualSubmitting} className={`${inputCls('genotype')} appearance-none pr-12 cursor-pointer ${manualForm.genotype === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]'}`}>
                          <option value="">Not specified</option>
                          {['AA','AS','SS','AC','SC','CC'].map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* School history */}
                <div className="sm:col-span-2">
                  <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wider mb-3">School History</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">
                        Date Joined
                        <span className="text-[#6B8479] font-normal text-sm ml-1">(actual admission date)</span>
                      </label>
                      <input type="date" value={manualForm.dateJoined} onChange={(e) => setManualForm((p) => ({ ...p, dateJoined: e.target.value }))} disabled={manualSubmitting} className={inputCls('dateJoined')} />
                    </div>
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-1.5">Previous School</label>
                      <input type="text" value={manualForm.previousSchool} onChange={(e) => setManualForm((p) => ({ ...p, previousSchool: e.target.value }))} disabled={manualSubmitting} className={inputCls('previousSchool')} />
                    </div>
                  </div>
                </div>

                {/* Teacher path: locked classroom banner, no picker */}
                {role === 'teacher' && (
                  <div className="sm:col-span-2">
                    <label className="block text-[#3D5347] text-base font-semibold mb-2">
                      Classroom
                    </label>
                    {myClassroomLoading ? (
                      <div className="flex items-center gap-2 text-[#6B8479] text-sm px-4 py-3.5 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl">
                        <Loader2 size={15} className="animate-spin" /> Checking your class teacher assignment…
                      </div>
                    ) : myClassroom !== null ? (
                      <div className="flex items-center gap-2 px-4 py-3.5 bg-[#EFF6FF] border border-[#BAE6FD] rounded-xl">
                        <p className="text-[#0369A1] text-base font-semibold">
                          {myClassroom.class_name}{myClassroom.arm_name} · {myClassroom.department_name}
                        </p>
                        <span className="ml-auto text-[#0369A1] text-sm">Your homeroom</span>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Admin/Super Admin path: full Class → Department → Arm cascade */}
                {role !== 'teacher' && (
                  <>
                    {/* Class */}
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-2">
                        Class Level
                      </label>
                      <div className="relative">
                        <select
                          value     = {manualForm.classId}
                          onChange  = {(e) => { setManualForm((p) => ({ ...p, classId: e.target.value })); setManualErrors((p) => ({ ...p, classId: '' })); }}
                          disabled  = {manualSubmitting}
                          className = {`${inputCls('classId')} appearance-none pr-12 cursor-pointer ${manualForm.classId === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]'}`}
                        >
                          <option value="" disabled>Select class…</option>
                          {classes.map((c) => (
                            <option key={c.id} value={String(c.id)}>{c.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
                      </div>
                      {manualErrors.classId && <p className="text-[#991B1B] text-sm mt-1.5">{manualErrors.classId}</p>}
                    </div>

                    {/* Department */}
                    <div>
                      <label className="block text-[#3D5347] text-base font-semibold mb-2">
                        Department Track
                      </label>
                      <div className="relative">
                        <select
                          value     = {curriculum.effectiveDeptId}
                          onChange  = {(e) => { curriculum.setDeptId(e.target.value); setManualErrors((p) => ({ ...p, deptId: '' })); }}
                          disabled  = {manualSubmitting || curriculum.isDepartmentLocked}
                          className = {[
                            'w-full appearance-none bg-white border-2 rounded-xl px-4 py-3.5 text-base',
                            'focus:outline-none transition-all duration-100 pr-12 cursor-pointer',
                            'disabled:cursor-not-allowed',
                            curriculum.isDepartmentLocked
                              ? 'border-[#FCD34D] bg-[#FFFBEB] opacity-80'
                              : manualErrors.deptId
                              ? 'border-[#FCA5A5] focus:border-[#991B1B]'
                              : 'border-[#D7F2E0] focus:border-[#4AE17A]',
                            curriculum.effectiveDeptId === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]',
                          ].join(' ')}
                        >
                          <option value="" disabled>
                            {curriculum.isDepartmentLocked ? 'General (auto-assigned)' : 'Select department…'}
                          </option>
                          {departments.map((d) => (
                            <option key={d.id} value={String(d.id)}>{d.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
                      </div>

                      {curriculum.lockReason !== null && (
                        <div className="flex items-start gap-2 mt-2 px-3 py-2.5 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl">
                          <AlertCircle size={14} className="text-[#92400E] flex-shrink-0 mt-0.5" />
                          <p className="text-[#92400E] text-sm leading-relaxed">
                            {curriculum.lockReason}
                          </p>
                        </div>
                      )}
                      {manualErrors.deptId && <p className="text-[#991B1B] text-sm mt-1.5">{manualErrors.deptId}</p>}
                    </div>

                    {/* Arm — now REQUIRED. If none exist yet for this class/dept,
                        the picker is replaced with a clear instruction instead of
                        silently letting the student be created without one. */}
                    {manualForm.classId && manualForm.deptId && (
                      <div className="sm:col-span-2">
                        <label className="block text-[#3D5347] text-base font-semibold mb-2">
                          Arm
                        </label>
                        {loadingArms ? (
                          <div className="flex items-center gap-2 text-[#6B8479] text-sm px-4 py-3.5 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl">
                            <Loader2 size={15} className="animate-spin" /> Loading arms…
                          </div>
                        ) : availableArms.length === 0 ? (
                          <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-4 py-3">
                            <AlertCircle size={15} className="text-[#92400E] flex-shrink-0 mt-0.5" />
                            <p className="text-[#92400E] text-sm leading-relaxed">
                              No arm exists yet for this class and department. Create one on the
                              Class Arms page before enrolling students here.
                            </p>
                          </div>
                        ) : (
                          <div className="relative">
                            <select
                              value     = {manualForm.armId}
                              onChange  = {(e) => { setManualForm((p) => ({ ...p, armId: e.target.value })); setManualErrors((p) => ({ ...p, armId: '' })); }}
                              disabled  = {manualSubmitting}
                              className = {`${inputCls('armId')} appearance-none pr-12 cursor-pointer ${manualForm.armId === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]'}`}
                            >
                              <option value="" disabled>Select arm…</option>
                              {availableArms.map((a) => (
                                <option key={a.id} value={String(a.id)}>Arm {a.name}</option>
                              ))}
                            </select>
                            <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
                          </div>
                        )}
                        {manualErrors.armId && <p className="text-[#991B1B] text-sm mt-1.5">{manualErrors.armId}</p>}
                      </div>
                    )}
                  </>
                )}

                {/* Submit */}
                <div className="sm:col-span-2 flex justify-end pt-2">
                  <button
                    type      = "submit"
                    disabled  = {
                      manualSubmitting ||
                      (role === 'teacher' && (myClassroomLoading || myClassroom === null)) ||
                      (role !== 'teacher' && manualForm.classId !== '' && manualForm.deptId !== '' && availableArms.length === 0 && !loadingArms)
                    }
                    className = "flex items-center gap-2 px-6 py-3 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
                  >
                    {manualSubmitting
                      ? <><Loader2 size={17} className="animate-spin" /> Registering…</>
                      : <><Plus size={17} /> Register Student</>
                    }
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── TAB B: Bulk Upload ───────────────────────────── */}
        {activeMode === 'bulk' && (
          <div className="p-6 space-y-5">

            {/* Template row */}
            <div className="flex items-center justify-between gap-4 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl px-5 py-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={18} className="text-[#15803D] flex-shrink-0" />
                <div>
                  <p className="text-[#0B1F14] text-base font-semibold">
                    Download the student upload template
                  </p>
                  <p className="text-[#6B8479] text-sm mt-0.5">
                    Columns required: Full Name · Class · Department · Branch
                  </p>
                </div>
              </div>
              <a
                href      = "/templates/student_upload_template.xlsx"
                download
                className = "flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14] text-sm font-bold transition-colors flex-shrink-0"
              >
                <Download size={15} />
                Template
              </a>
            </div>

            {/* Drop zone */}
            <div
              onDragOver = {(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave= {() => setIsDragOver(false)}
              onDrop     = {handleDrop}
              onClick    = {() => fileInputRef.current?.click()}
              className  = {[
                'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all',
                isDragOver
                  ? 'border-[#4AE17A] bg-[#E7FBEE]'
                  : uploadFile !== null
                  ? 'border-[#86EFAC] bg-[#E7FBEE]'
                  : 'border-[#D7F2E0] hover:border-[#22B85C] bg-white',
              ].join(' ')}
            >
              <input
                ref      = {fileInputRef}
                type     = "file"
                accept   = ".xlsx,.xls,.csv"
                className= "hidden"
                onChange = {(e) => {
                  const f = e.target.files?.[0];
                  if (f !== undefined) handleFileSelect(f);
                }}
              />
              <Upload
                size      = {32}
                className = {[
                  'mx-auto mb-3 transition-colors',
                  isDragOver      ? 'text-[#4AE17A]' :
                  uploadFile !== null ? 'text-[#15803D]' :
                  'text-[#6B8479]',
                ].join(' ')}
              />
              {uploadFile !== null ? (
                <div>
                  <p className="text-[#15803D] text-base font-bold">{uploadFile.name}</p>
                  <p className="text-[#6B8479] text-sm mt-1">
                    {(uploadFile.size / 1024).toFixed(1)} KB — Click to change file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-[#3D5347] text-base font-semibold">
                    Drag & drop your Excel file here
                  </p>
                  <p className="text-[#6B8479] text-sm mt-1">
                    or click to browse · .xlsx · .xls · .csv
                  </p>
                </div>
              )}
            </div>

            {/* Upload button row */}
            {uploadFile !== null && (
              <div className="flex items-center justify-between gap-4">
                <button
                  type      = "button"
                  onClick   = {() => { setUploadFile(null); setUploadSummary(null); }}
                  className = "flex items-center gap-1.5 text-[#6B8479] text-sm font-semibold hover:text-[#3D5347] transition-colors"
                >
                  <X size={15} />
                  Remove file
                </button>
                <button
                  type      = "button"
                  onClick   = {() => void handleBulkUpload()}
                  disabled  = {isUploading}
                  className = "flex items-center gap-2 px-6 py-3 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
                >
                  {isUploading
                    ? <><Loader2 size={16} className="animate-spin" /> Uploading…</>
                    : <><Upload size={16} /> Upload & Register</>
                  }
                </button>
              </div>
            )}

            {/* Upload summary */}
            {uploadSummary !== null && (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#E7FBEE] border border-[#86EFAC] rounded-2xl px-5 py-4">
                    <p className="text-3xl font-bold text-[#15803D] tabular-nums">
                      {uploadSummary.inserted_count}
                    </p>
                    <p className="text-[#15803D]/70 text-sm font-medium mt-1">
                      Students registered
                    </p>
                  </div>
                  <div className={[
                    'border rounded-2xl px-5 py-4',
                    uploadSummary.error_count > 0
                      ? 'bg-[#FEF2F2] border-[#FCA5A5]'
                      : 'bg-[#F4FBF6] border-[#D7F2E0]',
                  ].join(' ')}>
                    <p className={`text-3xl font-bold tabular-nums ${uploadSummary.error_count > 0 ? 'text-[#991B1B]' : 'text-[#6B8479]'}`}>
                      {uploadSummary.error_count}
                    </p>
                    <p className={`text-sm font-medium mt-1 ${uploadSummary.error_count > 0 ? 'text-[#991B1B]/70' : 'text-[#6B8479]'}`}>
                      Rows with errors
                    </p>
                  </div>
                </div>

                {/* Error rows table */}
                {uploadSummary.row_errors.length > 0 && (
                  <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#D7F2E0] bg-[#FEF2F2]">
                      <p className="text-[#991B1B] text-base font-bold">
                        Rows that were skipped — fix and re-upload:
                      </p>
                    </div>
                    <div className="overflow-x-auto max-h-52 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#D7F2E0] bg-[#F4FBF6]">
                            <th className="text-left px-5 py-3 text-[#3D5347] font-semibold text-sm uppercase tracking-wider">Row</th>
                            <th className="text-left px-5 py-3 text-[#3D5347] font-semibold text-sm uppercase tracking-wider">Name</th>
                            <th className="text-left px-5 py-3 text-[#3D5347] font-semibold text-sm uppercase tracking-wider">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uploadSummary.row_errors.map((err, i) => (
                            <tr key={err.row} className={`border-b border-[#F4FBF6] ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]'}`}>
                              <td className="px-5 py-3 text-[#6B8479] text-sm">#{err.row}</td>
                              <td className="px-5 py-3 text-[#3D5347] text-sm font-medium">{err.full_name}</td>
                              <td className="px-5 py-3 text-[#991B1B] text-sm">{err.errors.join('; ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Inserted PINs */}
                {uploadSummary.inserted_students.length > 0 && (
                  <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#D7F2E0] bg-[#E7FBEE]">
                      <p className="text-[#15803D] text-base font-bold">
                        Registered students & their PINs:
                      </p>
                    </div>
                    <div className="overflow-x-auto max-h-52 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#D7F2E0] bg-[#F4FBF6]">
                            <th className="text-left px-5 py-3 text-[#3D5347] font-semibold text-sm uppercase tracking-wider">Name</th>
                            <th className="text-left px-5 py-3 text-[#3D5347] font-semibold text-sm uppercase tracking-wider">Exam PIN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uploadSummary.inserted_students.map((s, i) => (
                            <tr key={s.id} className={`border-b border-[#F4FBF6] ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]'}`}>
                              <td className="px-5 py-3 text-[#0B1F14] text-base font-semibold">{s.full_name}</td>
                              <td className="px-5 py-3 font-mono text-base font-bold text-[#15803D] tracking-widest">{s.login_pin}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      )}


      {/* ── Student list — Admin/Super Admin only ─────────────
           A subject or class teacher never sees the unscoped full
           roster; they use "My Subjects" / "My Class" above instead. */}
      {role !== 'teacher' && (
      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

        {/* List header + filters */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <GraduationCap size={18} className="text-[#3D5347]" />
            <h2 className="text-[#0B1F14] text-base font-bold">Enrolled Students</h2>
            {!isLoadingStudents && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                {students.length}
              </span>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
              <input
                type        = "text"
                value       = {searchQuery}
                onChange    = {handleSearchChange}
                placeholder = "Search name…"
                className   = "bg-white border border-[#D7F2E0] rounded-xl pl-9 pr-3.5 py-2 text-sm text-[#0B1F14] placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A] transition-all w-40"
              />
            </div>

            {/* Class filter */}
            <div className="relative">
              <select
                value     = {filterClassId}
                onChange  = {(e) => setFilterClassId(e.target.value)}
                className = "appearance-none bg-white border border-[#D7F2E0] rounded-xl pl-3 pr-8 py-2 text-sm text-[#3D5347] font-medium focus:outline-none focus:border-[#4AE17A] cursor-pointer transition-all"
              >
                <option value="">All Classes</option>
                {classes.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
            </div>

            {/* Dept filter */}
            <div className="relative">
              <select
                value     = {filterDeptId}
                onChange  = {(e) => setFilterDeptId(e.target.value)}
                className = "appearance-none bg-white border border-[#D7F2E0] rounded-xl pl-3 pr-8 py-2 text-sm text-[#3D5347] font-medium focus:outline-none focus:border-[#4AE17A] cursor-pointer transition-all"
              >
                <option value="">All Depts</option>
                {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
            </div>

            {/* Status filter */}
            <div className="relative">
              <select
                value     = {filterActive}
                onChange  = {(e) => setFilterActive(e.target.value)}
                className = "appearance-none bg-white border border-[#D7F2E0] rounded-xl pl-3 pr-8 py-2 text-sm text-[#3D5347] font-medium focus:outline-none focus:border-[#4AE17A] cursor-pointer transition-all"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Suspended</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Skeleton */}
        {isLoadingStudents && (
          <div className="divide-y divide-[#F4FBF6]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-[#F4FBF6] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F4FBF6] rounded w-1/3" />
                  <div className="h-3 bg-[#F4FBF6] rounded w-1/4" />
                </div>
                <div className="h-7 w-20 rounded-full bg-[#F4FBF6]" />
                <div className="h-8 w-8 rounded-lg bg-[#F4FBF6]" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoadingStudents && students.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-5">
              <GraduationCap size={28} className="text-[#6B8479]" />
            </div>
            <p className="text-[#0B1F14] text-base font-bold">No students found</p>
            <p className="text-[#6B8479] text-sm mt-1.5">
              {searchQuery || filterClassId || filterDeptId || filterActive
                ? 'No students match the current filters.'
                : 'Register your first student using the form above.'}
            </p>
          </div>
        )}

        {/* Data table */}
        {!isLoadingStudents && students.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D7F2E0]">
                  {['Student', 'PIN', 'Class', 'Department', 'Arm', 'Status', 'Results', 'Action'].map((h) => (
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
                {students.map((student, i) => {
                  const isEven = i % 2 === 0;
                  return (
                    <tr
                      key       = {student.id}
                      className = {`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors ${isEven ? 'bg-white' : 'bg-[#F4FBF6]'}`}
                    >
                      <td className="px-6 py-4">
                        <button
                          type      = "button"
                          onClick   = {() => setSelectedStudent(student)}
                          className = "flex items-center gap-3 text-left group"
                        >
                          <div className="w-10 h-10 rounded-full bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {student.photo_path ? (
                              <img
                                src       = {`${axiosInstance.defaults.baseURL ?? ''}${student.photo_path}`}
                                alt       = {student.full_name}
                                className = "w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[#15803D] text-base font-bold">
                                {student.full_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <p className="text-[#0B1F14] text-base font-semibold whitespace-nowrap group-hover:text-[#15803D] group-hover:underline transition-colors">
                            {student.full_name}
                          </p>
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-base font-bold text-[#15803D] tracking-widest">
                          {student.login_pin}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[#3D5347] text-sm">{student.class_name}{student.arm_name ?? ''}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[#3D5347] text-sm">{student.department_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[#3D5347] text-sm">{student.arm_name ?? '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge active={student.is_active} />
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type      = "button"
                          onClick   = {() => setResultModalStudentId(student.id)}
                          className = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#15803D] bg-[#E7FBEE] border border-[#86EFAC] hover:bg-[#D1F5DE] transition-colors"
                        >
                          <BarChart3 size={13} />
                          View
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type      = "button"
                          onClick   = {() => void handleToggleStatus(student.id, student.is_active)}
                          disabled  = {actionLoading === student.id}
                          title     = {student.is_active ? 'Suspend student' : 'Reactivate student'}
                          className = {[
                            'p-2 rounded-lg transition-colors',
                            actionLoading === student.id ? 'opacity-50 cursor-not-allowed' : '',
                            student.is_active
                              ? 'text-[#6B8479] hover:text-[#92400E] hover:bg-[#FFFBEB]'
                              : 'text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE]',
                          ].join(' ')}
                        >
                          {actionLoading === student.id
                            ? <Loader2 size={16} className="animate-spin" />
                            : <UserX size={16} />
                          }
                        </button>
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

      {/* Toast */}
      {toast !== null && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Result summary modal */}
      {resultModalStudentId !== null && (
        <StudentResultModal
          studentId = {resultModalStudentId}
          onClose   = {() => setResultModalStudentId(null)}
        />
      )}

      {/* Student detail / edit modal */}
      {selectedStudent !== null && (
        <StudentDetailModal
          student = {selectedStudent}
          onClose = {() => setSelectedStudent(null)}
          onSaved = {(updated) => {
            setStudents((prev) => prev.map((s) => s.id === updated.id ? { ...s, ...updated } : s));
            setSelectedStudent((prev) => prev !== null && prev.id === updated.id ? { ...prev, ...updated } : prev);
          }}
        />
      )}
    </div>
  );
}