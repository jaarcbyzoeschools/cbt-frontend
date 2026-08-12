// ================================================================
//  CBT SYSTEM — ACADEMIC PERIOD MANAGEMENT PAGE
//  File    : src/pages/superadmin/AcademicPeriodPage.tsx
//  Design  : Vibrant Institutional Light Mode
//
//  Canvas  #F4FBF6 · Surface #FFFFFF · Border #D7F2E0
//  Ink-1   #0B1F14 · Ink-2  #3D5347 · Ink-3  #6B8479
//  Accent  #4AE17A · Accent-Hov #22B85C · Accent-L #E7FBEE
//  Warning #FFFBEB / #92400E / #FCD34D
//  Success #E7FBEE / #15803D / #86EFAC
//  Error   #FEF2F2 / #991B1B / #FCA5A5
//
//  Addition: PromoteStudentsPanel mounted between the "Change
//  Active Period" form and the read-only "Other System Settings"
//  panel — promotion naturally happens alongside the period switch,
//  even though it's a separate action against a separate endpoint.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useState,
}                          from 'react';
import {
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  Clock,
  User,
  Settings,
  Shield,
  ArrowRight,
  Zap,
  CalendarOff,
}                          from 'lucide-react';

import axiosInstance       from '../../api/axiosInstance';
import PromoteStudentsPanel from '../admin/PromoteStudentsPanel';



// ================================================================
//  TYPES
// ================================================================

interface SettingRow {
  key          : string;
  value        : string;
  updated_by_id: number | null;
  updated_by   : string | null;
  updated_at   : string;
}

interface AllSettingsResponse {
  success  : boolean;
  count    : number;
  settings : SettingRow[];
}

interface UpdatePeriodResponse {
  success       : boolean;
  message       : string;
  active_session: string;
  active_term   : number;
  term_label    : string;
  display       : string;
  updated_at    : string;
}

interface Toast {
  type   : 'success' | 'error';
  message: string;
}


// ================================================================
//  CONSTANTS
// ================================================================

function generateSessionOptions(): { value: string; label: string }[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => {
    const s = y - 3 + i;
    return { value: `${s}/${s + 1}`, label: `${s}/${s + 1} Academic Session` };
  });
}

const SESSION_OPTIONS = generateSessionOptions();

const TERM_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1st Term' },
  { value: '2', label: '2nd Term' },
  { value: '3', label: '3rd Term' },
];

const PERIOD_KEYS = new Set(['active_session', 'active_term']);

const SETTING_LABELS: Record<string, string> = {
  active_session             : 'Active Academic Session',
  active_term                : 'Active Term',
  school_name                : 'School Name',
  school_motto               : 'School Motto',
  results_visible_to_students: 'Results Visible to Students',
  default_ca_max_mark        : 'Default CA Maximum Mark',
  default_ca_weight          : 'Default CA Grade Weight',
  default_terminal_max_mark  : 'Default Terminal Maximum Mark',
  default_terminal_weight    : 'Default Terminal Grade Weight',
};


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
      <button
        type      = "button"
        onClick   = {onDismiss}
        className = "opacity-60 hover:opacity-100 transition-opacity ml-1"
      >
        <AlertCircle size={14} className="rotate-45" />
      </button>
    </div>
  );
}


// ================================================================
//  SELECT FIELD WRAPPER
// ================================================================

function SelectField({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  error,
  children,
}: {
  id         : string;
  value      : string;
  onChange   : (v: string) => void;
  disabled   : boolean;
  placeholder: string;
  error?     : string;
  children   : React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="relative">
      <select
        id        = {id}
        value     = {value}
        onChange  = {(e) => onChange(e.target.value)}
        disabled  = {disabled}
        className = {[
          'w-full appearance-none bg-white border-2 rounded-xl px-4 py-3.5',
          'text-base focus:outline-none transition-all cursor-pointer pr-12',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          value === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]',
          error !== undefined
            ? 'border-[#FCA5A5] focus:border-[#991B1B]'
            : 'border-[#D7F2E0] focus:border-[#4AE17A]',
        ].join(' ')}
      >
        <option value="" disabled>{placeholder}</option>
        {children}
      </select>
      <ChevronDown
        size      = {16}
        className = "absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none"
      />
    </div>
  );
}

// ================================================================
//  RESULTS VISIBILITY TOGGLE ROW
//  Replaces the read-only row for results_visible_to_students
//  with an actionable toggle + explanatory copy.
// ================================================================

function ResultsVisibilityRow({
  isVisible,
  updatedBy,
  onToggle,
}: {
  isVisible : boolean;
  updatedBy : string | null;
  onToggle  : (newValue: boolean) => Promise<void>;
}): React.JSX.Element {
  const [isToggling, setIsToggling] = useState<boolean>(false);

  const handleClick = async (): Promise<void> => {
    setIsToggling(true);
    try {
      await onToggle(!isVisible);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="px-6 py-5 border-b border-[#F4FBF6] last:border-0 bg-white hover:bg-[#F4FBF6] transition-colors">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[#0B1F14] text-base font-semibold">
              Results Visible to Students
            </p>
            <span className={[
              'px-2.5 py-0.5 rounded-full text-sm font-bold border',
              isVisible
                ? 'bg-[#E7FBEE] text-[#15803D] border-[#86EFAC]'
                : 'bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]',
            ].join(' ')}>
              {isVisible ? 'Visible' : 'Hidden'}
            </span>
          </div>
          <p className="text-[#6B8479] text-sm leading-relaxed max-w-md">
            {isVisible
              ? 'Students can currently see their scores and grade bands immediately after submitting. Switch off to hide scores until end of term.'
              : 'Scores are hidden from students. They see a "Submission Confirmed" screen after finishing. Switch on to release all results at once.'}
          </p>
          {updatedBy !== null && (
            <p className="text-[#6B8479] text-sm mt-1">Last changed by {updatedBy}</p>
          )}
        </div>
        <button
          type      = "button"
          onClick   = {() => void handleClick()}
          disabled  = {isToggling}
          className = {[
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold transition-colors flex-shrink-0 disabled:opacity-50',
            isVisible
              ? 'bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E] hover:bg-[#FEF3C7]'
              : 'bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14]',
          ].join(' ')}
        >
          {isToggling && <Loader2 size={15} className="animate-spin" />}
          {isVisible ? 'Hide Results' : 'Release Results'}
        </button>
      </div>
    </div>
  );
}



// ================================================================
//  MAIN PAGE
// ================================================================

export default function AcademicPeriodPage(): React.JSX.Element {

  const [settings,    setSettings]    = useState<SettingRow[]>([]);
  const [isLoading,   setIsLoading]   = useState<boolean>(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);

  const [formSession, setFormSession] = useState<string>('');
  const [formTerm,    setFormTerm]    = useState<string>('');
  const [isSubmitting,setIsSubmitting]= useState<boolean>(false);
  const [formErrors,  setFormErrors]  = useState<{
    session?: string;
    term?   : string;
  }>({});

  const [toast, setToast] = useState<Toast | null>(null);

  // Derived current period
  const activeSessionRow = settings.find((s) => s.key === 'active_session');
  const activeTermRow    = settings.find((s) => s.key === 'active_term');
  const hasActivePeriod  = activeSessionRow !== undefined && activeTermRow !== undefined;
  const currentSession   = activeSessionRow?.value ?? '—';
  const currentTermNum   = activeTermRow ? parseInt(activeTermRow.value, 10) : null;
  const currentTermLabel = currentTermNum !== null
    ? (TERM_OPTIONS.find((t) => t.value === String(currentTermNum))?.label ?? `Term ${currentTermNum}`)
    : '—';
  const currentDisplay   = currentSession !== '—' && currentTermLabel !== '—'
    ? `${currentSession} — ${currentTermLabel}`
    : '—';
  const lastUpdatedAt    = activeSessionRow?.updated_at  ?? null;
  const lastUpdatedBy    = activeSessionRow?.updated_by  ?? null;
  const otherSettings    = settings.filter((s) => !PERIOD_KEYS.has(s.key));

  // Preview of what will be activated
  const previewDisplay = formSession !== '' && formTerm !== ''
    ? `${formSession} — ${TERM_OPTIONS.find((t) => t.value === formTerm)?.label ?? `Term ${formTerm}`}`
    : null;


  // ── FETCH ────────────────────────────────────────────────────

  const fetchSettings = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await axiosInstance.get<AllSettingsResponse>('/api/superadmin/settings');
      if (res.data.success) {
        setSettings(res.data.settings);
        const sRow = res.data.settings.find((s) => s.key === 'active_session');
        const tRow = res.data.settings.find((s) => s.key === 'active_term');
        if (sRow !== undefined) setFormSession(sRow.value);
        if (tRow !== undefined) setFormTerm(tRow.value);
      }
    } catch {
      setLoadError('Failed to load system settings. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void fetchSettings(); }, [fetchSettings]);


  // ── SUBMIT ───────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const e: { session?: string; term?: string } = {};
    if (!formSession) e.session = 'Please select an academic session.';
    if (!formTerm)    e.term    = 'Please select a term.';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!validateForm()) return;

    const isSame = hasActivePeriod && formSession === currentSession && formTerm === String(currentTermNum);
    if (isSame) {
      setToast({
        type   : 'success',
        message: `${previewDisplay ?? currentDisplay} is already the active period. No changes were made.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axiosInstance.put<UpdatePeriodResponse>(
        '/api/superadmin/settings/academic-period',
        { academic_session: formSession, term: Number(formTerm) }
      );
      if (res.data.success) {
        setToast({ type: 'success', message: res.data.message });
        void fetchSettings();
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setToast({
          type   : 'error',
          message: err.response?.data?.message ?? 'Failed to update the academic period. Please try again.',
        });
      } else {
        setToast({ type: 'error', message: 'Failed to update the academic period. Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  // ================================================================
  //  RENDER
  // ================================================================

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Academic Period Management
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            Set the active academic session and term system-wide.
            All new exams are automatically tagged with this period.
          </p>
        </div>
        <button
          type      = "button"
          onClick   = {() => void fetchSettings()}
          disabled  = {isLoading}
          className = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>


      {/* ── Load error ──────────────────────────────────────── */}
      {loadError !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#991B1B] text-base font-semibold">{loadError}</p>
            <button
              type      = "button"
              onClick   = {() => void fetchSettings()}
              className = "text-[#991B1B] text-sm underline mt-1 hover:opacity-80"
            >
              Try again
            </button>
          </div>
        </div>
      )}


      {/* ── Current active period hero card ─────────────────── */}
      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

        {/* Card header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
          <div className={[
            'w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0',
            hasActivePeriod
              ? 'bg-[#E7FBEE] border-[#86EFAC]'
              : 'bg-[#FFFBEB] border-[#FCD34D]',
          ].join(' ')}>
            {hasActivePeriod
              ? <Calendar size={17} className="text-[#15803D]" />
              : <CalendarOff size={17} className="text-[#92400E]" />
            }
          </div>
          <h2 className="text-[#0B1F14] text-base font-bold">
            Currently Active Period
          </h2>
          {!isLoading && (
            <div className={[
              'ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border',
              hasActivePeriod
                ? 'bg-[#E7FBEE] border-[#4AE17A]'
                : 'bg-[#FFFBEB] border-[#FCD34D]',
            ].join(' ')}>
              <div className={`w-2 h-2 rounded-full ${hasActivePeriod ? 'bg-[#22B85C]' : 'bg-[#FCD34D]'}`} />
              <span className={[
                'text-sm font-bold uppercase tracking-wide',
                hasActivePeriod ? 'text-[#15803D]' : 'text-[#92400E]',
              ].join(' ')}>
                {hasActivePeriod ? 'Active' : 'Not Set'}
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="px-6 py-10 flex items-center justify-center gap-3">
            <Loader2 size={22} className="text-[#4AE17A] animate-spin" />
            <span className="text-[#6B8479] text-base">Loading settings…</span>
          </div>
        ) : !hasActivePeriod ? (
          /* Genuinely empty state — nothing configured yet. This is
             the normal, expected first-run state (e.g. right after
             a factory reset), not an error — points at the form below. */
          <div className="px-6 py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#FFFBEB] border border-[#FCD34D] flex items-center justify-center mx-auto mb-4">
              <CalendarOff size={26} className="text-[#92400E]" />
            </div>
            <p className="text-[#0B1F14] text-lg font-bold">No academic period set yet</p>
            <p className="text-[#6B8479] text-base mt-1.5 max-w-sm mx-auto leading-relaxed">
              This is expected the first time the system is used, or right after
              a reset. Choose a session and term in the form below to activate one —
              nothing else in the system will work correctly until you do.
            </p>
          </div>
        ) : (
          <div className="px-6 py-6">

            {/* Period display — large prominent text */}
            <p className="text-[#0B1F14] text-4xl font-bold leading-tight tracking-tight">
              {currentDisplay}
            </p>

            {/* Metadata row */}
            <div className="flex items-center flex-wrap gap-x-6 gap-y-2 mt-4">
              {lastUpdatedAt !== null && (
                <div className="flex items-center gap-2 text-[#6B8479] text-sm">
                  <Clock size={14} />
                  <span>
                    Updated{' '}
                    {new Date(lastUpdatedAt).toLocaleString('en-NG', {
                      timeZone: 'Africa/Lagos',
                      day     : '2-digit',
                      month   : 'short',
                      year    : 'numeric',
                      hour    : '2-digit',
                      minute  : '2-digit',
                      hour12  : true,
                    })}
                  </span>
                </div>
              )}
              {lastUpdatedBy !== null && (
                <div className="flex items-center gap-2 text-[#6B8479] text-sm">
                  <User size={14} />
                  <span>by {lastUpdatedBy}</span>
                </div>
              )}
            </div>

            {/* Impact note */}
            <div className="mt-5 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl px-5 py-4">
              <div className="flex items-start gap-3">
                <Zap size={16} className="text-[#15803D] flex-shrink-0 mt-0.5" />
                <p className="text-[#3D5347] text-sm leading-relaxed">
                  <strong className="text-[#0B1F14]">Impact:</strong>{' '}
                  Every exam created from this moment is automatically tagged with{' '}
                  <strong className="text-[#15803D]">{currentDisplay}</strong>.
                  Teachers never see or touch the session and term fields — they are
                  stamped invisibly. Changing the period only affects future exams.
                  Existing exams retain their original period tags.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* ── Change Period form card ──────────────────────────── */}
      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

        {/* Card header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
          <div className="w-9 h-9 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center flex-shrink-0">
            <Shield size={17} className="text-[#7C3AED]" />
          </div>
          <h2 className="text-[#0B1F14] text-base font-bold">
            {hasActivePeriod ? 'Change Active Period' : 'Set Active Period'}
          </h2>
          <span className="ml-auto px-3 py-1 rounded-full bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] text-sm font-semibold">
            Super Admin Only
          </span>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">

          {/* Warning notice */}
          <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-5 py-4">
            <AlertCircle size={18} className="text-[#92400E] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[#92400E] text-base font-semibold mb-1">
                {hasActivePeriod ? 'Global change — takes effect immediately' : 'Nothing is configured yet'}
              </p>
              <p className="text-[#92400E]/80 text-sm leading-relaxed">
                {hasActivePeriod
                  ? 'Changing the active period affects all branches simultaneously. All teachers will see the new period on their dashboards within seconds. This can only be changed, not undone.'
                  : 'Select a session and term below and activate it. Until you do, exam creation and other period-dependent features will not work anywhere in the system.'}
              </p>
            </div>
          </div>

          {/* Two selector columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Academic Session */}
            <div>
              <label
                htmlFor   = "form-session"
                className = "block text-[#3D5347] text-base font-semibold mb-2"
              >
                Academic Session
              </label>
              <SelectField
                id          = "form-session"
                value       = {formSession}
                onChange    = {(v) => { setFormSession(v); setFormErrors((p) => ({ ...p, session: undefined })); }}
                disabled    = {isSubmitting || isLoading}
                placeholder = "Select session…"
                error       = {formErrors.session}
              >
                {SESSION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectField>
              {formErrors.session !== undefined && (
                <p className="text-[#991B1B] text-sm mt-1.5 flex items-center gap-1.5">
                  <AlertCircle size={13} />
                  {formErrors.session}
                </p>
              )}
            </div>

            {/* Term */}
            <div>
              <label
                htmlFor   = "form-term"
                className = "block text-[#3D5347] text-base font-semibold mb-2"
              >
                Term
              </label>
              <SelectField
                id          = "form-term"
                value       = {formTerm}
                onChange    = {(v) => { setFormTerm(v); setFormErrors((p) => ({ ...p, term: undefined })); }}
                disabled    = {isSubmitting || isLoading}
                placeholder = "Select term…"
                error       = {formErrors.term}
              >
                {TERM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectField>
              {formErrors.term !== undefined && (
                <p className="text-[#991B1B] text-sm mt-1.5 flex items-center gap-1.5">
                  <AlertCircle size={13} />
                  {formErrors.term}
                </p>
              )}
            </div>
          </div>

          {/* Live preview banner */}
          {previewDisplay !== null && (
            <div className="flex items-center gap-4 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-5 py-4">
              <div className="w-3 h-3 rounded-full bg-[#4AE17A] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[#6B8479] text-sm font-medium">
                  This will activate:
                </p>
                <p className="text-[#15803D] text-lg font-bold mt-0.5 truncate">
                  {previewDisplay}
                </p>
              </div>
              <ArrowRight size={18} className="text-[#86EFAC] flex-shrink-0" />
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end pt-1">
            <button
              type      = "submit"
              disabled  = {isSubmitting || isLoading}
              className = {[
                'flex items-center gap-2.5 px-7 py-3.5 rounded-xl',
                'text-base font-bold transition-all duration-100',
                'focus:outline-none focus:ring-2 focus:ring-[#86EFAC] focus:ring-offset-2',
                isSubmitting || isLoading
                  ? 'bg-[#E7FBEE] cursor-not-allowed text-[#15803D]'
                  : 'bg-[#4AE17A] hover:bg-[#22B85C] active:bg-[#1A9C4B] text-[#0B1F14]',
              ].join(' ')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Activating Period…
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  {hasActivePeriod ? 'Activate This Period' : 'Set Active Period'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>


      {/* ── Promote Students card ─────────────────────────────── */}
      <PromoteStudentsPanel />


      {/* ── Other settings — read-only panel ────────────────── */}
      {otherSettings.length > 0 && !isLoading && (
        <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
            <div className="w-9 h-9 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center flex-shrink-0">
              <Settings size={17} className="text-[#6B8479]" />
            </div>
            <h2 className="text-[#0B1F14] text-base font-bold">
              Other System Settings
            </h2>
            <span className="ml-auto px-3 py-1 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#6B8479] text-sm font-semibold">
              Read Only
            </span>
          </div>

          {/* Settings rows */}
          <div>
            {/* ── Other settings — read-only panel ────────────────── */}
{otherSettings.length > 0 && !isLoading && (
  <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
    <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
      <div className="w-9 h-9 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center flex-shrink-0">
        <Settings size={17} className="text-[#6B8479]" />
      </div>
      <h2 className="text-[#0B1F14] text-base font-bold">Other System Settings</h2>
      <span className="ml-auto px-3 py-1 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#6B8479] text-sm font-semibold">
        Read Only
      </span>
    </div>

    <div>
      {otherSettings.map((setting, i) => {
        // ── Special case: results_visible_to_students gets a real toggle ──
        if (setting.key === 'results_visible_to_students') {
          const isVisible = setting.value === 'true' || setting.value === '1';
          return (
            <ResultsVisibilityRow
              key        = {setting.key}
              isVisible  = {isVisible}
              updatedBy  = {setting.updated_by}
              onToggle   = {async (newValue) => {
                try {
                  const res = await axiosInstance.put<{
                    success        : boolean;
                    results_visible: boolean;
                  }>('/api/superadmin/settings/results-visibility', { visible: newValue });
                  if (res.data.success) {
                    setToast({
                      type   : 'success',
                      message: newValue
                        ? 'Student results are now visible to students.'
                        : 'Student results are now hidden from students.',
                    });
                    void fetchSettings();
                  }
                } catch {
                  setToast({ type: 'error', message: 'Failed to update results visibility.' });
                }
              }}
            />
          );
        }

        // All other settings remain read-only
        return (
          <div
            key       = {setting.key}
            className = {[
              'flex items-center justify-between gap-4 px-6 py-4',
              'hover:bg-[#F4FBF6] transition-colors border-b border-[#F4FBF6] last:border-0',
              i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]',
            ].join(' ')}
          >
            <div className="min-w-0">
              <p className="text-[#0B1F14] text-base font-semibold">
                {SETTING_LABELS[setting.key] ?? setting.key}
              </p>
              <p className="text-[#6B8479] text-sm font-mono mt-0.5">{setting.key}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[#3D5347] text-base font-bold font-mono">
                {setting.value === '' ? '—' : setting.value}
              </p>
              {setting.updated_by !== null && (
                <p className="text-[#6B8479] text-sm mt-0.5">by {setting.updated_by}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>

    <div className="px-6 py-4 border-t border-[#D7F2E0] bg-[#F4FBF6]">
      <p className="text-[#6B8479] text-sm">
        These settings are managed via database configuration and
        will be editable through this panel in a future update.
      </p>
    </div>
  </div>
)}
          </div>

          {/* Footer note */}
          <div className="px-6 py-4 border-t border-[#D7F2E0] bg-[#F4FBF6]">
            <p className="text-[#6B8479] text-sm">
              These settings are managed via database configuration and
              will be editable through this panel in a future update.
            </p>
          </div>
        </div>
      )}


      {/* Toast */}
      {toast !== null && (
        <ToastNotification
          toast     = {toast}
          onDismiss = {() => setToast(null)}
        />
      )}
    </div>
  );
}