// ================================================================
//  CBT SYSTEM — DATA COMPLETENESS PAGE
//  File    : src/pages/admin/DataCompletenessPage.tsx
//  Design  : Vibrant Institutional Light Mode (matches existing pages)
//
//  Confirmed scope: per-class view — pick a class, see its gaps
//  across every student in it. Admin/Super Admin only.
//
//  Deliberately read-only: fixing a gap happens on the existing
//  Enrolled Students page (click a name, edit). Wiring this page
//  directly into that edit modal would require extracting it out
//  of StudentEnrolmentPage.tsx into a shared file first — a real
//  piece of surgery on its own, not bundled into this pass.
// ================================================================

import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  Image as ImageIcon,
  IdCard,
  Cake,
  Users2,
  Droplet,
  Dna,
  MapPin,
  Phone,
} from 'lucide-react';

import axiosInstance        from '../../api/axiosInstance';
import { useBranchContext } from '../../../components/layout/StaffSidebar';
import { useAuth }          from '../../context/AuthContext';
import type { ClassLevel }  from '../../types/exam';


// ================================================================
//  TYPES
// ================================================================

interface ClassListResponse { success: boolean; classes: ClassLevel[] }

interface TrackedField { key: string; label: string }

interface CompletenessSummaryEntry { label: string; missing_count: number }

interface CompletenessStudent {
  student_id  : number;
  full_name   : string;
  login_pin   : string;
  missing_fields: string[];
  completeness_percent: number;
}

interface CompletenessResponse {
  success       : boolean;
  class_id      : number;
  class_name    : string;
  branch_id     : number;
  total_students: number;
  tracked_fields: TrackedField[];
  summary       : Record<string, CompletenessSummaryEntry>;
  students      : CompletenessStudent[];
}

const FIELD_ICONS: Record<string, React.ReactNode> = {
  photo_path       : <ImageIcon size={15} />,
  admission_number : <IdCard size={15} />,
  date_of_birth    : <Cake size={15} />,
  gender           : <Users2 size={15} />,
  blood_group      : <Droplet size={15} />,
  genotype         : <Dna size={15} />,
  state_of_origin  : <MapPin size={15} />,
  lga              : <MapPin size={15} />,
  contact_phone    : <Phone size={15} />,
};


// ================================================================
//  MAIN COMPONENT
// ================================================================

export default function DataCompletenessPage(): React.JSX.Element {
  const { role } = useAuth();
  const activeBranch = useBranchContext();
  const isSuperAdmin = role === 'super_admin';

  const [classes,    setClasses]    = useState<ClassLevel[]>([]);
  const [classId,    setClassId]    = useState<string>('');
  const [data,       setData]       = useState<CompletenessResponse | null>(null);
  const [isLoading,  setIsLoading]  = useState<boolean>(false);
  const [error,      setError]      = useState<string | null>(null);
  const [activeFilterField, setActiveFilterField] = useState<string | null>(null);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<ClassListResponse>('/api/shared/classes');
        if (res.data.success) setClasses(res.data.classes);
      } catch { /* non-fatal */ }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!classId) { setData(null); return; }
    if (isSuperAdmin && activeBranch === null) { setData(null); return; }

    let cancelled = false;
    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      setActiveFilterField(null);
      try {
        const branchId = isSuperAdmin ? activeBranch!.id : undefined;
        const qp = new URLSearchParams();
        qp.set('class_id', classId);
        if (branchId !== undefined) qp.set('branch_id', String(branchId));
        const res = await axiosInstance.get<CompletenessResponse>(`/api/teacher/students/completeness?${qp.toString()}`);
        if (!cancelled && res.data.success) setData(res.data);
      } catch (thrown: unknown) {
        if (cancelled) return;
        if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
          const err = thrown as { response?: { data?: { message?: string } } };
          setError(err.response?.data?.message ?? 'Failed to load data completeness.');
        } else {
          setError('Failed to load data completeness.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return (): void => { cancelled = true; };
  }, [classId, isSuperAdmin, activeBranch]);

  const filteredStudents = data !== null
    ? (activeFilterField === null
        ? data.students
        : data.students.filter((s) => s.missing_fields.includes(activeFilterField)))
    : [];

  const selCls = [
    'w-full appearance-none bg-white border-2 border-[#D7F2E0] rounded-xl px-4 py-3',
    'text-base text-[#0B1F14] focus:outline-none focus:border-[#4AE17A] transition-all',
    'cursor-pointer pr-11',
  ].join(' ');

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">Data Completeness</h1>
        <p className="text-[#6B8479] text-base mt-1">
          See which students in a class are missing key profile information.
        </p>
      </div>

      {isSuperAdmin && activeBranch === null && (
        <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-5 py-4">
          <AlertCircle size={17} className="text-[#92400E] flex-shrink-0 mt-0.5" />
          <p className="text-[#92400E] text-base">
            Select a branch from the Branch Context switcher in the sidebar first.
          </p>
        </div>
      )}

      <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-5">
        <label className="block text-[#3D5347] text-base font-semibold mb-3">Select a Class</label>
        <div className="relative max-w-xs">
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={selCls}>
            <option value="">Choose a class…</option>
            {classes.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
        </div>
      </div>

      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={17} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <p className="text-[#991B1B] text-base">{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-[#6B8479]">
          <Loader2 size={20} className="animate-spin" /> Loading…
        </div>
      )}

      {!isLoading && data !== null && (
        <>
          <div className="flex items-center gap-3 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl px-5 py-4">
            <ClipboardList size={17} className="text-[#3D5347] flex-shrink-0" />
            <p className="text-[#3D5347] text-base font-semibold">
              {data.class_name} — {data.total_students} active student{data.total_students === 1 ? '' : 's'}
            </p>
          </div>

          {/* Summary cards — click to filter the list below */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.tracked_fields.map(({ key, label }) => {
              const entry = data.summary[key];
              const isActive = activeFilterField === key;
              const hasGaps = entry.missing_count > 0;
              return (
                <button
                  key       = {key}
                  type      = "button"
                  onClick   = {() => setActiveFilterField(isActive ? null : key)}
                  className = {[
                    'text-left rounded-2xl border-2 px-4 py-3.5 transition-all',
                    isActive
                      ? 'border-[#4AE17A] bg-[#E7FBEE]'
                      : hasGaps
                        ? 'border-[#FCD34D] bg-[#FFFBEB] hover:border-[#F59E0B]'
                        : 'border-[#D7F2E0] bg-white hover:border-[#86EFAC]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-1.5 text-[#6B8479] mb-2">
                    {FIELD_ICONS[key]}
                    <span className="text-sm font-semibold">{label}</span>
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${hasGaps ? 'text-[#92400E]' : 'text-[#15803D]'}`}>
                    {entry.missing_count}
                  </p>
                  <p className="text-[#6B8479] text-sm mt-0.5">missing</p>
                </button>
              );
            })}
          </div>

          {activeFilterField !== null && (
            <div className="flex items-center gap-2">
              <p className="text-[#3D5347] text-sm">
                Showing students missing <span className="font-semibold">{data.summary[activeFilterField].label}</span>
              </p>
              <button type="button" onClick={() => setActiveFilterField(null)} className="text-[#15803D] text-sm font-semibold underline hover:opacity-80">
                Clear filter
              </button>
            </div>
          )}

          {/* Student list */}
          <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
            {filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <CheckCircle size={28} className="text-[#15803D] mb-3" />
                <p className="text-[#0B1F14] text-base font-bold">
                  {activeFilterField !== null ? 'No students missing this field' : 'No students in this class'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#F4FBF6]">
                {filteredStudents.map((s, i) => (
                  <div key={s.student_id} className={`flex items-center gap-4 px-6 py-3.5 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#0B1F14] text-base font-semibold truncate">{s.full_name}</p>
                      <p className="text-[#6B8479] text-sm font-mono">{s.login_pin}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-w-md justify-end">
                      {s.missing_fields.length === 0 ? (
                        <span className="px-2.5 py-1 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-xs font-semibold">
                          Complete
                        </span>
                      ) : (
                        s.missing_fields.map((f) => (
                          <span key={f} className="px-2.5 py-1 rounded-full bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E] text-xs font-semibold">
                            {data.summary[f].label}
                          </span>
                        ))
                      )}
                    </div>
                    <div className="w-14 text-right flex-shrink-0">
                      <span className={`text-sm font-bold tabular-nums ${s.completeness_percent === 100 ? 'text-[#15803D]' : 'text-[#92400E]'}`}>
                        {s.completeness_percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[#6B8479] text-sm text-center">
            To fix a gap, find the student on the Student Enrolment page and click their name to edit.
          </p>
        </>
      )}
    </div>
  );
}