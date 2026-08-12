// ================================================================
//  CBT SYSTEM — REPORT CARD GENERATION & APPROVAL PANEL


import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ClipboardCheck,
  Clock,
  Download,
  Edit3,
  Files,
} from 'lucide-react';


import axiosInstance from '../../src/api/axiosInstance';
import { useAuth } from '../../src/context/AuthContext';
import { useBranchContext } from '../layout/StaffSidebar';
import ReportCardSummaryModal from './ReportCardSummaryModal';
import type {
  ClassLevel,
  ActivePeriod,
  ReportCardStatus,
  GenerateReportCardsResponse,
  ApproveReportCardsResponse,
  ReportCardSummaryListItem,
  ListReportCardSummariesResponse,
} from '../../src/types/exam'

interface ReportCardPanelProps {
  onClose: () => void;
}

export default function ReportCardPanel({ onClose }: ReportCardPanelProps): React.JSX.Element {
  const { staffUser, role } = useAuth();
  const activeBranch = useBranchContext(); // super_admin only — null in global view

  const [period, setPeriod] = useState<ActivePeriod | null>(null);
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');

  const [status, setStatus] = useState<ReportCardStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generateResult, setGenerateResult] = useState<GenerateReportCardsResponse | null>(null);

  const [signatureName, setSignatureName] = useState<string>('');
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  // ── Phase 4: student data list + summary editor + PDF download ─
  const [summaries, setSummaries] = useState<ReportCardSummaryListItem[]>([]);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<ReportCardSummaryListItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // ── Bulk download — NEW ─────────────────────────────────────────
  const [isBulkDownloading, setIsBulkDownloading] = useState<boolean>(false);

  // Branch resolution: admins are locked to their own branch;
  // super_admins must pick one via the sidebar Branch Context switcher.
  const branchId: number | null =
    role === 'super_admin' ? (activeBranch?.id ?? null) : (staffUser?.branch_id ?? null);
  const branchName: string | null =
    role === 'super_admin' ? (activeBranch?.name ?? null) : null;

  // ── Initial data load ─────────────────────────────────────────

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const [periodRes, classesRes] = await Promise.all([
          axiosInstance.get<ActivePeriod>('/api/settings/active-period'),
          axiosInstance.get<{ success: boolean; classes: ClassLevel[] }>('/api/admin/classes'),
        ]);
        if (periodRes.data.success) setPeriod(periodRes.data);
        if (classesRes.data.success) setClasses(classesRes.data.classes);
      } catch {
        setError('Failed to load academic period or class list.');
      }
    };
    void load();
  }, []);

  // ── Status fetch — whenever class/branch/period are all known ──

  const fetchStatus = useCallback(async (): Promise<void> => {
    if (!period || selectedClassId === '' || branchId === null) {
      setStatus(null);
      return;
    }
    setIsLoadingStatus(true);
    setError(null);
    try {
      const res = await axiosInstance.get<ReportCardStatus>('/api/admin/report-cards/status', {
        params: {
          academic_session: period.active_session,
          term: period.active_term,
          class_id: selectedClassId,
          branch_id: branchId,
        },
      });
      if (res.data.success) setStatus(res.data);
    } catch {
      setError('Failed to load report card status for this class.');
    } finally {
      setIsLoadingStatus(false);
    }
  }, [period, selectedClassId, branchId]);

  useEffect((): void => { void fetchStatus(); }, [fetchStatus]);

  // ── Student summaries — only useful once report cards exist ────

  const fetchSummaries = useCallback(async (): Promise<void> => {
    if (!period || selectedClassId === '' || branchId === null) {
      setSummaries([]);
      return;
    }
    setIsLoadingSummaries(true);
    try {
      const res = await axiosInstance.get<ListReportCardSummariesResponse>(
        '/api/admin/report-cards/summaries',
        {
          params: {
            academic_session: period.active_session,
            term: period.active_term,
            class_id: selectedClassId,
            branch_id: branchId,
          },
        }
      );
      if (res.data.success) setSummaries(res.data.summaries);
    } catch {
      // Non-fatal — the section just shows empty rather than a hard error
    } finally {
      setIsLoadingSummaries(false);
    }
  }, [period, selectedClassId, branchId]);

  useEffect((): void => { void fetchSummaries(); }, [fetchSummaries]);

  const handleDownloadPdf = async (student: ReportCardSummaryListItem): Promise<void> => {
    if (!period) return;
    setDownloadingId(student.student_id);
    setError(null);
    try {
      const res = await axiosInstance.get(
        `/api/admin/report-cards/${student.student_id}/pdf`,
        {
          params: { academic_session: period.active_session, term: period.active_term },
          responseType: 'blob',
        }
      );
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ReportCard_${student.full_name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setError(`Failed to download report card for ${student.full_name}.`);
    } finally {
      setDownloadingId(null);
    }
  };

  

  // ── Bulk download handler — NEW ──────────────────────────────────
  // One merged PDF for the whole class. Backend pre-filters
  // ineligible students (pending/missing data) before generating
  // anything, so this either succeeds with everyone who's ready, or
  // fails clearly if nobody is.
  const handleDownloadAllPdf = async (): Promise<void> => {
    if (!period || selectedClassId === '' || branchId === null) return;
    setIsBulkDownloading(true);
    setError(null);
    try {
      const res = await axiosInstance.get(
        '/api/admin/report-cards/bulk-pdf',
        {
          params: {
            academic_session: period.active_session,
            term: period.active_term,
            class_id: selectedClassId,
            branch_id: branchId,
          },
          responseType: 'blob',
        }
      );
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      const className = classes.find((c) => c.id === selectedClassId)?.name ?? 'Class';
      link.download = `ReportCards_${className}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? 'Failed to download bulk report cards.');
      } else {
        setError('Failed to download bulk report cards.');
      }
    } finally {
      setIsBulkDownloading(false);
    }
  };

  // ── Generate ─────────────────────────────────────────────────

  const handleGenerate = async (): Promise<void> => {
    if (!period || selectedClassId === '' || branchId === null) return;
    setIsGenerating(true);
    setError(null);
    setGenerateResult(null);
    try {
      const res = await axiosInstance.post<GenerateReportCardsResponse>(
        '/api/admin/report-cards/generate',
        {
          academic_session: period.active_session,
          term: period.active_term,
          class_id: selectedClassId,
          branch_id: branchId,
        }
      );
      setGenerateResult(res.data);
      await fetchStatus();
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? 'Generation failed.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Approve ──────────────────────────────────────────────────

  const handleApprove = async (): Promise<void> => {
    if (!period || selectedClassId === '' || branchId === null) return;
    setIsApproving(true);
    setError(null);
    try {
      const res = await axiosInstance.post<ApproveReportCardsResponse>(
        '/api/admin/report-cards/approve',
        {
          academic_session: period.active_session,
          term: period.active_term,
          class_id: selectedClassId,
          branch_id: branchId,
          signature_name: signatureName || undefined,
        }
      );
      if (res.data.success) {
        setShowApproveConfirm(false);
        await fetchStatus();
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? 'Approval failed.');
      }
    } finally {
      setIsApproving(false);
    }
  };

  useEffect((): (() => void) => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return (): void => document.removeEventListener('keydown', h);
  }, [onClose]);

  const canAct = period !== null && selectedClassId !== '' && branchId !== null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#0B1F14]/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-2xl bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl my-4">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center">
                <Award size={17} className="text-[#0369A1]" />
              </div>
              <div>
                <h2 className="text-[#0B1F14] text-lg font-bold">Report Cards</h2>
                <p className="text-[#6B8479] text-sm">Generate and approve report cards for a class</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4">

            {error !== null && (
              <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-[#991B1B]" />
                <p className="text-[#991B1B] text-base">{error}</p>
              </div>
            )}

            {/* Period banner */}
            <div className="flex items-center gap-3 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl px-4 py-3">
              <Clock size={16} className="text-[#3D5347] flex-shrink-0" />
              <p className="text-[#3D5347] text-sm font-semibold">
                {period !== null ? period.display : 'Loading active academic period…'}
              </p>
            </div>

            {/* Branch context — super_admin only */}
            {role === 'super_admin' && (
              <div
                className={[
                  'flex items-center gap-3 rounded-xl px-4 py-3 border',
                  branchId !== null
                    ? 'bg-[#E7FBEE] border-[#86EFAC]'
                    : 'bg-[#FFFBEB] border-[#FCD34D]',
                ].join(' ')}
              >
                <p className={branchId !== null ? 'text-[#15803D] text-sm font-semibold' : 'text-[#92400E] text-sm font-semibold'}>
                  {branchId !== null
                    ? `Branch: ${branchName ?? branchId}`
                    : 'Select a branch from the sidebar Branch Context switcher first.'}
                </p>
              </div>
            )}

            {/* Class selector */}
            <div>
              <label className="text-[#3D5347] text-sm font-semibold block mb-1.5">Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-white border border-[#D7F2E0] rounded-xl px-4 py-2.5 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A] transition-all"
              >
                <option value="">Select a class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Status card */}
            {canAct && (
              <div className="bg-[#F4FBF6] border border-[#D7F2E0] rounded-2xl p-5">
                {isLoadingStatus ? (
                  <div className="flex items-center gap-2 text-[#6B8479] text-sm">
                    <Loader2 size={14} className="animate-spin" /> Checking status…
                  </div>
                ) : status !== null ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {status.generated ? (
                        <CheckCircle2 size={15} className="text-[#15803D]" />
                      ) : (
                        <AlertCircle size={15} className="text-[#92400E]" />
                      )}
                      <p className="text-[#0B1F14] text-sm font-semibold">
                        {status.generated ? 'Report cards generated' : 'Not yet generated'}
                      </p>
                    </div>
                    {status.generated && status.generated_at !== null && (
                      <p className="text-[#6B8479] text-sm pl-6">
                        Last generated {new Date(status.generated_at).toLocaleString()}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {status.approved ? (
                        <CheckCircle2 size={15} className="text-[#15803D]" />
                      ) : (
                        <AlertCircle size={15} className="text-[#6B8479]" />
                      )}
                      <p className="text-[#0B1F14] text-sm font-semibold">
                        {status.approved ? 'Approved & signed off' : 'Not yet approved'}
                      </p>
                    </div>
                    {status.approved && status.approved_at !== null && (
                      <p className="text-[#6B8479] text-sm pl-6">
                        Approved {new Date(status.approved_at).toLocaleString()}
                        {status.approved_by !== null ? ` by ${status.approved_by}` : ''}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[#6B8479] text-sm">No status data yet.</p>
                )}
              </div>
            )}

            {/* Regenerate warning if already approved */}
            {status?.approved === true && (
              <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-[#92400E] flex-shrink-0 mt-0.5" />
                <p className="text-[#92400E] text-sm">
                  This class's report cards are already approved. Regenerating will recompute
                  scores from current data — re-approve afterward if anything changed.
                </p>
              </div>
            )}

            {/* Generate action */}
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={!canAct || isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {isGenerating ? 'Generating…' : 'Generate Report Cards'}
            </button>

            {/* Generation result summary */}
            {generateResult !== null && generateResult.success && (
              <div className="bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-4 py-3 space-y-1">
                <p className="text-[#15803D] text-sm font-semibold">
                  {generateResult.students_processed ?? 0} student(s) processed,{' '}
                  {generateResult.subjects_found ?? 0} subject(s) found.
                </p>
                {generateResult.errors !== undefined && generateResult.errors.length > 0 && (
                  <p className="text-[#92400E] text-sm">
                    {generateResult.errors.length} entr{generateResult.errors.length === 1 ? 'y' : 'ies'} had errors — check server logs.
                  </p>
                )}
              </div>
            )}

            {/* Approve section — only once generated */}
            {status?.generated === true && (
              <div className="border-t border-[#D7F2E0] pt-4 space-y-3">
                <p className="text-[#3D5347] text-sm font-semibold">Approve & Sign Off</p>
                {!showApproveConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowApproveConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-[#0369A1] bg-[#EFF6FF] border border-[#BAE6FD] hover:bg-[#DBEAFE] transition-colors"
                  >
                    <ClipboardCheck size={15} />
                    Approve Report Cards
                  </button>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      placeholder="Printed signature name (e.g. Principal's name)…"
                      className="w-full bg-white border border-[#D7F2E0] rounded-xl px-4 py-2.5 text-sm text-[#0B1F14] placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A] transition-all"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowApproveConfirm(false)}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-[#3D5347] bg-[#F4FBF6] border border-[#D7F2E0] hover:bg-[#E7FBEE] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleApprove()}
                        disabled={isApproving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
                      >
                        {isApproving && <Loader2 size={14} className="animate-spin" />}
                        Confirm Approval
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Student data & downloads */}
            {canAct && (
              <div className="border-t border-[#D7F2E0] pt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-[#3D5347] text-sm font-semibold">Student Data & Downloads</p>
                  {status?.approved === true && (
                    <button
                      type="button"
                      onClick={() => void handleDownloadAllPdf()}
                      disabled={isBulkDownloading}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
                    >
                      {isBulkDownloading
                        ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
                        : <><Files size={13} /> Download All (PDF)</>}
                    </button>
                  )}
                </div>

                {isLoadingSummaries ? (
                  <div className="flex items-center gap-2 text-[#6B8479] text-sm">
                    <Loader2 size={14} className="animate-spin" /> Loading students…
                  </div>
                ) : summaries.length === 0 ? (
                  <p className="text-[#6B8479] text-sm">No active students found for this class.</p>
                ) : (
                  <div className="border border-[#D7F2E0] rounded-xl overflow-hidden">
                    {summaries.map((s, i) => {
                      const hasSummaryData =
                        s.days_present !== null ||
                        s.class_teacher_comment !== null ||
                        Object.keys(s.psychomotor_ratings ?? {}).length > 0;
                      return (
                        <div
                          key={s.student_id}
                          className={[
                            'flex items-center gap-3 px-4 py-3 border-b border-[#F4FBF6] last:border-0',
                            i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]',
                          ].join(' ')}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[#0B1F14] text-sm font-semibold truncate">{s.full_name}</p>
                            <p className="text-[#6B8479] text-xs">
                              {s.login_pin} · {hasSummaryData ? 'Data entered' : 'No summary data yet'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingStudent(s)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#4AE17A] transition-colors flex-shrink-0"
                          >
                            <Edit3 size={12} />
                            Edit Data
                          </button>
                          {status?.approved === true && (
                            <button
                              type="button"
                              onClick={() => void handleDownloadPdf(s)}
                              disabled={downloadingId === s.student_id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0369A1] bg-[#EFF6FF] border border-[#BAE6FD] hover:bg-[#DBEAFE] transition-colors disabled:opacity-50 flex-shrink-0"
                            >
                              {downloadingId === s.student_id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <Download size={12} />}
                              PDF
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {editingStudent !== null && period !== null && (
        <ReportCardSummaryModal
          student={editingStudent}
          academicSession={period.active_session}
          term={period.active_term}
          onClose={() => setEditingStudent(null)}
          onSaved={() => void fetchSummaries()}
        />
      )}
    </>
  );
}