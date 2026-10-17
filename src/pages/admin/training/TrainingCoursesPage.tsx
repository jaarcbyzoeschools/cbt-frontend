// ================================================================
//  CBT SYSTEM — TRAINING COURSES
//  File   : src/pages/admin/training/TrainingCoursesPage.tsx
//  Route  : /dashboard/admin/training   (admin + super_admin)
//
//  Non-school exams for JAARC training courses. A course has
//  batches (cohorts); each batch has its own candidates and papers.
//  Opening a batch goes to TrainingBatchPage.
// ================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  GraduationCap,
  ListOrdered,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react';

import axiosInstance from '../../../api/axiosInstance';
import type { TrainingBatch, TrainingCourse } from '../../../types/training';
import {
  apiError,
  ConfirmDialog,
  Field,
  formatDate,
  iconBtn,
  dangerIconBtn,
  inputCls,
  Modal,
  primaryBtn,
  secondaryBtn,
  type Toast,
  Toggle,
  ToastNotification,
} from './trainingUi';

interface CoursesResponse { success: boolean; courses: TrainingCourse[] }
interface CourseResponse  { success: boolean; course: TrainingCourse }
interface BatchesResponse { success: boolean; batches: TrainingBatch[] }
interface BatchResponse   { success: boolean; batch: TrainingBatch }

type CourseForm = { id: number | null; name: string; description: string };
type BatchForm  = { courseId: number; name: string; start_date: string; end_date: string; papers_in_order: boolean };


// ── Batch list inside an expanded course ─────────────────────────

function BatchList({
  course, refreshKey, onNewBatch,
}: { course: TrainingCourse; refreshKey: number; onNewBatch: () => void }): React.JSX.Element {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<TrainingBatch[] | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  useEffect((): (() => void) => {
    let cancelled = false;
    setError(null);
    axiosInstance.get<BatchesResponse>(`/api/training/courses/${course.id}/batches`)
      .then((res) => { if (!cancelled) setBatches(res.data.batches); })
      .catch((e: unknown) => { if (!cancelled) setError(apiError(e, 'Failed to load batches.')); });
    return (): void => { cancelled = true; };
  }, [course.id, refreshKey]);

  return (
    <div className="border-t border-[#D7F2E0] bg-[#F4FBF6]">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <p className="text-[#3D5347] text-sm font-semibold uppercase tracking-wide">Batches</p>
        <button type="button" onClick={onNewBatch} className={`${secondaryBtn} !py-1.5 !px-3 text-sm`}>
          <Plus size={15} /> New Batch
        </button>
      </div>

      {error !== null && (
        <p className="px-5 pb-4 text-[#991B1B] text-base flex items-center gap-2"><AlertCircle size={16} /> {error}</p>
      )}
      {batches === null && error === null && (
        <div className="px-5 pb-4"><div className="h-12 rounded-xl bg-white animate-pulse" /></div>
      )}
      {batches !== null && batches.length === 0 && (
        <p className="px-5 pb-5 text-[#6B8479] text-base">
          No batches yet. A batch is one group of candidates sitting this course together, e.g. "October 2026".
        </p>
      )}
      {batches !== null && batches.length > 0 && (
        <ul className="px-3 pb-3 space-y-2">
          {batches.map((b) => {
            const period = [formatDate(b.start_date), formatDate(b.end_date)].filter(Boolean).join(' – ');
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/admin/training/batches/${b.id}`)}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-[#D7F2E0] hover:border-[#4AE17A] hover:shadow-sm transition-all text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0B1F14] text-base font-semibold truncate">{b.name}</p>
                    <p className="text-[#6B8479] text-sm flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                      {period !== '' && <span className="flex items-center gap-1"><Calendar size={12} />{period}</span>}
                      <span className="flex items-center gap-1"><Users size={12} />{b.candidate_count} candidate{b.candidate_count === 1 ? '' : 's'}</span>
                      <span className="flex items-center gap-1"><FileText size={12} />{b.paper_count} paper{b.paper_count === 1 ? '' : 's'}{b.active_paper_count > 0 ? ` (${b.active_paper_count} open)` : ''}</span>
                      {b.papers_in_order && <span className="flex items-center gap-1"><ListOrdered size={12} />In order</span>}
                    </p>
                  </div>
                  {b.results_released ? (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold"><Unlock size={12} />Released</span>
                  ) : (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#6B8479] text-sm font-semibold"><Lock size={12} />Results hidden</span>
                  )}
                  <ChevronRight size={18} className="text-[#6B8479] flex-shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


// ================================================================
//  PAGE
// ================================================================

export default function TrainingCoursesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [courses,   setCourses]   = useState<TrainingCourse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error,     setError]     = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState<Set<number>>(new Set<number>());
  const [batchRefresh, setBatchRefresh] = useState<Record<number, number>>({});

  const [courseForm, setCourseForm] = useState<CourseForm | null>(null);
  const [batchForm,  setBatchForm]  = useState<BatchForm | null>(null);
  const [saving,     setSaving]     = useState<boolean>(false);
  const [formError,  setFormError]  = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrainingCourse | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get<CoursesResponse>('/api/training/courses');
      setCourses(res.data.courses);
      // Open the only course automatically — saves a click
      if (res.data.courses.length === 1) setExpanded(new Set([res.data.courses[0].id]));
    } catch (e: unknown) {
      setError(apiError(e, 'Failed to load training courses.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void load(); }, [load]);

  const toggleExpanded = (id: number): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveCourse = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (courseForm === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const body = { name: courseForm.name, description: courseForm.description };
      if (courseForm.id === null) {
        const res = await axiosInstance.post<CourseResponse>('/api/training/courses', body);
        setToast({ type: 'success', message: `Course "${res.data.course.name}" created.` });
        setExpanded((prev) => new Set(prev).add(res.data.course.id));
      } else {
        await axiosInstance.patch<CourseResponse>(`/api/training/courses/${courseForm.id}`, body);
        setToast({ type: 'success', message: 'Course updated.' });
      }
      setCourseForm(null);
      await load();
    } catch (err: unknown) {
      setFormError(apiError(err, 'Failed to save course.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleCourseActive = async (c: TrainingCourse): Promise<void> => {
    try {
      await axiosInstance.patch(`/api/training/courses/${c.id}`, { is_active: !c.is_active });
      setToast({ type: 'success', message: c.is_active ? `"${c.name}" deactivated — its candidates can no longer log in.` : `"${c.name}" reactivated.` });
      await load();
    } catch (err: unknown) {
      setToast({ type: 'error', message: apiError(err, 'Failed to update course.') });
    }
  };

  const deleteCourse = async (): Promise<void> => {
    if (deleteTarget === null) return;
    setSaving(true);
    try {
      await axiosInstance.delete(`/api/training/courses/${deleteTarget.id}`);
      setToast({ type: 'success', message: `Course "${deleteTarget.name}" deleted.` });
      setDeleteTarget(null);
      await load();
    } catch (err: unknown) {
      setToast({ type: 'error', message: apiError(err, 'Failed to delete course.') });
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const saveBatch = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (batchForm === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await axiosInstance.post<BatchResponse>(`/api/training/courses/${batchForm.courseId}/batches`, {
        name           : batchForm.name,
        start_date     : batchForm.start_date || null,
        end_date       : batchForm.end_date || null,
        papers_in_order: batchForm.papers_in_order,
      });
      setBatchForm(null);
      setToast({ type: 'success', message: `Batch "${res.data.batch.name}" created.` });
      navigate(`/dashboard/admin/training/batches/${res.data.batch.id}`);
    } catch (err: unknown) {
      setFormError(apiError(err, 'Failed to create batch.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">Training Courses</h1>
          <p className="text-[#6B8479] text-base mt-1 max-w-2xl">
            CBT exams for training courses, taken by outside candidates (not school students).
            Results stay out of school scoreboards and report cards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load()} disabled={isLoading} className={iconBtn} title="Refresh">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button type="button" className={primaryBtn}
            onClick={() => { setFormError(null); setCourseForm({ id: null, name: '', description: '' }); }}>
            <Plus size={16} /> New Course
          </button>
        </div>
      </div>

      {error !== null && (
        <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B]" />
          <p className="text-[#991B1B] text-base">{error}</p>
        </div>
      )}

      {isLoading && courses.length === 0 ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-20 rounded-2xl bg-white border border-[#D7F2E0] animate-pulse" />)}</div>
      ) : courses.length === 0 && error === null ? (
        <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={26} className="text-[#15803D]" />
          </div>
          <p className="text-[#0B1F14] text-lg font-bold">No training courses yet</p>
          <p className="text-[#6B8479] text-base mt-1 max-w-md mx-auto">
            Create a course (e.g. "Web Development"), add a batch, then add candidates and papers.
          </p>
          <button type="button" className={`${primaryBtn} mt-5`}
            onClick={() => { setFormError(null); setCourseForm({ id: null, name: '', description: '' }); }}>
            <Plus size={16} /> Create your first course
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((c) => {
            const isOpen = expanded.has(c.id);
            return (
              <div key={c.id} className={`bg-white border rounded-2xl overflow-hidden ${c.is_active ? 'border-[#D7F2E0]' : 'border-[#D7F2E0] opacity-75'}`}>
                <div className="flex items-center gap-3 px-5 py-4">
                  <button type="button" onClick={() => toggleExpanded(c.id)} className="flex-1 min-w-0 flex items-center gap-4 text-left" aria-expanded={isOpen}>
                    <div className="w-11 h-11 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
                      <GraduationCap size={20} className="text-[#15803D]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#0B1F14] text-lg font-bold truncate flex items-center gap-2">
                        {c.name}
                        {!c.is_active && <span className="px-2 py-0.5 rounded-full bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs font-semibold">Inactive</span>}
                      </p>
                      <p className="text-[#6B8479] text-sm truncate">
                        {c.batch_count} batch{c.batch_count === 1 ? '' : 'es'} · {c.candidate_count} candidate{c.candidate_count === 1 ? '' : 's'}
                        {' · '}{c.branch_name ?? 'All branches'}
                        {c.description ? ` · ${c.description}` : ''}
                      </p>
                    </div>
                    <ChevronDown size={18} className={`ml-auto text-[#6B8479] flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button type="button" className={iconBtn} title="Edit course"
                      onClick={() => { setFormError(null); setCourseForm({ id: c.id, name: c.name, description: c.description ?? '' }); }}>
                      <Pencil size={16} />
                    </button>
                    <button type="button" className={iconBtn} title={c.is_active ? 'Deactivate course' : 'Reactivate course'}
                      onClick={() => void toggleCourseActive(c)}>
                      <Power size={16} />
                    </button>
                    <button type="button" className={dangerIconBtn} title="Delete course" onClick={() => setDeleteTarget(c)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <BatchList
                    course={c}
                    refreshKey={batchRefresh[c.id] ?? 0}
                    onNewBatch={() => {
                      setFormError(null);
                      setBatchForm({ courseId: c.id, name: '', start_date: '', end_date: '', papers_in_order: false });
                      setBatchRefresh((p) => ({ ...p, [c.id]: (p[c.id] ?? 0) + 1 }));
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Course form ───────────────────────────────────────── */}
      {courseForm !== null && (
        <Modal title={courseForm.id === null ? 'New Training Course' : 'Edit Course'} onClose={() => setCourseForm(null)}>
          <form onSubmit={(e) => void saveCourse(e)} className="space-y-4">
            <Field label="Course name">
              <input className={inputCls} value={courseForm.name} autoFocus maxLength={150} placeholder="e.g. Web Development"
                onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} />
            </Field>
            <Field label="Description (optional)">
              <textarea className={`${inputCls} min-h-[80px]`} value={courseForm.description} maxLength={2000}
                placeholder="e.g. 12-week frontend bootcamp: HTML, CSS, JavaScript, React"
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
            </Field>
            {formError !== null && <p className="text-[#991B1B] text-base flex items-center gap-2"><AlertCircle size={16} />{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className={secondaryBtn} onClick={() => setCourseForm(null)}>Cancel</button>
              <button type="submit" className={primaryBtn} disabled={saving || courseForm.name.trim() === ''}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                {courseForm.id === null ? 'Create Course' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Batch form ────────────────────────────────────────── */}
      {batchForm !== null && (
        <Modal title="New Batch" onClose={() => setBatchForm(null)}>
          <form onSubmit={(e) => void saveBatch(e)} className="space-y-4">
            <Field label="Batch name" hint="One group of candidates sitting the course together.">
              <input className={inputCls} value={batchForm.name} autoFocus maxLength={150} placeholder="e.g. October 2026"
                onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date (optional)">
                <input type="date" className={inputCls} value={batchForm.start_date}
                  onChange={(e) => setBatchForm({ ...batchForm, start_date: e.target.value })} />
              </Field>
              <Field label="End date (optional)">
                <input type="date" className={inputCls} value={batchForm.end_date}
                  onChange={(e) => setBatchForm({ ...batchForm, end_date: e.target.value })} />
              </Field>
            </div>
            <Toggle
              checked={batchForm.papers_in_order}
              onChange={(v) => setBatchForm({ ...batchForm, papers_in_order: v })}
              label="Papers must be taken in order"
              description="On: Paper 2 opens only after a candidate submits Paper 1 — good for one sitting. Off: you open each paper yourself, e.g. on different days."
            />
            {formError !== null && <p className="text-[#991B1B] text-base flex items-center gap-2"><AlertCircle size={16} />{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className={secondaryBtn} onClick={() => setBatchForm(null)}>Cancel</button>
              <button type="submit" className={primaryBtn} disabled={saving || batchForm.name.trim() === ''}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                Create Batch
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget !== null && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.name}"?`}
          message={deleteTarget.batch_count > 0
            ? 'This course still has batches, so it can\'t be deleted. Deactivate it instead to stop its candidates logging in.'
            : 'This cannot be undone.'}
          confirmLabel="Delete Course"
          isLoading={saving}
          onConfirm={() => void deleteCourse()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast !== null && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
