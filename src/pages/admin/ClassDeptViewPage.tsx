// ================================================================
//  CBT SYSTEM — CLASSES, DEPARTMENTS & SUBJECTS PAGE
//  File    : src/pages/admin/ClassDeptViewPage.tsx
//  Design  : Vibrant Institutional Light Mode
//
//  Department colour mapping note:
//    Science is the only department whose color collides directly
//    with the new brand green if left as a green-tinted scheme,
//    so it has been moved to a distinct blue-teal family. General
//    keeps its green family since "General" pairs naturally with
//    the brand accent (it's the default/universal track). Art and
//    Commercial are unchanged (violet, amber) since they were
//    already distinct.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
}                                                   from 'react';
import {
  BookOpen,
  GraduationCap,
  Layers,
  FlaskConical,
  Palette,
  Briefcase,
  Globe,
  Info,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Plus,
  X,
  Loader2,
  ChevronDown,
  Tag,
  ChevronRight,
}                                                   from 'lucide-react';

import axiosInstance                   from '../../api/axiosInstance';
import type { ClassLevel, Department } from '../../types/exam';


// ================================================================
//  TYPES
// ================================================================

interface ClassListResponse   { success: boolean; count: number; classes: ClassLevel[] }
interface DeptListResponse    { success: boolean; count: number; departments: Department[] }

interface SubjectRecord {
  subject_id      : number;
  subject_name    : string;
  class_id        : number;
  class_name      : string;
  department_id   : number;
  department_name : string;
}

interface SubjectListResponse   { success: boolean; count: number; subjects: SubjectRecord[] }
interface CreateSubjectResponse { success: boolean; message: string; subject: SubjectRecord }
interface Toast { type: 'success' | 'error'; message: string }


// ================================================================
//  DEPARTMENT METADATA
// ================================================================

interface DeptMeta {
  icon        : React.ReactNode;
  iconBg      : string;
  iconText    : string;
  borderCls   : string;
  bgCls       : string;
  labelCls    : string;
  badgeCls    : string;
  pillCls     : string;
  description : string;
  subjects    : string[];
  applicableTo: string;
}

const DEPT_META: Record<string, DeptMeta> = {
  General: {
    icon        : <Globe size={20} />,
    iconBg      : 'bg-[#E7FBEE] border-[#86EFAC]',
    iconText    : 'text-[#15803D]',
    borderCls   : 'border-[#86EFAC]',
    bgCls       : 'bg-[#E7FBEE]',
    labelCls    : 'text-[#15803D]',
    badgeCls    : 'bg-[#D1F5DE] text-[#15803D] border-[#86EFAC]',
    pillCls     : 'bg-[#E7FBEE] border-[#86EFAC] text-[#15803D]',
    description : 'Core subjects required by ALL students across every class level and every department track.',
    subjects    : ['Mathematics', 'English Language', 'Civic Education', 'Physical & Health Education'],
    applicableTo: 'JSS1 – SS3 (all students)',
  },
  Science: {
    icon        : <FlaskConical size={20} />,
    iconBg      : 'bg-[#EFF6FF] border-[#BAE6FD]',
    iconText    : 'text-[#0369A1]',
    borderCls   : 'border-[#BAE6FD]',
    bgCls       : 'bg-[#EFF6FF]',
    labelCls    : 'text-[#0369A1]',
    badgeCls    : 'bg-[#DBEAFE] text-[#0369A1] border-[#BAE6FD]',
    pillCls     : 'bg-[#EFF6FF] border-[#BAE6FD] text-[#0369A1]',
    description : 'STEM-focused track for students pursuing sciences at SS level.',
    subjects    : ['Physics', 'Chemistry', 'Biology', 'Further Mathematics', 'Agricultural Science'],
    applicableTo: 'SS1 – SS3 only',
  },
  Art: {
    icon        : <Palette size={20} />,
    iconBg      : 'bg-[#F5F3FF] border-[#DDD6FE]',
    iconText    : 'text-[#7C3AED]',
    borderCls   : 'border-[#DDD6FE]',
    bgCls       : 'bg-[#F5F3FF]',
    labelCls    : 'text-[#7C3AED]',
    badgeCls    : 'bg-[#EDE9FE] text-[#7C3AED] border-[#DDD6FE]',
    pillCls     : 'bg-[#F5F3FF] border-[#DDD6FE] text-[#7C3AED]',
    description : 'Humanities and creative arts track for students in the arts specialisation.',
    subjects    : ['Literature-in-English', 'Government', 'History', 'Christian Religious Studies', 'Fine Art'],
    applicableTo: 'SS1 – SS3 only',
  },
  Commercial: {
    icon        : <Briefcase size={20} />,
    iconBg      : 'bg-[#FFFBEB] border-[#FCD34D]',
    iconText    : 'text-[#92400E]',
    borderCls   : 'border-[#FCD34D]',
    bgCls       : 'bg-[#FFFBEB]',
    labelCls    : 'text-[#92400E]',
    badgeCls    : 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
    pillCls     : 'bg-[#FFFBEB] border-[#FCD34D] text-[#92400E]',
    description : 'Business and commerce track preparing students for commercial careers.',
    subjects    : ['Financial Accounting', 'Commerce', 'Economics', 'Office Practice', 'Marketing'],
    applicableTo: 'SS1 – SS3 only',
  },
};


// ================================================================
//  CLASS TIER METADATA
// ================================================================

interface ClassTierMeta {
  label      : string;
  range      : string;
  description: string;
  labelCls   : string;
  bgCls      : string;
  borderCls  : string;
  dotCls     : string;
  countBg    : string;
 
}

const CLASS_TIER: Record<string, ClassTierMeta> = {
  JSS1: { label: 'Junior Secondary 1', range: 'Year 7',  description: 'Entry year into secondary school.',             labelCls: 'text-[#15803D]', bgCls: 'bg-[#E7FBEE]', borderCls: 'border-[#86EFAC]', dotCls: 'bg-[#22B85C]', countBg: 'bg-[#D1F5DE] text-[#15803D] border-[#86EFAC]' },
  JSS2: { label: 'Junior Secondary 2', range: 'Year 8',  description: 'Continuation of junior secondary.',             labelCls: 'text-[#15803D]', bgCls: 'bg-[#E7FBEE]', borderCls: 'border-[#86EFAC]', dotCls: 'bg-[#22B85C]', countBg: 'bg-[#D1F5DE] text-[#15803D] border-[#86EFAC]' },
  JSS3: { label: 'Junior Secondary 3', range: 'Year 9',  description: 'Final year before BECE/Junior WAEC.',           labelCls: 'text-[#15803D]', bgCls: 'bg-[#E7FBEE]', borderCls: 'border-[#86EFAC]', dotCls: 'bg-[#22B85C]', countBg: 'bg-[#D1F5DE] text-[#15803D] border-[#86EFAC]' },
  SS1 : { label: 'Senior Secondary 1', range: 'Year 10', description: 'First year of senior secondary. Tracks apply.', labelCls: 'text-[#0369A1]', bgCls: 'bg-[#EFF6FF]', borderCls: 'border-[#BAE6FD]', dotCls: 'bg-[#0369A1]', countBg: 'bg-[#DBEAFE] text-[#0369A1] border-[#BAE6FD]' },
  SS2 : { label: 'Senior Secondary 2', range: 'Year 11', description: 'Intermediate year. WAEC/NECO preparation.',     labelCls: 'text-[#0369A1]', bgCls: 'bg-[#EFF6FF]', borderCls: 'border-[#BAE6FD]', dotCls: 'bg-[#0369A1]', countBg: 'bg-[#DBEAFE] text-[#0369A1] border-[#BAE6FD]' },
  SS3 : { label: 'Senior Secondary 3', range: 'Year 12', description: 'Final year. WAEC/NECO examinations.',           labelCls: 'text-[#0369A1]', bgCls: 'bg-[#EFF6FF]', borderCls: 'border-[#BAE6FD]', dotCls: 'bg-[#0369A1]', countBg: 'bg-[#DBEAFE] text-[#0369A1] border-[#BAE6FD]' },
};

const JSS_CLASSES = ['JSS1', 'JSS2', 'JSS3'];


// ================================================================
//  GROUPING HELPER
// ================================================================

interface ClassGroup {
  cls   : ClassLevel;
  byDept: Map<string, SubjectRecord[]>;
  total : number;
}

function groupSubjectsByClass(
  subjects   : SubjectRecord[],
  classes    : ClassLevel[],
): Map<number, ClassGroup> {
  const map = new Map<number, ClassGroup>();

  for (const cls of classes) {
    map.set(cls.id, { cls, byDept: new Map<string, SubjectRecord[]>(), total: 0 });
  }

  for (const subject of subjects) {
    const group = map.get(subject.class_id);
    if (group === undefined) continue;

    const deptList = group.byDept.get(subject.department_name) ?? [];
    deptList.push(subject);
    group.byDept.set(subject.department_name, deptList);
    group.total += 1;
  }

  return map;
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


// ================================================================
//  CONFIRM DIALOG
// ================================================================

function ConfirmDialog({
  title, message, confirmLabel, isLoading, onConfirm, onCancel,
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


// ================================================================
//  CREATE SUBJECT MODAL
// ================================================================

function CreateSubjectModal({
  classes, departments, onClose, onCreated,
}: {
  classes    : ClassLevel[];
  departments: Department[];
  onClose    : () => void;
  onCreated  : (subject: SubjectRecord) => void;
}): React.JSX.Element {
  const [name,         setName]         = useState<string>('');
  const [classId,      setClassId]      = useState<string>('');
  const [deptId,       setDeptId]       = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [apiError,     setApiError]     = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect((): void => { nameRef.current?.focus(); }, []);
  useEffect((): (() => void) => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return (): void => document.removeEventListener('keydown', h);
  }, [onClose]);

  const selectedClassName = classes.find((c) => String(c.id) === classId)?.name ?? '';
  const isJss             = JSS_CLASSES.includes(selectedClassName);
  const generalDept       = departments.find((d) => d.name === 'General');
  const availableDepts    = isJss ? departments.filter((d) => d.name === 'General') : departments;

  useEffect((): void => {
    if (isJss && generalDept !== undefined) {
      setDeptId(String(generalDept.id));
      setErrors((p) => ({ ...p, deptId: '' }));
    }
  }, [isJss, generalDept]);

  useEffect((): void => {
    if (!isJss && classId !== '') setDeptId('');
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim())             e.name    = 'Subject name is required.';
    if (name.trim().length > 120) e.name    = 'Name must not exceed 120 characters.';
    if (!classId)                 e.classId = 'Select a class level.';
    if (!deptId)                  e.deptId  = 'Select a department.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setApiError(null);
    try {
      const res = await axiosInstance.post<CreateSubjectResponse>(
        '/api/admin/subjects',
        { name: name.trim(), class_id: parseInt(classId, 10), department_id: parseInt(deptId, 10) }
      );
      if (res.data.success) onCreated(res.data.subject);
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { status?: number; data?: { message?: string } } };
        setApiError(
          err.response?.status === 409
            ? 'This subject already exists for the selected class and department.'
            : (err.response?.data?.message ?? 'Failed to create subject. Please try again.')
        );
      } else {
        setApiError('Failed to create subject. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldCls = (f: string): string => [
    'w-full bg-white border-2 rounded-xl px-4 py-3.5 text-[#0B1F14] text-base',
    'placeholder:text-[#6B8479] focus:outline-none transition-all',
    errors[f] ? 'border-[#FCA5A5] focus:border-[#DC2626]' : 'border-[#D7F2E0] focus:border-[#4AE17A]',
  ].join(' ');

  const selectCls = (f: string, empty: boolean): string => [
    'appearance-none w-full bg-white border-2 rounded-xl pl-4 pr-9 py-3.5 text-base',
    'focus:outline-none transition-all cursor-pointer disabled:opacity-50',
    errors[f] ? 'border-[#FCA5A5]' : 'border-[#D7F2E0] focus:border-[#4AE17A]',
    empty ? 'text-[#6B8479]' : 'text-[#0B1F14]',
  ].join(' ');

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0B1F14]/50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
        <div className="w-full max-w-md bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl my-4">

          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center">
                <Tag size={17} className="text-[#15803D]" />
              </div>
              <h2 className="text-[#0B1F14] text-lg font-bold">Create Subject</h2>
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

            {/* Subject name */}
            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">Subject Name</label>
              <input
                ref         = {nameRef}
                type        = "text"
                value       = {name}
                onChange    = {(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })); }}
                disabled    = {isSubmitting}
                placeholder = "e.g., Mathematics, English Language, Physics"
                maxLength   = {120}
                className   = {fieldCls('name')}
              />
              <div className="flex items-center justify-between mt-1.5">
                {errors.name
                  ? <p className="text-[#991B1B] text-sm">{errors.name}</p>
                  : <span />
                }
                <p className="text-[#6B8479] text-sm">{name.trim().length}/120</p>
              </div>
            </div>

            {/* Class */}
            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">Class Level</label>
              <div className="relative">
                <select
                  value     = {classId}
                  onChange  = {(e) => { setClassId(e.target.value); setErrors((p) => ({ ...p, classId: '' })); }}
                  disabled  = {isSubmitting}
                  className = {selectCls('classId', classId === '')}
                >
                  <option value="" disabled>Select a class level…</option>
                  <optgroup label="Junior Secondary">
                    {classes.filter((c) => c.name.startsWith('JSS')).map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Senior Secondary">
                    {classes.filter((c) => c.name.startsWith('SS')).map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
              </div>
              {errors.classId && <p className="text-[#991B1B] text-sm mt-1.5">{errors.classId}</p>}
            </div>

            {/* Department */}
            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">Department Track</label>
              {isJss && (
                <div className="flex items-start gap-2.5 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-4 py-3 mb-3">
                  <Info size={14} className="text-[#15803D] flex-shrink-0 mt-0.5" />
                  <p className="text-[#15803D] text-sm leading-relaxed">
                    JSS classes only support the <strong>General</strong> department track. Department is auto-assigned.
                  </p>
                </div>
              )}
              <div className="relative">
                <select
                  value     = {deptId}
                  onChange  = {(e) => { setDeptId(e.target.value); setErrors((p) => ({ ...p, deptId: '' })); }}
                  disabled  = {isSubmitting || isJss}
                  className = {selectCls('deptId', deptId === '')}
                >
                  <option value="" disabled>
                    {isJss ? 'General (auto-assigned)' : 'Select a department…'}
                  </option>
                  {availableDepts.map((d) => (
                    <option key={d.id} value={String(d.id)}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
              </div>
              {errors.deptId && <p className="text-[#991B1B] text-sm mt-1.5">{errors.deptId}</p>}
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
                {isSubmitting ? 'Creating…' : 'Create Subject'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}


// ================================================================
//  SUBJECT ACCORDION ROW
// ================================================================

function SubjectAccordionRow({
  group,
  isOpen,
  onToggle,
  onDeleteRequest,
}: {
  group          : ClassGroup;
  isOpen         : boolean;
  onToggle       : () => void;
  onDeleteRequest: (subject: SubjectRecord) => void;
}): React.JSX.Element {
  const { cls, byDept, total } = group;
  const meta    = CLASS_TIER[cls.name];
  const isJss   = cls.name.startsWith('JSS');

  const deptOrder = ['General', 'Science', 'Art', 'Commercial'];
  const deptNames = deptOrder.filter((d) => byDept.has(d));

  return (
    <div className={[
      'border-2 rounded-2xl overflow-hidden transition-all',
      isOpen
        ? (meta?.borderCls ?? 'border-[#D7F2E0]')
        : 'border-[#D7F2E0]',
    ].join(' ')}>

      {/* ── Accordion trigger ─────────────────────────────── */}
      <button
        type      = "button"
        onClick   = {onToggle}
        className = {[
          'w-full flex items-center gap-4 px-5 py-4 text-left transition-colors',
          isOpen
            ? (meta?.bgCls ?? 'bg-[#F4FBF6]')
            : 'bg-white hover:bg-[#F4FBF6]',
        ].join(' ')}
      >
        {/* Coloured dot */}
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${meta?.dotCls ?? 'bg-[#6B8479]'}`} />

        {/* Class name */}
        <span className={`text-lg font-bold flex-shrink-0 ${meta?.labelCls ?? 'text-[#3D5347]'}`}>
          {cls.name}
        </span>

        {/* Year range */}
        {meta?.range !== undefined && (
          <span className="text-[#6B8479] text-base">{meta.range}</span>
        )}

        {/* JSS pill */}
        {isJss && (
          <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold flex-shrink-0">
            General only
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Subject count badge */}
        <span className={[
          'px-3 py-0.5 rounded-full text-sm font-bold border flex-shrink-0',
          total > 0
            ? (meta?.countBg ?? 'bg-[#F4FBF6] text-[#3D5347] border-[#D7F2E0]')
            : 'bg-[#F4FBF6] text-[#6B8479] border-[#D7F2E0]',
        ].join(' ')}>
          {total} {total === 1 ? 'subject' : 'subjects'}
        </span>

        {/* Chevron */}
        <ChevronDown
          size      = {18}
          className = {`text-[#6B8479] transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Expanded content ──────────────────────────────── */}
      {isOpen && (
        <div className={`border-t-2 ${meta?.borderCls ?? 'border-[#D7F2E0]'} ${meta?.bgCls ?? 'bg-[#F4FBF6]'} px-5 py-5`}>

          {/* Empty state for this class */}
          {total === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-white border border-[#D7F2E0] flex items-center justify-center mb-3">
                <BookOpen size={22} className="text-[#6B8479]" />
              </div>
              <p className="text-[#3D5347] text-base font-semibold">No subjects yet for {cls.name}</p>
              <p className="text-[#6B8479] text-sm mt-1">
                Click <strong>New Subject</strong> above and select {cls.name} to add one.
              </p>
            </div>
          )}

          {/* Department sub-groups */}
          {total > 0 && (
            <div className="space-y-5">
              {deptNames.map((deptName) => {
                const deptSubjects = byDept.get(deptName) ?? [];
                const dm           = DEPT_META[deptName];

                return (
                  <div key={deptName}>
                    {/* Department heading */}
                    <div className="flex items-center gap-2 mb-3">
                      {dm !== undefined && (
                        <div className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 ${dm.iconBg}`}>
                          <span className={`${dm.iconText} [&>svg]:w-3.5 [&>svg]:h-3.5`}>{dm.icon}</span>
                        </div>
                      )}
                      <span className={`text-sm font-bold ${dm?.labelCls ?? 'text-[#3D5347]'}`}>
                        {deptName}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${dm?.badgeCls ?? 'bg-[#F4FBF6] text-[#3D5347] border-[#D7F2E0]'}`}>
                        {deptSubjects.length}
                      </span>
                      <div className="flex-1 h-px bg-[#D7F2E0]" />
                    </div>

                    {/* Subject pills */}
                    <div className="flex flex-wrap gap-2">
                      {deptSubjects.map((subject) => (
                        <div
                          key       = {subject.subject_id}
                          className = {`flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border text-sm font-semibold ${dm?.pillCls ?? 'bg-white border-[#D7F2E0] text-[#3D5347]'}`}
                        >
                          <span>{subject.subject_name}</span>
                          <button
                            type      = "button"
                            title     = {`Delete ${subject.subject_name}`}
                            onClick   = {(e) => {
                              e.stopPropagation();
                              onDeleteRequest(subject);
                            }}
                            className = "w-5 h-5 rounded-lg flex items-center justify-center text-current opacity-40 hover:opacity-100 hover:bg-[#FEF2F2] hover:text-[#991B1B] transition-all flex-shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ================================================================
//  SUBJECTS PANEL (accordion version)
// ================================================================

function SubjectsPanel({
  classes,
  departments,
}: {
  classes    : ClassLevel[];
  departments: Department[];
}): React.JSX.Element {
  const [subjects,     setSubjects]     = useState<SubjectRecord[]>([]);
  const [isLoading,    setIsLoading]    = useState<boolean>(true);
  const [error,        setError]        = useState<string | null>(null);
  const [showModal,    setShowModal]    = useState<boolean>(false);
  const [toast,        setToast]        = useState<Toast | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubjectRecord | null>(null);
  const [isDeleting,   setIsDeleting]   = useState<boolean>(false);
  const [openClassIds, setOpenClassIds] = useState<Set<number>>(new Set<number>());

  const fetchSubjects = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get<SubjectListResponse>('/api/admin/subjects');
      if (res.data.success) setSubjects(res.data.subjects);
    } catch {
      setError('Failed to load subjects. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void fetchSubjects(); }, [fetchSubjects]);

  const handleDelete = async (): Promise<void> => {
    if (deleteTarget === null) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/api/admin/subjects/${deleteTarget.subject_id}`);
      setSubjects((prev) => prev.filter((s) => s.subject_id !== deleteTarget.subject_id));
      setToast({ type: 'success', message: `"${deleteTarget.subject_name}" deleted successfully.` });
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setToast({ type: 'error', message: err.response?.data?.message ?? 'Failed to delete subject.' });
      } else {
        setToast({ type: 'error', message: 'Failed to delete subject.' });
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const toggleClass = (id: number): void => {
    setOpenClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const grouped = groupSubjectsByClass(subjects, classes);

  const classOrder = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];
  const orderedClasses = classOrder
    .map((name) => classes.find((c) => c.name === name))
    .filter((c): c is ClassLevel => c !== undefined);

  const totalSubjects = subjects.length;

  return (
    <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

      {/* ── Panel header ────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
            <Tag size={18} className="text-[#15803D]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[#0B1F14] text-base font-bold">Subject Catalogue</h2>
              {!isLoading && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                  {totalSubjects} total
                </span>
              )}
            </div>
            <p className="text-[#6B8479] text-sm mt-0.5">
              Browsed by class level — click any row to expand and manage subjects.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type      = "button"
            onClick   = {() => void fetchSubjects()}
            disabled  = {isLoading}
            className = "p-2.5 rounded-xl bg-white border border-[#D7F2E0] text-[#3D5347] hover:border-[#22B85C] transition-all disabled:opacity-50"
            title     = "Refresh subjects"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            type      = "button"
            onClick   = {() => setShowModal(true)}
            className = "flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors"
          >
            <Plus size={17} />
            New Subject
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error !== null && (
        <div className="flex items-center gap-3 px-6 py-4 bg-[#FEF2F2] border-b border-[#FCA5A5]">
          <AlertCircle size={17} className="text-[#991B1B] flex-shrink-0" />
          <p className="text-[#991B1B] text-base font-medium">{error}</p>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────── */}
      {isLoading && (
        <div className="p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-[#F4FBF6] rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Accordion list ───────────────────────────────────── */}
      {!isLoading && error === null && (
        <div className="p-5 space-y-3">

          {/* JSS group header */}
          <div className="flex items-center gap-2 mb-1">
            <Layers size={14} className="text-[#15803D]" />
            <p className="text-[#15803D] text-sm font-bold uppercase tracking-wider">
              Junior Secondary School
            </p>
            <div className="flex-1 h-px bg-[#D1F5DE]" />
          </div>

          {orderedClasses
            .filter((c) => c.name.startsWith('JSS'))
            .map((cls) => {
              const group = grouped.get(cls.id);
              if (group === undefined) return null;
              return (
                <SubjectAccordionRow
                  key             = {cls.id}
                  group           = {group}
                  isOpen          = {openClassIds.has(cls.id)}
                  onToggle        = {() => toggleClass(cls.id)}
                  onDeleteRequest = {setDeleteTarget}
                />
              );
            })
          }

          {/* SS group header */}
          <div className="flex items-center gap-2 mt-5 mb-1">
            <Layers size={14} className="text-[#0369A1]" />
            <p className="text-[#0369A1] text-sm font-bold uppercase tracking-wider">
              Senior Secondary School
            </p>
            <div className="flex-1 h-px bg-[#DBEAFE]" />
          </div>

          {orderedClasses
            .filter((c) => c.name.startsWith('SS'))
            .map((cls) => {
              const group = grouped.get(cls.id);
              if (group === undefined) return null;
              return (
                <SubjectAccordionRow
                  key             = {cls.id}
                  group           = {group}
                  isOpen          = {openClassIds.has(cls.id)}
                  onToggle        = {() => toggleClass(cls.id)}
                  onDeleteRequest = {setDeleteTarget}
                />
              );
            })
          }
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <CreateSubjectModal
          classes     = {classes}
          departments = {departments}
          onClose     = {() => setShowModal(false)}
          onCreated   = {(subject) => {
            setSubjects((prev) => [...prev, subject]);
            setOpenClassIds((prev) => new Set([...prev, subject.class_id]));
            setShowModal(false);
            setToast({
              type   : 'success',
              message: `"${subject.subject_name}" created for ${subject.class_name} – ${subject.department_name}.`,
            });
          }}
        />
      )}

      {deleteTarget !== null && (
        <ConfirmDialog
          title        = {`Delete "${deleteTarget.subject_name}"?`}
          message      = {`This will permanently remove "${deleteTarget.subject_name}" (${deleteTarget.class_name} – ${deleteTarget.department_name}) from the subject catalogue. This cannot be undone. If any exam uses this subject, deletion will be blocked.`}
          confirmLabel = "Delete Subject"
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


// ================================================================
//  CLASS ACCORDION ROW (for the class levels panel)
// ================================================================

function ClassAccordionRow({
  cls, isOpen, onToggle,
}: {
  cls     : ClassLevel;
  isOpen  : boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const meta  = CLASS_TIER[cls.name];
  const isJss = cls.name.startsWith('JSS');

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${isOpen ? (meta?.borderCls ?? 'border-[#D7F2E0]') : 'border-[#D7F2E0]'}`}>
      <button
        type      = "button"
        onClick   = {onToggle}
        className = {`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isOpen ? (meta?.bgCls ?? 'bg-[#F4FBF6]') : 'bg-white hover:bg-[#F4FBF6]'}`}
      >
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta?.dotCls ?? 'bg-[#6B8479]'}`} />
        <span className={`text-base font-bold flex-shrink-0 ${meta?.labelCls ?? 'text-[#3D5347]'}`}>
          {cls.name}
        </span>
        {meta?.range !== undefined && (
          <span className="text-[#6B8479] text-sm">· {meta.range}</span>
        )}
        {isJss && (
          <span className="ml-auto mr-2 px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-xs font-semibold flex-shrink-0">
            General only
          </span>
        )}
        <ChevronDown
          size      = {16}
          className = {`text-[#6B8479] transition-transform duration-200 flex-shrink-0 ${isJss ? '' : 'ml-auto'} ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className={`px-5 py-4 border-t-2 ${meta?.borderCls ?? 'border-[#D7F2E0]'} ${meta?.bgCls ?? 'bg-[#F4FBF6]'}`}>
          {meta !== undefined ? (
            <div className="space-y-2">
              <p className={`text-base font-semibold ${meta.labelCls}`}>{meta.label}</p>
              <p className="text-[#3D5347] text-base leading-relaxed">{meta.description}</p>
              {/* <div className="flex items-center gap-2">
                <Layers size={13} className="text-[#6B8479]" />
                <p className="text-[#6B8479] text-sm">{meta.applicableTo}</p>
              </div> */}
              {isJss && (
                <div className="flex items-start gap-2 mt-1 bg-white border border-[#D7F2E0] rounded-xl px-3 py-2.5">
                  <Info size={13} className="text-[#6B8479] flex-shrink-0 mt-0.5" />
                  <p className="text-[#6B8479] text-sm leading-relaxed">
                    All JSS students are in the <strong className="text-[#0B1F14]">General</strong> track.
                    Department specialisations only apply from SS1 onwards.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[#6B8479] text-sm">No additional information available.</p>
          )}
        </div>
      )}
    </div>
  );
}


// ================================================================
//  MAIN PAGE
// ================================================================

export default function ClassDeptViewPage(): React.JSX.Element {
  const [classes,           setClasses]           = useState<ClassLevel[]>([]);
  const [departments,       setDepartments]       = useState<Department[]>([]);
  const [isLoading,         setIsLoading]         = useState<boolean>(true);
  const [error,             setError]             = useState<string | null>(null);
  const [openClassAccIds,   setOpenClassAccIds]   = useState<Set<number>>(new Set<number>());

  const fetchData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const [classRes, deptRes] = await Promise.all([
        axiosInstance.get<ClassListResponse>('/api/shared/classes'),
        axiosInstance.get<DeptListResponse>('/api/shared/departments'),
      ]);
      if (classRes.data.success) setClasses(classRes.data.classes);
      if (deptRes.data.success)  setDepartments(deptRes.data.departments);
    } catch {
      setError('Failed to load curriculum data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void fetchData(); }, [fetchData]);

  const toggleClassAcc = (id: number): void => {
    setOpenClassAccIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const jssClasses = classes.filter((c) => c.name.startsWith('JSS'));
  const ssClasses  = classes.filter((c) => c.name.startsWith('SS'));

  // ── Skeleton ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-64 bg-[#F4FBF6] rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-[#F4FBF6] rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6] animate-pulse">
                <div className="h-5 w-48 bg-[#E2E8F0] rounded" />
              </div>
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-14 bg-[#F4FBF6] rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-[#D7F2E0] rounded-2xl h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Classes, Departments & Subjects
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            West African curriculum structure. Classes and departments are system-defined.
            Subjects can be created and managed here.
          </p>
        </div>
        <button
          type      = "button"
          onClick   = {() => void fetchData()}
          className = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <p className="text-[#991B1B] text-base font-semibold">{error}</p>
        </div>
      )}

      {/* ── Routing banner ──────────────────────────────────── */}
      <div className="flex items-start gap-3 bg-[#EFF6FF] border border-[#BAE6FD] rounded-xl px-5 py-4">
        <Info size={18} className="text-[#0369A1] flex-shrink-0 mt-0.5" />
        <p className="text-[#0369A1] text-base leading-relaxed">
          The exam system routes questions to students based on their class level and department track.
          General-track exams are visible to all students in a class regardless of department.
          Track-specific exams are only visible to students in that track.
        </p>
      </div>

      {/* ── Classes + Departments grid ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Class levels — accordion */}
        <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
            <div className="w-9 h-9 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
              <GraduationCap size={18} className="text-[#15803D]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[#0B1F14] text-base font-bold">Academic Class Levels</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                  {classes.length}
                </span>
              </div>
              <p className="text-[#6B8479] text-sm mt-0.5">JSS1–SS3 · Click any row to expand</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {jssClasses.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={14} className="text-[#15803D]" />
                  <p className="text-[#15803D] text-sm font-bold uppercase tracking-wider">Junior Secondary School</p>
                  <div className="flex-1 h-px bg-[#D1F5DE]" />
                </div>
                <div className="space-y-2">
                  {jssClasses.map((cls) => (
                    <ClassAccordionRow
                      key      = {cls.id}
                      cls      = {cls}
                      isOpen   = {openClassAccIds.has(cls.id)}
                      onToggle = {() => toggleClassAcc(cls.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {ssClasses.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={14} className="text-[#0369A1]" />
                  <p className="text-[#0369A1] text-sm font-bold uppercase tracking-wider">Senior Secondary School</p>
                  <div className="flex-1 h-px bg-[#DBEAFE]" />
                </div>
                <div className="space-y-2">
                  {ssClasses.map((cls) => (
                    <ClassAccordionRow
                      key      = {cls.id}
                      cls      = {cls}
                      isOpen   = {openClassAccIds.has(cls.id)}
                      onToggle = {() => toggleClassAcc(cls.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl px-4 py-3">
              <Info size={14} className="text-[#6B8479] flex-shrink-0 mt-0.5" />
              <p className="text-[#6B8479] text-sm leading-relaxed">
                Department tracks only apply to Senior Secondary students (SS1–SS3).
                All JSS students are automatically placed in the General track.
              </p>
            </div>
          </div>
        </div>

        {/* Departments */}
        <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center flex-shrink-0">
              <BookOpen size={18} className="text-[#0369A1]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[#0B1F14] text-base font-bold">Curriculum Department Tracks</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#0369A1] text-sm font-semibold">
                  {departments.length}
                </span>
              </div>
              <p className="text-[#6B8479] text-sm mt-0.5">WASSCE/NECO subject groupings</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {departments.map((dept) => {
              const meta = DEPT_META[dept.name];
              if (meta === undefined) {
                return (
                  <div key={dept.id} className="p-4 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0]">
                    <p className="text-[#0B1F14] text-base font-semibold">{dept.name}</p>
                  </div>
                );
              }
              return (
                <div key={dept.id} className={`p-5 rounded-2xl border-2 ${meta.borderCls} ${meta.bgCls}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}>
                      <span className={meta.iconText}>{meta.icon}</span>
                    </div>
                    <div>
                      <p className={`text-base font-bold ${meta.labelCls}`}>{dept.name}</p>
                      <p className="text-[#6B8479] text-sm">{meta.applicableTo}</p>
                    </div>
                  </div>
                  <p className="text-[#3D5347] text-sm leading-relaxed mb-3">{meta.description}</p>
                  <div>
                    <p className="text-[#6B8479] text-xs font-semibold uppercase tracking-wide mb-2">Sample subjects</p>
                    <div className="flex flex-wrap gap-1.5">
                      {meta.subjects.map((subject) => (
                        <span
                          key       = {subject}
                          className = {`px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badgeCls}`}
                        >
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Subject Catalogue — accordion ───────────────────── */}
      <SubjectsPanel classes={classes} departments={departments} />

      {/* ── Routing explanation ──────────────────────────────── */}
      <div className="bg-white border border-[#D7F2E0] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center">
            <Info size={17} className="text-[#0369A1]" />
          </div>
          <h2 className="text-[#0B1F14] text-base font-bold">How Exam Routing Works</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#E7FBEE] border border-[#86EFAC] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ChevronRight size={14} className="text-[#15803D]" />
              <p className="text-[#15803D] text-sm font-bold uppercase tracking-wide">General Track Rule</p>
            </div>
            <p className="text-[#3D5347] text-base leading-relaxed">
              An exam mapped to any class + General department is visible to <strong>ALL</strong> students
              in that class regardless of their personal department track. Use this for Mathematics,
              English, and other core WAEC subjects.
            </p>
          </div>
          <div className="bg-[#EFF6FF] border border-[#BAE6FD] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ChevronRight size={14} className="text-[#0369A1]" />
              <p className="text-[#0369A1] text-sm font-bold uppercase tracking-wide">Track-Specific Rule</p>
            </div>
            <p className="text-[#3D5347] text-base leading-relaxed">
              An exam mapped to SS1 + Science is <strong>only</strong> visible to students enrolled in SS1 Science.
              An SS1 Art student will not see it. Create separate exams per department track
              to isolate content correctly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}