// ================================================================
//  CBT SYSTEM — TRAINING COURSES: shared UI pieces
//  File : src/pages/admin/training/trainingUi.tsx
//  Same look as the rest of the admin area (ClassArmsPage etc).
// ================================================================

import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';
import axiosInstance from '../../../api/axiosInstance';

export interface Toast { type: 'success' | 'error'; message: string }

/** Pulls the backend's message out of an axios error. */
export function apiError(thrown: unknown, fallback: string): string {
  if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
    const r = (thrown as { response?: { data?: unknown } }).response;
    const data = r?.data;
    if (data !== null && typeof data === 'object' && 'message' in data) {
      const m = (data as { message?: unknown }).message;
      if (typeof m === 'string' && m.trim() !== '') return m;
    }
  }
  return fallback;
}

/** Same as apiError, but also reads JSON error bodies returned as Blobs (file downloads). */
export async function apiErrorFromBlob(thrown: unknown, fallback: string): Promise<string> {
  if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
    const data = (thrown as { response?: { data?: unknown } }).response?.data;
    if (data instanceof Blob) {
      try {
        const parsed: unknown = JSON.parse(await data.text());
        if (parsed !== null && typeof parsed === 'object' && 'message' in parsed) {
          const m = (parsed as { message?: unknown }).message;
          if (typeof m === 'string') return m;
        }
      } catch { /* not JSON */ }
    }
  }
  return apiError(thrown, fallback);
}

/** Downloads a file from an authenticated endpoint. */
export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const res = await axiosInstance.get<Blob>(url, { responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] ?? '');
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match?.[1] ?? fallbackName;
  const blobUrl = window.URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m !== null
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function gradeClasses(grade: string | null | undefined): string {
  if (!grade) return 'bg-[#F4FBF6] text-[#6B8479] border-[#D7F2E0]';
  if (['A1', 'B2', 'B3'].includes(grade)) return 'bg-[#E7FBEE] text-[#15803D] border-[#86EFAC]';
  if (['C4', 'C5', 'C6'].includes(grade)) return 'bg-[#EFF6FF] text-[#0369A1] border-[#BAE6FD]';
  if (['D7', 'E8'].includes(grade))       return 'bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]';
  return 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]';
}

export function GradeBadge({ grade }: { grade: string | null | undefined }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full border text-sm font-bold ${gradeClasses(grade)}`}>
      {grade ?? '—'}
    </span>
  );
}

export function ToastNotification({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }): React.JSX.Element {
  useEffect((): (() => void) => {
    const t = setTimeout(onDismiss, 4500);
    return (): void => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={[
      'fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-lg max-w-sm',
      toast.type === 'success' ? 'bg-[#E7FBEE] border-[#86EFAC] text-[#15803D]' : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]',
    ].join(' ')}>
      {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      <p className="text-base font-medium flex-1">{toast.message}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss"><X size={15} className="opacity-60 hover:opacity-100" /></button>
    </div>
  );
}

export function Modal({
  title, onClose, children, wide = false,
}: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }): React.JSX.Element {
  useEffect((): (() => void) => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return (): void => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0B1F14]/50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none" role="dialog" aria-modal="true">
        <div className={`pointer-events-auto w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl`}>
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#D7F2E0]">
            <h3 className="text-[#0B1F14] text-lg font-bold">{title}</h3>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#6B8479] hover:bg-[#F4FBF6]" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="px-6 py-5 overflow-y-auto">{children}</div>
        </div>
      </div>
    </>
  );
}

export function ConfirmDialog({
  title, message, confirmLabel, danger = true, isLoading, onConfirm, onCancel,
}: {
  title: string; message: React.ReactNode; confirmLabel: string; danger?: boolean;
  isLoading: boolean; onConfirm: () => void; onCancel: () => void;
}): React.JSX.Element {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0B1F14]/50" onClick={onCancel} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl p-6 space-y-4">
          <h3 className="text-[#0B1F14] text-lg font-bold">{title}</h3>
          <div className="text-[#3D5347] text-base leading-relaxed">{message}</div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel} disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-base font-semibold text-[#3D5347] bg-[#F4FBF6] border border-[#D7F2E0] hover:bg-[#E7FBEE] transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={onConfirm} disabled={isLoading}
              className={[
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold transition-colors disabled:opacity-50',
                danger ? 'text-white bg-[#DC2626] hover:bg-[#B91C1C]' : 'text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C]',
              ].join(' ')}>
              {isLoading && <Loader2 size={15} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Form controls ─────────────────────────────────────────────────

export const inputCls =
  'w-full bg-white border-2 border-[#D7F2E0] rounded-xl px-4 py-2.5 text-base text-[#0B1F14] placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A] transition-all disabled:bg-[#F4FBF6]';

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50';

export const secondaryBtn =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-base font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:bg-[#E7FBEE] hover:text-[#15803D] transition-colors disabled:opacity-50';

export const iconBtn =
  'p-2 rounded-lg text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE] transition-colors disabled:opacity-40';

export const dangerIconBtn =
  'p-2 rounded-lg text-[#6B8479] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors disabled:opacity-40';

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block">
      <span className="block text-[#3D5347] text-sm font-semibold mb-1.5">{label}</span>
      {children}
      {hint !== undefined && <span className="block text-[#6B8479] text-sm mt-1">{hint}</span>}
    </label>
  );
}

export function Toggle({
  checked, onChange, label, description, disabled = false,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }): React.JSX.Element {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 text-left disabled:opacity-50">
      <span className={`mt-0.5 relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-[#4AE17A]' : 'bg-[#D7F2E0]'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
      <span>
        <span className="block text-[#0B1F14] text-base font-semibold">{label}</span>
        {description !== undefined && <span className="block text-[#6B8479] text-sm">{description}</span>}
      </span>
    </button>
  );
}
