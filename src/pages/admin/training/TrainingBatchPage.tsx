// ================================================================
//  CBT SYSTEM — TRAINING BATCH
//  File   : src/pages/admin/training/TrainingBatchPage.tsx
//  Route  : /dashboard/admin/training/batches/:batchId
//
//  Everything for one cohort of a training course:
//    Papers      create, upload questions, open/close, copy from another batch
//    Candidates  add / Excel upload, PIN list, deactivate, reset a paper
//    Results     scores per paper, average, grade, position,
//                Excel export, Statement of Result PDFs, release
// ================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  ListOrdered,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  Unlock,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';

import axiosInstance from '../../../api/axiosInstance';
import type {
  BatchResultsResponse,
  PaperQuestion,
  TrainingBatch,
  TrainingCandidate,
  TrainingPaper,
} from '../../../types/training';
import {
  apiError,
  apiErrorFromBlob,
  ConfirmDialog,
  dangerIconBtn,
  downloadFile,
  Field,
  formatDate,
  GradeBadge,
  iconBtn,
  inputCls,
  Modal,
  ordinal,
  primaryBtn,
  secondaryBtn,
  type Toast,
  ToastNotification,
  Toggle,
} from './trainingUi';

type Tab = 'papers' | 'candidates' | 'results';

interface BatchResponse      { success: boolean; batch: TrainingBatch }
interface BatchesResponse    { success: boolean; batches: TrainingBatch[] }
interface PapersResponse     { success: boolean; papers: TrainingPaper[] }
interface PaperResponse      { success: boolean; paper: TrainingPaper }
interface CandidatesResponse { success: boolean; candidates: TrainingCandidate[] }
interface CandidateResponse  { success: boolean; candidate: TrainingCandidate }
interface QuestionsResponse  { success: boolean; questions: PaperQuestion[] }
interface UploadQuestionsResponse {
  success: boolean; message: string; inserted_count: number; error_count: number;
  row_errors?: { row?: number; errors?: string[] }[];
}
interface UploadCandidatesResponse { success: boolean; created_count: number }
interface UploadCandidatesError { row: number; errors: string[] }

type PaperForm = { id: number | null; title: string; duration_minutes: string; total_questions_to_show: string; paper_order: string };
type CandidateForm = { id: number | null; full_name: string; phone: string; email: string; gender: '' | 'Male' | 'Female'; is_active: boolean };

const emptyCandidate: CandidateForm = { id: null, full_name: '', phone: '', email: '', gender: '', is_active: true };


// ================================================================
//  PAPERS TAB
// ================================================================

function PapersTab({
  batch, papers, reload, notify,
}: {
  batch: TrainingBatch; papers: TrainingPaper[] | null;
  reload: () => Promise<void>; notify: (t: Toast) => void;
}): React.JSX.Element {
  const [form,      setForm]      = useState<PaperForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy,      setBusy]      = useState<number | 'form' | 'copy' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrainingPaper | null>(null);
  const [viewPaper, setViewPaper] = useState<TrainingPaper | null>(null);
  const [questions, setQuestions] = useState<PaperQuestion[] | null>(null);
  const [clearTarget, setClearTarget] = useState<TrainingPaper | null>(null);
  const [copyOpen,  setCopyOpen]  = useState<boolean>(false);
  const [siblings,  setSiblings]  = useState<TrainingBatch[] | null>(null);
  const [copyFrom,  setCopyFrom]  = useState<string>('');
  const [uploadErrors, setUploadErrors] = useState<{ title: string; lines: string[] } | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const openNew = (): void => {
    setFormError(null);
    const next = (papers ?? []).reduce((m, p) => Math.max(m, p.paper_order ?? 0), 0) + 1;
    setForm({ id: null, title: `Paper ${next}: `, duration_minutes: '30', total_questions_to_show: '20', paper_order: String(next) });
  };

  const savePaper = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (form === null) return;
    setBusy('form');
    setFormError(null);
    const body = {
      title                  : form.title,
      duration_minutes       : Number(form.duration_minutes),
      total_questions_to_show: Number(form.total_questions_to_show),
      paper_order            : form.paper_order === '' ? null : Number(form.paper_order),
    };
    try {
      if (form.id === null) {
        await axiosInstance.post<PaperResponse>(`/api/training/batches/${batch.id}/papers`, body);
      } else {
        await axiosInstance.patch<PaperResponse>(`/api/training/papers/${form.id}`, body);
      }
      // Refresh first, so the list is up to date before the dialog
      // closes (the next "Add Paper" then numbers correctly).
      await reload();
      setForm(null);
      notify({ type: 'success', message: form.id === null ? 'Paper created. Upload its questions next.' : 'Paper updated.' });
    } catch (err: unknown) {
      setFormError(apiError(err, 'Failed to save paper.'));
    } finally {
      setBusy(null);
    }
  };

  const toggleOpen = async (p: TrainingPaper): Promise<void> => {
    setBusy(p.id);
    try {
      await axiosInstance.post(`/api/training/papers/${p.id}/toggle`, { is_active: !p.is_active });
      await reload();
      notify({ type: 'success', message: p.is_active ? `"${p.title}" closed.` : `"${p.title}" is now open to candidates.` });
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to update paper.') });
    } finally {
      setBusy(null);
    }
  };

  const uploadQuestions = async (p: TrainingPaper, file: File): Promise<void> => {
    setBusy(p.id);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axiosInstance.post<UploadQuestionsResponse>(
        `/api/upload/questions?exam_id=${p.id}`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      await reload();
      notify({ type: 'success', message: `${res.data.inserted_count} question(s) added to "${p.title}".` });
      if (res.data.error_count > 0 && Array.isArray(res.data.row_errors)) {
        setUploadErrors({
          title: `${res.data.error_count} row(s) were skipped`,
          lines: res.data.row_errors.map((r) => `Row ${r.row ?? '?'}: ${(r.errors ?? []).join('; ')}`),
        });
      }
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Upload failed.') });
    } finally {
      setBusy(null);
      const input = fileInputs.current[p.id];
      if (input) input.value = '';
    }
  };

  const showQuestions = async (p: TrainingPaper): Promise<void> => {
    setViewPaper(p);
    setQuestions(null);
    try {
      const res = await axiosInstance.get<QuestionsResponse>(`/api/training/papers/${p.id}/questions`);
      setQuestions(res.data.questions);
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to load questions.') });
      setViewPaper(null);
    }
  };

  const clearQuestions = async (): Promise<void> => {
    if (clearTarget === null) return;
    setBusy(clearTarget.id);
    try {
      await axiosInstance.delete(`/api/training/papers/${clearTarget.id}/questions`);
      await reload();
      notify({ type: 'success', message: `Questions removed from "${clearTarget.title}". It has been closed.` });
      setClearTarget(null);
      setViewPaper(null);
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to clear questions.') });
      setClearTarget(null);
    } finally {
      setBusy(null);
    }
  };

  const deletePaper = async (): Promise<void> => {
    if (deleteTarget === null) return;
    setBusy(deleteTarget.id);
    try {
      await axiosInstance.delete(`/api/training/papers/${deleteTarget.id}`);
      await reload();
      notify({ type: 'success', message: `"${deleteTarget.title}" deleted.` });
      setDeleteTarget(null);
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to delete paper.') });
      setDeleteTarget(null);
    } finally {
      setBusy(null);
    }
  };

  const openCopy = async (): Promise<void> => {
    setCopyOpen(true);
    setCopyFrom('');
    setSiblings(null);
    try {
      const res = await axiosInstance.get<BatchesResponse>(`/api/training/courses/${batch.course_id}/batches`);
      setSiblings(res.data.batches.filter((b) => b.id !== batch.id && b.paper_count > 0));
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to load batches.') });
      setCopyOpen(false);
    }
  };

  const doCopy = async (): Promise<void> => {
    if (copyFrom === '') return;
    setBusy('copy');
    try {
      const res = await axiosInstance.post<{ papers_copied: number; questions_copied: number }>(
        `/api/training/batches/${batch.id}/copy-papers`, { from_batch_id: Number(copyFrom) }
      );
      await reload();
      notify({ type: 'success', message: `Copied ${res.data.papers_copied} paper(s) with ${res.data.questions_copied} questions. Open them when ready.` });
      setCopyOpen(false);
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to copy papers.') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={primaryBtn} onClick={openNew}><Plus size={16} /> Add Paper</button>
        <button type="button" className={secondaryBtn} onClick={() => void openCopy()}><Copy size={16} /> Copy from another batch</button>
        <a href="/templates/question_upload_template.xlsx" download className={secondaryBtn}>
          <FileSpreadsheet size={16} /> Question template
        </a>
      </div>

      <div className="flex items-start gap-3 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl px-4 py-3">
        <ListOrdered size={17} className="text-[#3D5347] mt-0.5 flex-shrink-0" />
        <p className="text-[#3D5347] text-sm leading-relaxed">
          {batch.papers_in_order
            ? 'Papers run in order: a candidate must submit each paper before the next one opens for them. Open all papers for a one-sitting exam.'
            : 'Papers are independent: candidates can take any open paper. Open each paper on the day it is written.'}
          {' '}Each paper uses the same question template as school exams (Question Text, Option A–D, Correct Answer).
        </p>
      </div>

      {papers === null ? (
        <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-20 rounded-2xl bg-white border border-[#D7F2E0] animate-pulse" />)}</div>
      ) : papers.length === 0 ? (
        <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-12 text-center">
          <FileText size={28} className="text-[#6B8479] mx-auto mb-3" />
          <p className="text-[#0B1F14] text-base font-bold">No papers yet</p>
          <p className="text-[#6B8479] text-sm mt-1">Add a paper for each part of the course, e.g. "Paper 1: HTML &amp; CSS".</p>
        </div>
      ) : (
        <div className="bg-white border border-[#D7F2E0] rounded-2xl divide-y divide-[#D7F2E0] overflow-hidden">
          {papers.map((p, i) => {
            const short = p.question_count < p.total_questions_to_show;
            const isBusy = busy === p.id;
            return (
              <div key={p.id} className="px-5 py-4 flex flex-wrap items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0">
                  <span className="text-[#15803D] text-base font-bold">{p.paper_order ?? i + 1}</span>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[#0B1F14] text-base font-semibold flex flex-wrap items-center gap-2">
                    {p.title}
                    {p.is_active
                      ? <span className="px-2 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-xs font-bold">OPEN</span>
                      : <span className="px-2 py-0.5 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#6B8479] text-xs font-bold">CLOSED</span>}
                  </p>
                  <p className="text-[#6B8479] text-sm flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    <span className="flex items-center gap-1"><Clock size={12} />{p.duration_minutes} min</span>
                    <span className={short ? 'text-[#92400E] font-semibold' : ''}>
                      {p.question_count} question{p.question_count === 1 ? '' : 's'} uploaded · shows {p.total_questions_to_show}
                    </span>
                    <span>{p.submitted_count} submitted</span>
                    {p.in_progress_count > 0 && <span className="text-[#0369A1] font-semibold">{p.in_progress_count} writing now</span>}
                  </p>
                  {short && (
                    <p className="text-[#92400E] text-sm mt-1 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> Upload at least {p.total_questions_to_show - p.question_count} more question(s), or lower "questions shown", before opening.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    ref={(el) => { fileInputs.current[p.id] = el; }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadQuestions(p, f); }} />
                  <button type="button" className={iconBtn} title="Upload questions (Excel)" disabled={isBusy}
                    onClick={() => fileInputs.current[p.id]?.click()}>
                    {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  </button>
                  <button type="button" className={iconBtn} title="View questions" onClick={() => void showQuestions(p)}>
                    <Eye size={16} />
                  </button>
                  <button type="button" className={iconBtn} title="Edit paper"
                    onClick={() => { setFormError(null); setForm({ id: p.id, title: p.title, duration_minutes: String(p.duration_minutes), total_questions_to_show: String(p.total_questions_to_show), paper_order: p.paper_order === null ? '' : String(p.paper_order) }); }}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className={dangerIconBtn} title="Delete paper" onClick={() => setDeleteTarget(p)}>
                    <Trash2 size={16} />
                  </button>
                  <button type="button" disabled={isBusy} onClick={() => void toggleOpen(p)}
                    className={p.is_active
                      ? `${secondaryBtn} !py-2 !px-3 text-sm ml-1`
                      : `${primaryBtn} !py-2 !px-3 text-sm ml-1`}>
                    {p.is_active ? <><Lock size={14} /> Close</> : <><Unlock size={14} /> Open</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form !== null && (
        <Modal title={form.id === null ? 'Add Paper' : 'Edit Paper'} onClose={() => setForm(null)}>
          <form onSubmit={(e) => void savePaper(e)} className="space-y-4">
            <Field label="Paper title">
              <input className={inputCls} value={form.title} autoFocus maxLength={255}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Duration (min)">
                <input type="number" min={1} max={600} className={inputCls} value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
              </Field>
              <Field label="Questions shown">
                <input type="number" min={1} max={500} className={inputCls} value={form.total_questions_to_show}
                  onChange={(e) => setForm({ ...form, total_questions_to_show: e.target.value })} />
              </Field>
              <Field label="Order">
                <input type="number" min={1} max={100} className={inputCls} value={form.paper_order}
                  onChange={(e) => setForm({ ...form, paper_order: e.target.value })} />
              </Field>
            </div>
            <p className="text-[#6B8479] text-sm">
              Each candidate gets "questions shown" questions picked at random from everything uploaded to this paper.
            </p>
            {formError !== null && <p className="text-[#991B1B] text-base flex items-center gap-2"><AlertCircle size={16} />{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className={secondaryBtn} onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className={primaryBtn} disabled={busy === 'form' || form.title.trim() === ''}>
                {busy === 'form' && <Loader2 size={16} className="animate-spin" />}
                {form.id === null ? 'Add Paper' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewPaper !== null && (
        <Modal title={viewPaper.title} onClose={() => setViewPaper(null)} wide>
          {questions === null ? (
            <div className="flex items-center gap-2 text-[#6B8479]"><Loader2 size={16} className="animate-spin" /> Loading…</div>
          ) : questions.length === 0 ? (
            <p className="text-[#6B8479] text-base">No questions uploaded yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[#3D5347] text-base">{questions.length} question{questions.length === 1 ? '' : 's'}</p>
                {viewPaper.submitted_count === 0 && viewPaper.in_progress_count === 0 && (
                  <button type="button" className={`${secondaryBtn} !py-1.5 text-sm`} onClick={() => setClearTarget(viewPaper)}>
                    <Trash2 size={14} /> Remove all questions
                  </button>
                )}
              </div>
              <ol className="space-y-3">
                {questions.map((q, i) => (
                  <li key={q.id} className="border border-[#D7F2E0] rounded-xl p-4">
                    <p className="text-[#0B1F14] text-base font-semibold">{i + 1}. {q.question_text}</p>
                    <ul className="mt-2 grid sm:grid-cols-2 gap-1.5">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const text = q[`option_${opt.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
                        const correct = q.correct_option === opt;
                        return (
                          <li key={opt} className={`text-sm px-3 py-1.5 rounded-lg ${correct ? 'bg-[#E7FBEE] text-[#15803D] font-semibold' : 'text-[#3D5347]'}`}>
                            {opt}. {text} {correct && <CheckCircle2 size={13} className="inline -mt-0.5" />}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Modal>
      )}

      {copyOpen && (
        <Modal title="Copy papers from another batch" onClose={() => setCopyOpen(false)}>
          {siblings === null ? (
            <div className="flex items-center gap-2 text-[#6B8479]"><Loader2 size={16} className="animate-spin" /> Loading…</div>
          ) : siblings.length === 0 ? (
            <p className="text-[#6B8479] text-base">No other batch of this course has papers yet.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-[#3D5347] text-base">
                Every paper and its questions will be copied into <span className="font-semibold">{batch.name}</span>. Copies start closed.
              </p>
              <Field label="Copy from">
                <select className={inputCls} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                  <option value="">Choose a batch…</option>
                  {siblings.map((b) => <option key={b.id} value={String(b.id)}>{b.name} ({b.paper_count} papers)</option>)}
                </select>
              </Field>
              <div className="flex justify-end gap-3">
                <button type="button" className={secondaryBtn} onClick={() => setCopyOpen(false)}>Cancel</button>
                <button type="button" className={primaryBtn} disabled={copyFrom === '' || busy === 'copy'} onClick={() => void doCopy()}>
                  {busy === 'copy' && <Loader2 size={16} className="animate-spin" />} Copy Papers
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {uploadErrors !== null && (
        <Modal title={uploadErrors.title} onClose={() => setUploadErrors(null)}>
          <ul className="space-y-1.5 text-[#991B1B] text-sm">
            {uploadErrors.lines.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </Modal>
      )}

      {deleteTarget !== null && (
        <ConfirmDialog
          title={`Delete "${deleteTarget.title}"?`}
          message={deleteTarget.submitted_count > 0 || deleteTarget.in_progress_count > 0
            ? 'Candidates have already taken this paper, so it can\'t be deleted. Close it instead.'
            : `This deletes the paper and its ${deleteTarget.question_count} question(s). This cannot be undone.`}
          confirmLabel="Delete Paper"
          isLoading={busy === deleteTarget.id}
          onConfirm={() => void deletePaper()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {clearTarget !== null && (
        <ConfirmDialog
          title="Remove all questions?"
          message={`All ${clearTarget.question_count} question(s) in "${clearTarget.title}" will be deleted and the paper closed, so you can upload a corrected file.`}
          confirmLabel="Remove Questions"
          isLoading={busy === clearTarget.id}
          onConfirm={() => void clearQuestions()}
          onCancel={() => setClearTarget(null)}
        />
      )}
    </div>
  );
}


// ================================================================
//  CANDIDATES TAB
// ================================================================

function CandidatesTab({
  batch, papers, candidates, reload, notify,
}: {
  batch: TrainingBatch; papers: TrainingPaper[] | null; candidates: TrainingCandidate[] | null;
  reload: () => Promise<void>; notify: (t: Toast) => void;
}): React.JSX.Element {
  const [quick,     setQuick]     = useState<CandidateForm>(emptyCandidate);
  const [edit,      setEdit]      = useState<CandidateForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy,      setBusy]      = useState<string | null>(null);
  const [search,    setSearch]    = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<TrainingCandidate | null>(null);
  const [resetTarget,  setResetTarget]  = useState<TrainingCandidate | null>(null);
  const [resetPaper,   setResetPaper]   = useState<string>('');
  const [uploadErrors, setUploadErrors] = useState<UploadCandidatesError[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const paperTotal = papers?.length ?? 0;

  const filtered = useMemo((): TrainingCandidate[] => {
    const q = search.trim().toLowerCase();
    if (candidates === null) return [];
    if (q === '') return candidates;
    return candidates.filter((c) =>
      c.full_name.toLowerCase().includes(q) || c.login_pin.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [candidates, search]);

  const addQuick = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (quick.full_name.trim() === '') return;
    setBusy('quick');
    try {
      const res = await axiosInstance.post<CandidateResponse>(`/api/training/batches/${batch.id}/candidates`, {
        full_name: quick.full_name, phone: quick.phone, gender: quick.gender || null,
      });
      await reload();
      notify({ type: 'success', message: `${res.data.candidate.full_name} added — PIN ${res.data.candidate.login_pin}` });
      setQuick(emptyCandidate);
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to add candidate.') });
    } finally {
      setBusy(null);
    }
  };

  const upload = async (file: File): Promise<void> => {
    setBusy('upload');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axiosInstance.post<UploadCandidatesResponse>(
        `/api/training/batches/${batch.id}/candidates/upload`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      await reload();
      notify({ type: 'success', message: `${res.data.created_count} candidate(s) added with new PINs.` });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { errors?: UploadCandidatesError[] } } })?.response?.data;
      if (Array.isArray(data?.errors) && data.errors.length > 0) setUploadErrors(data.errors);
      notify({ type: 'error', message: apiError(err, 'Upload failed.') });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveEdit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (edit === null || edit.id === null) return;
    setBusy('edit');
    setFormError(null);
    try {
      await axiosInstance.patch(`/api/training/candidates/${edit.id}`, {
        full_name: edit.full_name, phone: edit.phone, email: edit.email,
        gender: edit.gender || null, is_active: edit.is_active,
      });
      await reload();
      notify({ type: 'success', message: 'Candidate updated.' });
      setEdit(null);
    } catch (err: unknown) {
      setFormError(apiError(err, 'Failed to update candidate.'));
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async (): Promise<void> => {
    if (deleteTarget === null) return;
    setBusy('delete');
    try {
      await axiosInstance.delete(`/api/training/candidates/${deleteTarget.id}`);
      await reload();
      notify({ type: 'success', message: `${deleteTarget.full_name} removed.` });
      setDeleteTarget(null);
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to remove candidate.') });
      setDeleteTarget(null);
    } finally {
      setBusy(null);
    }
  };

  const doReset = async (): Promise<void> => {
    if (resetTarget === null || resetPaper === '') return;
    setBusy('reset');
    try {
      const res = await axiosInstance.delete<{ removed_results: number; removed_sessions: number }>(
        `/api/training/candidates/${resetTarget.id}/papers/${resetPaper}`
      );
      const paper = papers?.find((p) => String(p.id) === resetPaper);
      notify({
        type: 'success',
        message: res.data.removed_results + res.data.removed_sessions > 0
          ? `${resetTarget.full_name} can now retake "${paper?.title ?? 'the paper'}".`
          : `${resetTarget.full_name} had not started that paper — nothing to reset.`,
      });
      setResetTarget(null);
      await reload();
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to reset paper.') });
    } finally {
      setBusy(null);
    }
  };

  const download = async (url: string, name: string, key: string): Promise<void> => {
    setBusy(key);
    try { await downloadFile(url, name); }
    catch (err: unknown) { notify({ type: 'error', message: await apiErrorFromBlob(err, 'Download failed.') }); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      {/* Add one */}
      <form onSubmit={(e) => void addQuick(e)} className="bg-white border border-[#D7F2E0] rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <Field label="Full name">
            <input className={inputCls} value={quick.full_name} maxLength={200} placeholder="e.g. Adewale Johnson"
              onChange={(e) => setQuick({ ...quick, full_name: e.target.value })} />
          </Field>
        </div>
        <div className="w-40">
          <Field label="Phone (optional)">
            <input className={inputCls} value={quick.phone} maxLength={30}
              onChange={(e) => setQuick({ ...quick, phone: e.target.value })} />
          </Field>
        </div>
        <div className="w-36">
          <Field label="Gender">
            <select className={inputCls} value={quick.gender}
              onChange={(e) => setQuick({ ...quick, gender: e.target.value as CandidateForm['gender'] })}>
              <option value="">—</option><option value="Male">Male</option><option value="Female">Female</option>
            </select>
          </Field>
        </div>
        <button type="submit" className={primaryBtn} disabled={busy === 'quick' || quick.full_name.trim() === ''}>
          {busy === 'quick' ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Add
        </button>
      </form>

      {/* Bulk tools */}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        <button type="button" className={secondaryBtn} disabled={busy === 'upload'} onClick={() => fileRef.current?.click()}>
          {busy === 'upload' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Upload from Excel
        </button>
        <button type="button" className={secondaryBtn} disabled={busy === 'tpl'}
          onClick={() => void download('/api/training/candidate-template', 'training_candidates_template.xlsx', 'tpl')}>
          <FileSpreadsheet size={16} /> Template
        </button>
        <button type="button" className={secondaryBtn} disabled={busy === 'pins' || (candidates?.length ?? 0) === 0}
          onClick={() => void download(`/api/training/batches/${batch.id}/candidates/export`, 'candidates.xlsx', 'pins')}>
          {busy === 'pins' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} PIN list (Excel)
        </button>
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B8479]" />
          <input className={`${inputCls} !pl-9 !py-2 w-56`} placeholder="Search name or PIN" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {candidates === null ? (
        <div className="h-40 rounded-2xl bg-white border border-[#D7F2E0] animate-pulse" />
      ) : candidates.length === 0 ? (
        <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-12 text-center">
          <Users size={28} className="text-[#6B8479] mx-auto mb-3" />
          <p className="text-[#0B1F14] text-base font-bold">No candidates yet</p>
          <p className="text-[#6B8479] text-sm mt-1">Add them one at a time above, or upload an Excel sheet (Full Name, Phone, Email, Gender).</p>
        </div>
      ) : (
        <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F4FBF6] border-b border-[#D7F2E0]">
              <tr className="text-[#3D5347] text-sm font-semibold">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">PIN</th>
                <th className="px-4 py-3 hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 hidden md:table-cell">Gender</th>
                <th className="px-4 py-3">Papers done</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4FBF6]">
              {filtered.map((c, i) => (
                <tr key={c.id} className={c.is_active ? '' : 'opacity-60'}>
                  <td className="px-4 py-3 text-[#6B8479] text-sm">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="text-[#0B1F14] text-base font-semibold">{c.full_name}</p>
                    {!c.is_active && <p className="text-[#991B1B] text-xs font-semibold">Deactivated — cannot log in</p>}
                  </td>
                  <td className="px-4 py-3"><span className="font-mono text-base font-bold text-[#15803D] tracking-wider">{c.login_pin}</span></td>
                  <td className="px-4 py-3 text-[#3D5347] text-sm hidden md:table-cell">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-[#3D5347] text-sm hidden md:table-cell">{c.gender ?? '—'}</td>
                  <td className="px-4 py-3 text-[#3D5347] text-sm">{c.papers_submitted} / {paperTotal}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <button type="button" className={iconBtn} title="Download Statement of Result"
                        disabled={busy === `st${c.id}`}
                        onClick={() => void download(`/api/training/candidates/${c.id}/statement`, `Statement_${c.full_name}.pdf`, `st${c.id}`)}>
                        {busy === `st${c.id}` ? <Loader2 size={16} className="animate-spin" /> : <Award size={16} />}
                      </button>
                      <button type="button" className={iconBtn} title="Let them retake a paper"
                        onClick={() => { setResetTarget(c); setResetPaper(''); }}>
                        <RotateCcw size={16} />
                      </button>
                      <button type="button" className={iconBtn} title="Edit"
                        onClick={() => { setFormError(null); setEdit({ id: c.id, full_name: c.full_name, phone: c.phone ?? '', email: c.email ?? '', gender: c.gender ?? '', is_active: c.is_active }); }}>
                        <Pencil size={16} />
                      </button>
                      <button type="button" className={dangerIconBtn} title="Remove" onClick={() => setDeleteTarget(c)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[#6B8479]">No candidate matches "{search}".</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {edit !== null && (
        <Modal title="Edit Candidate" onClose={() => setEdit(null)}>
          <form onSubmit={(e) => void saveEdit(e)} className="space-y-4">
            <Field label="Full name">
              <input className={inputCls} value={edit.full_name} maxLength={200} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><input className={inputCls} value={edit.phone} maxLength={30} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
              <Field label="Gender">
                <select className={inputCls} value={edit.gender} onChange={(e) => setEdit({ ...edit, gender: e.target.value as CandidateForm['gender'] })}>
                  <option value="">—</option><option value="Male">Male</option><option value="Female">Female</option>
                </select>
              </Field>
            </div>
            <Field label="Email"><input type="email" className={inputCls} value={edit.email} maxLength={150} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Toggle checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })}
              label="Can log in" description="Turn off to block this PIN without losing their results." />
            {formError !== null && <p className="text-[#991B1B] text-base flex items-center gap-2"><AlertCircle size={16} />{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className={secondaryBtn} onClick={() => setEdit(null)}>Cancel</button>
              <button type="submit" className={primaryBtn} disabled={busy === 'edit' || edit.full_name.trim() === ''}>
                {busy === 'edit' && <Loader2 size={16} className="animate-spin" />} Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {resetTarget !== null && (
        <Modal title={`Retake a paper — ${resetTarget.full_name}`} onClose={() => setResetTarget(null)}>
          <div className="space-y-4">
            <p className="text-[#3D5347] text-base">
              Use this if something went wrong (power cut, wrong person sat it). Their attempt and score for the chosen paper are
              deleted so they can sit it again.
            </p>
            <Field label="Paper">
              <select className={inputCls} value={resetPaper} onChange={(e) => setResetPaper(e.target.value)}>
                <option value="">Choose a paper…</option>
                {(papers ?? []).map((p) => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
              </select>
            </Field>
            <div className="flex justify-end gap-3">
              <button type="button" className={secondaryBtn} onClick={() => setResetTarget(null)}>Cancel</button>
              <button type="button" disabled={resetPaper === '' || busy === 'reset'} onClick={() => void doReset()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50">
                {busy === 'reset' && <Loader2 size={16} className="animate-spin" />} Reset Paper
              </button>
            </div>
          </div>
        </Modal>
      )}

      {uploadErrors !== null && (
        <Modal title="Some rows need fixing — nothing was saved" onClose={() => setUploadErrors(null)}>
          <ul className="space-y-1.5 text-sm">
            {uploadErrors.map((r) => (
              <li key={r.row} className="text-[#991B1B]"><span className="font-semibold">Row {r.row}:</span> {r.errors.join('; ')}</li>
            ))}
          </ul>
        </Modal>
      )}

      {deleteTarget !== null && (
        <ConfirmDialog
          title={`Remove ${deleteTarget.full_name}?`}
          message={deleteTarget.papers_submitted > 0
            ? 'This candidate has results, so they can\'t be removed. Edit them and turn off "Can log in" instead.'
            : 'Their PIN will stop working. This cannot be undone.'}
          confirmLabel="Remove"
          isLoading={busy === 'delete'}
          onConfirm={() => void doDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}


// ================================================================
//  RESULTS TAB
// ================================================================

function ResultsTab({
  batch, onReleaseChange, notify,
}: { batch: TrainingBatch; onReleaseChange: () => void; notify: (t: Toast) => void }): React.JSX.Element {
  const [data,  setData]  = useState<BatchResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy,  setBusy]  = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'position' | 'name'>('position');

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const res = await axiosInstance.get<BatchResultsResponse>(`/api/training/batches/${batch.id}/results`);
      setData(res.data);
    } catch (err: unknown) {
      setError(apiError(err, 'Failed to load results.'));
    }
  }, [batch.id]);

  useEffect((): void => { void load(); }, [load, batch.results_released]);

  const rows = useMemo(() => {
    if (data === null) return [];
    const r = [...data.rows];
    if (sortBy === 'name') r.sort((a, b) => a.candidate.full_name.localeCompare(b.candidate.full_name));
    else r.sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.candidate.full_name.localeCompare(b.candidate.full_name));
    return r;
  }, [data, sortBy]);

  const download = async (url: string, name: string, key: string): Promise<void> => {
    setBusy(key);
    try { await downloadFile(url, name); }
    catch (err: unknown) { notify({ type: 'error', message: await apiErrorFromBlob(err, 'Download failed.') }); }
    finally { setBusy(null); }
  };

  if (error !== null) {
    return <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4 text-[#991B1B]"><AlertCircle size={18} />{error}</div>;
  }
  if (data === null) {
    return <div className="h-48 rounded-2xl bg-white border border-[#D7F2E0] animate-pulse" />;
  }

  const s = data.summary;
  const stat = (label: string, value: string, tone = 'text-[#0B1F14]'): React.JSX.Element => (
    <div className="bg-white border border-[#D7F2E0] rounded-2xl px-4 py-3">
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[#6B8479] text-sm">{label}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stat('Candidates', String(s.candidates))}
        {stat('Sat at least one paper', String(s.sat_any))}
        {stat('Completed all papers', String(s.completed_all))}
        {stat('Batch average', s.batch_average === null ? '—' : `${s.batch_average.toFixed(1)}%`, 'text-[#15803D]')}
        {stat('Passed (40%+)', String(s.passed))}
      </div>

      <div className={`flex flex-wrap items-center gap-3 rounded-xl px-5 py-3.5 border ${batch.results_released ? 'bg-[#E7FBEE] border-[#86EFAC]' : 'bg-[#FFFBEB] border-[#FCD34D]'}`}>
        {batch.results_released ? <Unlock size={18} className="text-[#15803D]" /> : <Lock size={18} className="text-[#92400E]" />}
        <p className={`text-base flex-1 ${batch.results_released ? 'text-[#15803D]' : 'text-[#92400E]'}`}>
          {batch.results_released
            ? `Released ${batch.results_released_at ? new Date(batch.results_released_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} — candidates can see their scores and download their Statement of Result.`
            : 'Results are hidden from candidates. Statements you print now are marked PROVISIONAL.'}
        </p>
        <button type="button" onClick={onReleaseChange}
          className={batch.results_released ? secondaryBtn : primaryBtn}>
          {batch.results_released ? <><Lock size={16} /> Hide results</> : <><Unlock size={16} /> Release results</>}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={secondaryBtn} disabled={busy === 'xlsx'}
          onClick={() => void download(`/api/training/batches/${batch.id}/results/export`, 'results.xlsx', 'xlsx')}>
          {busy === 'xlsx' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Export Excel
        </button>
        <button type="button" className={secondaryBtn} disabled={busy === 'pdf' || s.candidates === 0}
          onClick={() => void download(`/api/training/batches/${batch.id}/statements`, 'statements.pdf', 'pdf')}>
          {busy === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <Award size={16} />} All Statements (PDF)
        </button>
        <button type="button" className={iconBtn} title="Refresh" onClick={() => void load()}><RefreshCw size={16} /></button>
        <div className="ml-auto flex items-center gap-2 text-sm text-[#3D5347]">
          Sort:
          <select className="bg-white border border-[#D7F2E0] rounded-lg px-2 py-1.5" value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'position' | 'name')}>
            <option value="position">Position</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {data.papers.length === 0 || data.rows.length === 0 ? (
        <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-12 text-center text-[#6B8479]">
          {data.papers.length === 0 ? 'Add papers to see results here.' : 'Add candidates to see results here.'}
        </div>
      ) : (
        <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F4FBF6] border-b border-[#D7F2E0]">
              <tr className="text-[#3D5347] text-sm font-semibold">
                <th className="px-3 py-3 w-14">Pos.</th>
                <th className="px-3 py-3 min-w-[180px] sticky left-0 bg-[#F4FBF6]">Candidate</th>
                {data.papers.map((p, i) => (
                  <th key={p.id} className="px-3 py-3 min-w-[110px]" title={p.title}>
                    P{p.paper_order ?? i + 1}<span className="block text-xs font-normal text-[#6B8479] truncate max-w-[140px]">{p.title.replace(/^Paper\s*\d+\s*:\s*/i, '')}</span>
                  </th>
                ))}
                <th className="px-3 py-3">Average</th>
                <th className="px-3 py-3">Grade</th>
                <th className="px-3 py-3">Remark</th>
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4FBF6]">
              {rows.map((r) => (
                <tr key={r.candidate.id}>
                  <td className="px-3 py-3 text-[#0B1F14] text-sm font-bold">{r.position !== null ? ordinal(r.position) : '—'}</td>
                  <td className="px-3 py-3 sticky left-0 bg-white">
                    <p className="text-[#0B1F14] text-base font-semibold">{r.candidate.full_name}</p>
                    <p className="text-[#6B8479] text-xs font-mono">{r.candidate.login_pin}</p>
                  </td>
                  {r.papers.map((c) => (
                    <td key={c.exam_id} className="px-3 py-3">
                      {c.taken ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#0B1F14] text-sm font-semibold tabular-nums">{(c.score_percentage ?? 0).toFixed(1)}%</span>
                          <GradeBadge grade={c.grade} />
                          {c.submitted_late === true && (
                            <span title="Time ran out before submit — autosaved answers were graded" className="text-[#92400E]"><Clock size={13} /></span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#991B1B] text-sm font-semibold">Absent</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-[#15803D] text-base font-bold tabular-nums">{r.papers_taken > 0 ? `${r.average.toFixed(2)}%` : '—'}</td>
                  <td className="px-3 py-3"><GradeBadge grade={r.grade} /></td>
                  <td className="px-3 py-3 text-[#3D5347] text-sm">
                    {r.remark}
                    {r.papers_taken > 0 && !r.complete && <span className="block text-xs text-[#92400E]">{r.papers_taken}/{r.papers_total} papers</span>}
                  </td>
                  <td className="px-3 py-3">
                    <button type="button" className={iconBtn} title="Statement of Result (PDF)" disabled={busy === `st${r.candidate.id}`}
                      onClick={() => void download(`/api/training/candidates/${r.candidate.id}/statement`, `Statement_${r.candidate.full_name}.pdf`, `st${r.candidate.id}`)}>
                      {busy === `st${r.candidate.id}` ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[#6B8479] text-sm">
        Grades use the school's A1–F9 scale. The average is over all {data.papers.length} paper(s); a paper not taken counts as 0 and shows as Absent.
        Position ranks everyone who sat at least one paper.
      </p>
    </div>
  );
}


// ================================================================
//  PAGE
// ================================================================

export default function TrainingBatchPage(): React.JSX.Element {
  const { batchId } = useParams<'batchId'>();
  const navigate = useNavigate();
  const id = Number(batchId);

  const [batch,      setBatch]      = useState<TrainingBatch | null>(null);
  const [papers,     setPapers]     = useState<TrainingPaper[] | null>(null);
  const [candidates, setCandidates] = useState<TrainingCandidate[] | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [tab,        setTab]        = useState<Tab>('papers');
  const [toast,      setToast]      = useState<Toast | null>(null);
  const [settings,   setSettings]   = useState<{ name: string; start_date: string; end_date: string; papers_in_order: boolean } | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [saving,     setSaving]     = useState<boolean>(false);
  const [releaseConfirm, setReleaseConfirm] = useState<boolean>(false);
  const [deleteBatch, setDeleteBatch] = useState<boolean>(false);

  const notify = useCallback((t: Toast): void => setToast(t), []);

  const loadBatch = useCallback(async (): Promise<void> => {
    try {
      const res = await axiosInstance.get<BatchResponse>(`/api/training/batches/${id}`);
      setBatch(res.data.batch);
    } catch (err: unknown) {
      setError(apiError(err, 'Failed to load batch.'));
    }
  }, [id]);

  const loadPapers = useCallback(async (): Promise<void> => {
    try {
      const res = await axiosInstance.get<PapersResponse>(`/api/training/batches/${id}/papers`);
      setPapers(res.data.papers);
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to load papers.') });
    }
  }, [id, notify]);

  const loadCandidates = useCallback(async (): Promise<void> => {
    try {
      const res = await axiosInstance.get<CandidatesResponse>(`/api/training/batches/${id}/candidates`);
      setCandidates(res.data.candidates);
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to load candidates.') });
    }
  }, [id, notify]);

  const reloadAll = useCallback(async (): Promise<void> => {
    await Promise.all([loadBatch(), loadPapers(), loadCandidates()]);
  }, [loadBatch, loadPapers, loadCandidates]);

  useEffect((): void => {
    if (!Number.isInteger(id) || id <= 0) { setError('Invalid batch.'); return; }
    void reloadAll();
  }, [id, reloadAll]);

  const saveSettings = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (settings === null) return;
    setSaving(true);
    setSettingsError(null);
    try {
      const res = await axiosInstance.patch<BatchResponse>(`/api/training/batches/${id}`, {
        name: settings.name,
        start_date: settings.start_date || null,
        end_date: settings.end_date || null,
        papers_in_order: settings.papers_in_order,
      });
      setBatch(res.data.batch);
      setSettings(null);
      notify({ type: 'success', message: 'Batch updated.' });
    } catch (err: unknown) {
      setSettingsError(apiError(err, 'Failed to update batch.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleRelease = async (): Promise<void> => {
    if (batch === null) return;
    setSaving(true);
    try {
      const res = await axiosInstance.post<BatchResponse>(`/api/training/batches/${id}/release`, { released: !batch.results_released });
      setBatch(res.data.batch);
      notify({ type: 'success', message: res.data.batch.results_released ? 'Results released to candidates.' : 'Results hidden from candidates.' });
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to update results release.') });
    } finally {
      setSaving(false);
      setReleaseConfirm(false);
    }
  };

  const doDeleteBatch = async (): Promise<void> => {
    setSaving(true);
    try {
      await axiosInstance.delete(`/api/training/batches/${id}`);
      navigate('/dashboard/admin/training', { replace: true });
    } catch (err: unknown) {
      notify({ type: 'error', message: apiError(err, 'Failed to delete batch.') });
      setDeleteBatch(false);
    } finally {
      setSaving(false);
    }
  };

  if (error !== null) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/dashboard/admin/training')} className="flex items-center gap-1.5 text-[#3D5347] text-sm font-semibold hover:text-[#15803D]">
          <ArrowLeft size={16} /> Training Courses
        </button>
        <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4 text-[#991B1B]"><AlertCircle size={18} />{error}</div>
      </div>
    );
  }

  if (batch === null) {
    return <div className="space-y-4"><div className="h-24 rounded-2xl bg-white border border-[#D7F2E0] animate-pulse" /><div className="h-64 rounded-2xl bg-white border border-[#D7F2E0] animate-pulse" /></div>;
  }

  const period = [formatDate(batch.start_date), formatDate(batch.end_date)].filter(Boolean).join(' – ');
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'papers',     label: 'Papers',     count: papers?.length },
    { key: 'candidates', label: 'Candidates', count: candidates?.length },
    { key: 'results',    label: 'Results' },
  ];

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => navigate('/dashboard/admin/training')} className="flex items-center gap-1.5 text-[#3D5347] text-sm font-semibold hover:text-[#15803D]">
        <ArrowLeft size={16} /> Training Courses
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[#6B8479] text-sm font-semibold uppercase tracking-wide">{batch.course_name}</p>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">{batch.name}</h1>
          <p className="text-[#6B8479] text-sm flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {period !== '' && <span className="flex items-center gap-1"><Calendar size={13} />{period}</span>}
            <span className="flex items-center gap-1"><ListOrdered size={13} />{batch.papers_in_order ? 'Papers in order' : 'Papers opened individually'}</span>
            <span className={`flex items-center gap-1 font-semibold ${batch.results_released ? 'text-[#15803D]' : 'text-[#92400E]'}`}>
              {batch.results_released ? <Unlock size={13} /> : <Lock size={13} />}
              {batch.results_released ? 'Results released' : 'Results hidden'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={secondaryBtn}
            onClick={() => { setSettingsError(null); setSettings({ name: batch.name, start_date: batch.start_date ?? '', end_date: batch.end_date ?? '', papers_in_order: batch.papers_in_order }); }}>
            <Settings size={16} /> Settings
          </button>
          <button type="button" className={batch.results_released ? secondaryBtn : primaryBtn} onClick={() => setReleaseConfirm(true)}>
            {batch.results_released ? <><Lock size={16} /> Hide results</> : <><Unlock size={16} /> Release results</>}
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-[#D7F2E0]">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={[
              'px-4 py-2.5 -mb-px border-b-2 text-base font-semibold transition-colors',
              tab === t.key ? 'border-[#4AE17A] text-[#0B1F14]' : 'border-transparent text-[#6B8479] hover:text-[#15803D]',
            ].join(' ')}>
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-xs">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'papers' && (
        <PapersTab batch={batch} papers={papers} notify={notify}
          reload={async () => { await Promise.all([loadPapers(), loadBatch()]); }} />
      )}
      {tab === 'candidates' && (
        <CandidatesTab batch={batch} papers={papers} candidates={candidates} notify={notify}
          reload={async () => { await Promise.all([loadCandidates(), loadBatch()]); }} />
      )}
      {tab === 'results' && (
        <ResultsTab batch={batch} notify={notify} onReleaseChange={() => setReleaseConfirm(true)} />
      )}

      {settings !== null && (
        <Modal title="Batch settings" onClose={() => setSettings(null)}>
          <form onSubmit={(e) => void saveSettings(e)} className="space-y-4">
            <Field label="Batch name">
              <input className={inputCls} value={settings.name} maxLength={150} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date"><input type="date" className={inputCls} value={settings.start_date} onChange={(e) => setSettings({ ...settings, start_date: e.target.value })} /></Field>
              <Field label="End date"><input type="date" className={inputCls} value={settings.end_date} onChange={(e) => setSettings({ ...settings, end_date: e.target.value })} /></Field>
            </div>
            <Toggle checked={settings.papers_in_order} onChange={(v) => setSettings({ ...settings, papers_in_order: v })}
              label="Papers must be taken in order"
              description="On: each paper opens only after the previous one is submitted. Off: you open papers yourself." />
            {settingsError !== null && <p className="text-[#991B1B] text-base flex items-center gap-2"><AlertCircle size={16} />{settingsError}</p>}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button type="button" onClick={() => { setSettings(null); setDeleteBatch(true); }}
                className="text-[#991B1B] text-sm font-semibold hover:underline">Delete batch</button>
              <div className="flex gap-3">
                <button type="button" className={secondaryBtn} onClick={() => setSettings(null)}>Cancel</button>
                <button type="submit" className={primaryBtn} disabled={saving || settings.name.trim() === ''}>
                  {saving && <Loader2 size={16} className="animate-spin" />} Save
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {releaseConfirm && (
        <ConfirmDialog
          title={batch.results_released ? 'Hide results again?' : 'Release results?'}
          message={batch.results_released
            ? 'Candidates will no longer see their scores or be able to download their Statement of Result.'
            : <>Candidates in <span className="font-semibold">{batch.name}</span> will see their scores, grades and position, and can download their Statement of Result.</>}
          confirmLabel={batch.results_released ? 'Hide Results' : 'Release Results'}
          danger={batch.results_released}
          isLoading={saving}
          onConfirm={() => void toggleRelease()}
          onCancel={() => setReleaseConfirm(false)}
        />
      )}

      {deleteBatch && (
        <ConfirmDialog
          title={`Delete "${batch.name}"?`}
          message={batch.candidate_count > 0 || batch.paper_count > 0
            ? 'Remove this batch\'s candidates and papers first — a batch with records can\'t be deleted.'
            : 'This cannot be undone.'}
          confirmLabel="Delete Batch"
          isLoading={saving}
          onConfirm={() => void doDeleteBatch()}
          onCancel={() => setDeleteBatch(false)}
        />
      )}

      {toast !== null && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
