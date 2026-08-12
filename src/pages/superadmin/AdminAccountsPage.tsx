// ================================================================
//  CBT SYSTEM — ADMINISTRATOR ACCOUNTS PAGE
//  File    : src/pages/superadmin/AdminAccountsPage.tsx
//  Design  : Vibrant Institutional Light Mode
//
//  Addition: a deliberately low-key "Create Super Administrator"
//  section at the bottom of the page — collapsed by default, muted
//  styling (grey, not the violet used for the primary Admin CTA),
//  no icon badge in the page header, no count badge. Someone has
//  to know to look for it. This is intentional: minting a global,
//  unscoped account is a rarer and more sensitive action than
//  creating a branch-scoped Admin, and the UI weight should reflect
//  that difference.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
}                       from 'react';
import {
  ShieldCheck,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Building2,
  UserX,
  UserCheck,
  Trash2,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  KeyRound,
}                       from 'lucide-react';

import axiosInstance        from '../../api/axiosInstance';
import type { Branch }      from '../../types/exam';
import { useBranchContext } from '../../../components/layout/StaffSidebar';
import { useAuth }          from '../../context/AuthContext';


// ================================================================
//  TYPES
// ================================================================

interface AdminRecord {
  id                  : number;
  username            : string;
  email               : string;
  role                : string;
  branch_id           : number;
  branch_name         : string;
  created_by_username : string | null;
  created_at          : string;
  is_active           : boolean;
}

interface AdminListResponse   { success: boolean; count: number; admins: AdminRecord[]  }
interface CreateAdminResponse { success: boolean; message: string; admin: AdminRecord   }
interface ToggleAdminResponse { success: boolean; message: string; action: string; admin_id: number }
interface BranchListResponse  { success: boolean; branches: Branch[]                    }
interface Toast               { type: 'success' | 'error'; message: string             }
type ToggleAction = 'suspend' | 'reactivate' | 'delete';

interface SuperAdminRecord {
  id        : number;
  username  : string;
  email     : string;
  role      : string;
  created_at: string;
}
interface CreateSuperAdminResponse {
  success    : boolean;
  message    : string;
  super_admin: SuperAdminRecord;
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
    const t = setTimeout(onDismiss, 4000);
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
  title,
  message,
  confirmLabel,
  danger = false,
  isLoading,
  onConfirm,
  onCancel,
}: {
  title        : string;
  message      : string;
  confirmLabel : string;
  danger?      : boolean;
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
              className = {[
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold transition-colors disabled:opacity-50',
                danger
                  ? 'bg-[#DC2626] hover:bg-[#B91C1C] text-white'
                  : 'bg-[#4AE17A] hover:bg-[#22B85C] text-[#0B1F14]',
              ].join(' ')}
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
//  CREATE ADMIN MODAL
// ================================================================

function CreateAdminModal({
  branches,
  onClose,
  onCreated,
}: {
  branches : Branch[];
  onClose  : () => void;
  onCreated: (admin: AdminRecord) => void;
}): React.JSX.Element {
  const [username,    setUsername]    = useState<string>('');
  const [email,       setEmail]       = useState<string>('');
  const [password,    setPassword]    = useState<string>('');
  const [branchId,    setBranchId]    = useState<string>('');
  const [showPass,    setShowPass]    = useState<boolean>(false);
  const [isSubmitting,setIsSubmitting]= useState<boolean>(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [apiError,    setApiError]    = useState<string | null>(null);

  const activeBranch = useBranchContext();
  const { role }     = useAuth();
  const firstRef     = useRef<HTMLInputElement>(null);

  useEffect((): void => { firstRef.current?.focus(); }, []);

  useEffect((): (() => void) => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return (): void => document.removeEventListener('keydown', h);
  }, [onClose]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!username.trim())                                  e.username = 'Username is required.';
    if (!email.trim())                                     e.email    = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))   e.email    = 'Enter a valid email.';
    if (!password)                                         e.password = 'Password is required.';
    else if (password.length < 8)                          e.password = 'Minimum 8 characters.';
    if (!branchId)                                         e.branchId = 'Select a branch.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!validate()) return;

    const isSuperAdmin = role === 'super_admin';
    if (isSuperAdmin && activeBranch === null) {
      setApiError('Please select a branch from the Branch Context switcher before creating an Admin account.');
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const res = await axiosInstance.post<CreateAdminResponse>(
        '/api/superadmin/admins',
        {
          username : username.trim(),
          email    : email.trim().toLowerCase(),
          password,
          ...(isSuperAdmin && activeBranch !== null && { branch_id: activeBranch.id }),
        }
      );
      if (res.data.success) onCreated(res.data.admin);
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { status?: number; data?: { message?: string } } };
        setApiError(
          err.response?.status === 409
            ? 'An account with this email already exists.'
            : (err.response?.data?.message ?? 'Failed to create admin. Please try again.')
        );
      } else {
        setApiError('Failed to create admin. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldCls = (field: string): string => [
    'w-full bg-white border-2 rounded-xl px-4 py-3.5 text-[#0B1F14] text-base',
    'placeholder:text-[#6B8479] focus:outline-none transition-all duration-100',
    errors[field]
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
        <div className="w-full max-w-md bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl my-4">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center">
                <ShieldCheck size={17} className="text-[#7C3AED]" />
              </div>
              <h2 className="text-[#0B1F14] text-lg font-bold">Create Administrator</h2>
            </div>
            <button
              type      = "button"
              onClick   = {onClose}
              className = "p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
            {apiError !== null && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                <p className="text-[#991B1B] text-base">{apiError}</p>
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                Full Name / Username
              </label>
              <input
                ref         = {firstRef}
                type        = "text"
                value       = {username}
                onChange    = {(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: '' })); }}
                disabled    = {isSubmitting}
                placeholder = "e.g., Mrs. Okonkwo"
                className   = {fieldCls('username')}
              />
              {errors.username && <p className="text-[#991B1B] text-sm mt-1.5">{errors.username}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                Email Address
              </label>
              <input
                type        = "email"
                value       = {email}
                onChange    = {(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
                disabled    = {isSubmitting}
                placeholder = "admin@school.edu.ng"
                className   = {fieldCls('email')}
              />
              {errors.email && <p className="text-[#991B1B] text-sm mt-1.5">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type        = {showPass ? 'text' : 'password'}
                  value       = {password}
                  onChange    = {(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
                  disabled    = {isSubmitting}
                  placeholder = "Min. 8 characters"
                  className   = {`${fieldCls('password')} pr-12`}
                />
                <button
                  type      = "button"
                  tabIndex  = {-1}
                  onClick   = {() => setShowPass((p) => !p)}
                  className = "absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] hover:text-[#3D5347] transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-[#991B1B] text-sm mt-1.5">{errors.password}</p>}
            </div>

            {/* Branch selector */}
            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                Assign to Branch
              </label>
              <div className="relative">
                <select
                  value     = {branchId}
                  onChange  = {(e) => { setBranchId(e.target.value); setErrors((p) => ({ ...p, branchId: '' })); }}
                  disabled  = {isSubmitting}
                  className = {[
                    fieldCls('branchId'),
                    'appearance-none pr-12 cursor-pointer',
                    branchId === '' ? 'text-[#6B8479]' : 'text-[#0B1F14]',
                  ].join(' ')}
                >
                  <option value="" disabled>Select a branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={String(b.id)} className="text-[#0B1F14]">
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
              </div>
              {errors.branchId && <p className="text-[#991B1B] text-sm mt-1.5">{errors.branchId}</p>}
            </div>

            {/* Actions */}
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
                className = "flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
              >
                {isSubmitting
                  ? <><Loader2 size={16} className="animate-spin" /> Creating…</>
                  : <><Plus size={16} /> Create Admin</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}


// ================================================================
//  CREATE SUPER ADMIN MODAL
//  Deliberately plainer than CreateAdminModal — grey chrome, not
//  violet, no branch field (super admins are global). This is a
//  rare action; the modal shouldn't compete visually with the
//  primary Admin-creation flow.
// ================================================================

function CreateSuperAdminModal({
  onClose,
  onCreated,
}: {
  onClose  : () => void;
  onCreated: (superAdmin: SuperAdminRecord) => void;
}): React.JSX.Element {
  const [username,    setUsername]    = useState<string>('');
  const [email,       setEmail]       = useState<string>('');
  const [password,    setPassword]    = useState<string>('');
  const [showPass,    setShowPass]    = useState<boolean>(false);
  const [isSubmitting,setIsSubmitting]= useState<boolean>(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [apiError,    setApiError]    = useState<string | null>(null);

  const firstRef = useRef<HTMLInputElement>(null);

  useEffect((): void => { firstRef.current?.focus(); }, []);

  useEffect((): (() => void) => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return (): void => document.removeEventListener('keydown', h);
  }, [onClose]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!username.trim())                                e.username = 'Username is required.';
    if (!email.trim())                                   e.email    = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email    = 'Enter a valid email.';
    if (!password)                                       e.password = 'Password is required.';
    else if (password.length < 8)                        e.password = 'Minimum 8 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setApiError(null);

    try {
      const res = await axiosInstance.post<CreateSuperAdminResponse>(
        '/api/superadmin/users/super-admin',
        { username: username.trim(), email: email.trim().toLowerCase(), password }
      );
      if (res.data.success) onCreated(res.data.super_admin);
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { status?: number; data?: { message?: string } } };
        setApiError(
          err.response?.status === 409
            ? 'An account with this email already exists.'
            : (err.response?.data?.message ?? 'Failed to create super admin. Please try again.')
        );
      } else {
        setApiError('Failed to create super admin. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldCls = (field: string): string => [
    'w-full bg-white border-2 rounded-xl px-4 py-3.5 text-[#0B1F14] text-base',
    'placeholder:text-[#6B8479] focus:outline-none transition-all duration-100',
    errors[field]
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
        <div className="w-full max-w-md bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl my-4">

          {/* Header — deliberately grey, not violet */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center">
                <KeyRound size={17} className="text-[#6B8479]" />
              </div>
              <div>
                <h2 className="text-[#0B1F14] text-lg font-bold">Create Super Administrator</h2>
                <p className="text-[#6B8479] text-sm">Global access — not tied to any branch</p>
              </div>
            </div>
            <button
              type      = "button"
              onClick   = {onClose}
              className = "p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Warning */}
          <div className="mx-6 mt-5 flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-[#92400E] flex-shrink-0 mt-0.5" />
            <p className="text-[#92400E]/90 text-sm leading-relaxed">
              This account will have unrestricted access across every branch —
              equivalent to your own. Only create one for someone who genuinely
              needs full institutional access.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
            {apiError !== null && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                <p className="text-[#991B1B] text-base">{apiError}</p>
              </div>
            )}

            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                Full Name / Username
              </label>
              <input
                ref         = {firstRef}
                type        = "text"
                value       = {username}
                onChange    = {(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: '' })); }}
                disabled    = {isSubmitting}
                placeholder = "e.g., Mr. Adeyemi"
                className   = {fieldCls('username')}
              />
              {errors.username && <p className="text-[#991B1B] text-sm mt-1.5">{errors.username}</p>}
            </div>

            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                Email Address
              </label>
              <input
                type        = "email"
                value       = {email}
                onChange    = {(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
                disabled    = {isSubmitting}
                placeholder = "director@school.edu.ng"
                className   = {fieldCls('email')}
              />
              {errors.email && <p className="text-[#991B1B] text-sm mt-1.5">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type        = {showPass ? 'text' : 'password'}
                  value       = {password}
                  onChange    = {(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
                  disabled    = {isSubmitting}
                  placeholder = "Min. 8 characters"
                  className   = {`${fieldCls('password')} pr-12`}
                />
                <button
                  type      = "button"
                  tabIndex  = {-1}
                  onClick   = {() => setShowPass((p) => !p)}
                  className = "absolute right-4 top-1/2 -translate-y-1/2 text-[#6B8479] hover:text-[#3D5347] transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-[#991B1B] text-sm mt-1.5">{errors.password}</p>}
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
                className = "flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
              >
                {isSubmitting
                  ? <><Loader2 size={16} className="animate-spin" /> Creating…</>
                  : <><KeyRound size={16} /> Create Super Admin</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}


// ================================================================
//  MAIN PAGE
// ================================================================

export default function AdminAccountsPage(): React.JSX.Element {
  const [admins,         setAdmins]         = useState<AdminRecord[]>([]);
  const [branches,       setBranches]       = useState<Branch[]>([]);
  const [isLoading,      setIsLoading]      = useState<boolean>(true);
  const [error,          setError]          = useState<string | null>(null);
  const [showModal,      setShowModal]      = useState<boolean>(false);
  const [toast,          setToast]          = useState<Toast | null>(null);
  const [filterBranchId, setFilterBranchId] = useState<string>('');
  const [actionTarget,   setActionTarget]   = useState<{
    admin : AdminRecord;
    action: ToggleAction;
  } | null>(null);
  const [isActioning, setIsActioning] = useState<boolean>(false);

  // ── Low-key Super Admin section — collapsed by default ────────
  const [showSuperAdminSection, setShowSuperAdminSection] = useState<boolean>(false);
  const [showSuperAdminModal,   setShowSuperAdminModal]   = useState<boolean>(false);

  const fetchAdmins = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const params = filterBranchId ? `?branch_id=${filterBranchId}` : '';
      const res = await axiosInstance.get<AdminListResponse>(`/api/superadmin/admins${params}`);
      if (res.data.success) setAdmins(res.data.admins);
    } catch {
      setError('Failed to load administrator accounts.');
    } finally {
      setIsLoading(false);
    }
  }, [filterBranchId]);

  const fetchBranches = useCallback(async (): Promise<void> => {
    try {
      const res = await axiosInstance.get<BranchListResponse>('/api/shared/branches');
      if (res.data.success) setBranches(res.data.branches);
    } catch { /* non-fatal */ }
  }, []);

  useEffect((): void => { void fetchAdmins(); },  [fetchAdmins]);
  useEffect((): void => { void fetchBranches(); }, [fetchBranches]);

  const handleAction = async (): Promise<void> => {
    if (actionTarget === null) return;
    setIsActioning(true);
    const { admin, action } = actionTarget;
    try {
      const res = await axiosInstance.put<ToggleAdminResponse>(
        `/api/superadmin/admins/${admin.id}/status`,
        { action }
      );
      if (res.data.success) {
        if (action === 'delete') {
          setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
          setToast({ type: 'success', message: `Admin "${admin.username}" deleted.` });
        } else {
          setAdmins((prev) => prev.map((a) =>
            a.id === admin.id ? { ...a, is_active: action === 'reactivate' } : a
          ));
          setToast({
            type   : 'success',
            message: `Admin "${admin.username}" ${action === 'suspend' ? 'suspended' : 'reactivated'}.`,
          });
        }
        setActionTarget(null);
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setToast({ type: 'error', message: err.response?.data?.message ?? 'Action failed.' });
      } else {
        setToast({ type: 'error', message: 'Action failed. Please try again.' });
      }
      setActionTarget(null);
    } finally {
      setIsActioning(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Administrator Accounts
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            Provision and manage branch-level administrator accounts.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">

          {/* Branch filter */}
          <div className="relative">
            <select
              value     = {filterBranchId}
              onChange  = {(e) => setFilterBranchId(e.target.value)}
              className = "appearance-none bg-white border border-[#D7F2E0] rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium text-[#3D5347] focus:outline-none focus:border-[#4AE17A] cursor-pointer transition-colors"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none" />
          </div>

          <button
            type      = "button"
            onClick   = {() => void fetchAdmins()}
            disabled  = {isLoading}
            className = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            type      = "button"
            onClick   = {() => setShowModal(true)}
            className = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors"
          >
            <Plus size={16} />
            New Admin
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <p className="text-[#991B1B] text-base font-semibold">{error}</p>
        </div>
      )}

      {/* ── Table card ────────────────────────────────────────── */}
      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

        {/* Card header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
          <Users size={18} className="text-[#3D5347]" />
          <h2 className="text-[#0B1F14] text-base font-bold">Administrator Directory</h2>
          {!isLoading && (
            <span className="px-2.5 py-0.5 rounded-full bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] text-sm font-semibold">
              {admins.length}
            </span>
          )}
        </div>

        {/* Skeleton */}
        {isLoading && (
          <div className="divide-y divide-[#F4FBF6]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-[#F4FBF6] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F4FBF6] rounded w-1/4" />
                  <div className="h-3 bg-[#F4FBF6] rounded w-1/3" />
                </div>
                <div className="h-7 w-24 rounded-full bg-[#F4FBF6]" />
                <div className="h-9 w-24 rounded-xl bg-[#F4FBF6]" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && admins.length === 0 && error === null && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-5">
              <ShieldCheck size={28} className="text-[#6B8479]" />
            </div>
            <p className="text-[#0B1F14] text-lg font-bold">No administrators found</p>
            <p className="text-[#6B8479] text-base mt-1.5 max-w-xs leading-relaxed">
              {filterBranchId
                ? 'No admins assigned to the selected branch.'
                : 'Create your first branch administrator to manage a campus.'}
            </p>
            {!filterBranchId && (
              <button
                type      = "button"
                onClick   = {() => setShowModal(true)}
                className = "mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-base font-semibold transition-colors"
              >
                <Plus size={17} />
                Create First Admin
              </button>
            )}
          </div>
        )}

        {/* Data table */}
        {!isLoading && admins.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D7F2E0]">
                  {['Administrator', 'Branch', 'Created By', 'Joined', 'Status', 'Actions'].map((h) => (
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
                {admins.map((admin, rowIdx) => {
                  const isEven = rowIdx % 2 === 0;
                  return (
                    <tr
                      key       = {admin.id}
                      className = {`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors ${isEven ? 'bg-white' : 'bg-[#F4FBF6]'}`}
                    >
                      {/* Identity */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center flex-shrink-0">
                            <span className="text-[#7C3AED] text-base font-bold">
                              {admin.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-[#0B1F14] text-base font-semibold">{admin.username}</p>
                            <p className="text-[#6B8479] text-sm">{admin.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-[#15803D] flex-shrink-0" />
                          <span className="text-[#3D5347] text-base">{admin.branch_name}</span>
                        </div>
                      </td>

                      {/* Creator */}
                      <td className="px-6 py-4">
                        <span className="text-[#6B8479] text-sm">
                          {admin.created_by_username ?? '—'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-[#6B8479] text-sm">
                          <Calendar size={13} />
                          {new Date(admin.created_at).toLocaleDateString('en-NG', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <StatusBadge active={admin.is_active} />
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {admin.is_active ? (
                            <button
                              type      = "button"
                              title     = "Suspend account"
                              onClick   = {() => setActionTarget({ admin, action: 'suspend' })}
                              className = "p-2 rounded-lg text-[#6B8479] hover:text-[#92400E] hover:bg-[#FFFBEB] transition-colors"
                            >
                              <UserX size={16} />
                            </button>
                          ) : (
                            <button
                              type      = "button"
                              title     = "Reactivate account"
                              onClick   = {() => setActionTarget({ admin, action: 'reactivate' })}
                              className = "p-2 rounded-lg text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE] transition-colors"
                            >
                              <UserCheck size={16} />
                            </button>
                          )}
                          <button
                            type      = "button"
                            title     = "Delete account"
                            onClick   = {() => setActionTarget({ admin, action: 'delete' })}
                            className = "p-2 rounded-lg text-[#6B8479] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors"
                          >
                            <Trash2 size={16} />
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

      {/* ── Low-key Super Admin section ────────────────────────
          Collapsed by default. Muted grey text link, not a card,
          not a button in the header. Deliberately easy to miss
          unless you're specifically looking for it. */}
      <div className="pt-2">
        <button
          type      = "button"
          onClick   = {() => setShowSuperAdminSection((p) => !p)}
          className = "flex items-center gap-1.5 text-[#6B8479] text-sm hover:text-[#3D5347] transition-colors"
        >
          {showSuperAdminSection ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Advanced: Super Administrator access
        </button>

        {showSuperAdminSection && (
          <div className="mt-3 flex items-center justify-between gap-4 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl px-5 py-4">
            <div className="min-w-0">
              <p className="text-[#3D5347] text-sm font-medium">
                Super Administrators have unrestricted access across every branch.
              </p>
              <p className="text-[#6B8479] text-sm mt-0.5">
                This is a rare action — most schools only ever need one or two.
              </p>
            </div>
            <button
              type      = "button"
              onClick   = {() => setShowSuperAdminModal(true)}
              className = "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#6B8479] transition-colors flex-shrink-0"
            >
              <KeyRound size={14} />
              Create Super Admin
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <CreateAdminModal
          branches  = {branches}
          onClose   = {() => setShowModal(false)}
          onCreated = {(admin) => {
            setAdmins((prev) => [admin, ...prev]);
            setShowModal(false);
            setToast({ type: 'success', message: `Admin "${admin.username}" created successfully.` });
          }}
        />
      )}

      {showSuperAdminModal && (
        <CreateSuperAdminModal
          onClose   = {() => setShowSuperAdminModal(false)}
          onCreated = {(superAdmin) => {
            setShowSuperAdminModal(false);
            setToast({ type: 'success', message: `Super Admin "${superAdmin.username}" created successfully.` });
          }}
        />
      )}

      {actionTarget !== null && (
        <ConfirmDialog
          title        = {
            actionTarget.action === 'delete'
              ? `Delete "${actionTarget.admin.username}"?`
              : actionTarget.action === 'suspend'
              ? `Suspend "${actionTarget.admin.username}"?`
              : `Reactivate "${actionTarget.admin.username}"?`
          }
          message      = {
            actionTarget.action === 'delete'
              ? 'This will permanently delete the admin account. This action cannot be undone.'
              : actionTarget.action === 'suspend'
              ? 'This admin will immediately lose the ability to log in. Their data remains intact.'
              : 'This admin will regain access to their branch dashboard.'
          }
          confirmLabel = {
            actionTarget.action === 'delete'  ? 'Delete Account'  :
            actionTarget.action === 'suspend' ? 'Suspend Access'  : 'Reactivate'
          }
          danger     = {actionTarget.action === 'delete' || actionTarget.action === 'suspend'}
          isLoading  = {isActioning}
          onConfirm  = {() => void handleAction()}
          onCancel   = {() => setActionTarget(null)}
        />
      )}

      {toast !== null && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}