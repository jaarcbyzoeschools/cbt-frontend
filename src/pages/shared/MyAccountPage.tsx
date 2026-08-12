// ================================================================
//  CBT SYSTEM — MY ACCOUNT PAGE
//  File    : src/pages/shared/MyAccountPage.tsx
//  Design  : Institutional Precision (Light Mode)
//
//  Accessible to all staff roles via /dashboard/account.
//  Allows every staff member to:
//    — View their own account info (read-only)
//    — Change their display name / username
//    — Change their password (requires current password)
//
//  Email is read-only — it is the login credential and can
//  only be changed by Super Admin through user management.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useState,
}                        from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  Building2,
  Calendar,
  Shield,
  Save,
}                        from 'lucide-react';

import axiosInstance from '../../api/axiosInstance';
import { useAuth }   from '../../context/AuthContext';


// ================================================================
//  TYPES
// ================================================================

interface StaffProfile {
  id         : number;
  username   : string;
  email      : string;
  role       : string;
  branch_id  : number | null;
  branch_name: string | null;
  created_at : string;
  is_active  : boolean;
}

interface ProfileResponse {
  success: boolean;
  user   : StaffProfile;
}

interface UpdateResponse {
  success: boolean;
  message: string;
  user   : {
    id      : number;
    username: string;
    email   : string;
    role    : string;
    branch_id: number | null;
  };
}


// ================================================================
//  ROLE DISPLAY HELPERS
// ================================================================

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Administrator',
  admin      : 'Branch Administrator',
  teacher    : 'Teacher',
};

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
  admin      : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  teacher    : 'bg-[#F0FDF4] text-[#166534] border-[#86EFAC]',
};


// ================================================================
//  TOAST
// ================================================================

function Toast({
  type,
  message,
  onDismiss,
}: {
  type     : 'success' | 'error';
  message  : string;
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
      type === 'success'
        ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#166534]'
        : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]',
    ].join(' ')}>
      {type === 'success'
        ? <CheckCircle size={18} className="flex-shrink-0" />
        : <AlertCircle size={18} className="flex-shrink-0" />
      }
      <p className="text-base font-medium flex-1">{message}</p>
    </div>
  );
}


// ================================================================
//  PASSWORD INPUT
// ================================================================

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  disabled,
  hint,
}: {
  label      : string;
  value      : string;
  onChange   : (v: string) => void;
  placeholder: string;
  error?     : string;
  disabled?  : boolean;
  hint?      : string;
}): React.JSX.Element {
  const [show, setShow] = useState<boolean>(false);

  return (
    <div>
      <label className="block text-[#374151] text-base font-semibold mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          type        = {show ? 'text' : 'password'}
          value       = {value}
          onChange    = {(e) => onChange(e.target.value)}
          placeholder = {placeholder}
          disabled    = {disabled}
          className   = {[
            'w-full bg-white border-2 rounded-xl px-4 py-3.5 text-[#0F172A] text-base',
            'placeholder:text-[#9CA3AF] focus:outline-none transition-all pr-12',
            'disabled:bg-[#F7F8FA] disabled:text-[#9CA3AF] disabled:cursor-not-allowed',
            error
              ? 'border-[#FCA5A5] focus:border-[#DC2626]'
              : 'border-[#D1D9E0] focus:border-[#1D4ED8]',
          ].join(' ')}
        />
        <button
          type      = "button"
          tabIndex  = {-1}
          onClick   = {() => setShow((p) => !p)}
          className = "absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error !== undefined && error !== '' && (
        <p className="text-[#991B1B] text-sm mt-1.5">{error}</p>
      )}
      {hint !== undefined && (error === undefined || error === '') && (
        <p className="text-[#9CA3AF] text-sm mt-1.5">{hint}</p>
      )}
    </div>
  );
}


// ================================================================
//  MAIN COMPONENT
// ================================================================

export default function MyAccountPage(): React.JSX.Element {
  const { updateUser } = useAuth();

  const [profile,     setProfile]     = useState<StaffProfile | null>(null);
  const [isLoading,   setIsLoading]   = useState<boolean>(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [toast,       setToast]       = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Username form
  const [newUsername,      setNewUsername]      = useState<string>('');
  const [usernameError,    setUsernameError]    = useState<string>('');
  const [isSavingUsername, setIsSavingUsername] = useState<boolean>(false);

  // Password form
  const [currentPassword,  setCurrentPassword]  = useState<string>('');
  const [newPassword,      setNewPassword]      = useState<string>('');
  const [confirmPassword,  setConfirmPassword]  = useState<string>('');
  const [pwErrors,         setPwErrors]         = useState<Record<string, string>>({});
  const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);


  // ── Load profile ─────────────────────────────────────────────

  const loadProfile = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await axiosInstance.get<ProfileResponse>('/api/auth/staff/me');
      if (res.data.success) {
        setProfile(res.data.user);
        setNewUsername(res.data.user.username);
      }
    } catch {
      setLoadError('Failed to load your profile. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void loadProfile(); }, [loadProfile]);


  // ── Save username ─────────────────────────────────────────────

  const handleSaveUsername = async (): Promise<void> => {
  setUsernameError('');

  const trimmed = newUsername.trim();

  if (trimmed.length < 2) {
    setUsernameError('Username must be at least 2 characters.');
    return;
  }

  if (trimmed === profile?.username) {
    setUsernameError('This is already your current username.');
    return;
  }

  setIsSavingUsername(true);
  try {
    const res = await axiosInstance.put<UpdateResponse>(
      '/api/auth/staff/me',
      { username: trimmed }
    );
    if (res.data.success) {
      setProfile((prev) =>
        prev !== null ? { ...prev, username: res.data.user.username } : prev
      );
      // Update AuthContext so the header name updates immediately
      updateUser({ username: res.data.user.username });
      setToast({ type: 'success', message: res.data.message });
    }
  } catch (thrown: unknown) {
    if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
      const err = thrown as { response?: { data?: { message?: string } } };
      setUsernameError(err.response?.data?.message ?? 'Failed to update username.');
    } else {
      setUsernameError('Failed to update username. Please try again.');
    }
  } finally {
    setIsSavingUsername(false);
  }
};

  // ── Save password ─────────────────────────────────────────────

  const handleSavePassword = async (): Promise<void> => {
    const errors: Record<string, string> = {};

    if (!currentPassword) {
      errors.current = 'Current password is required.';
    }
    if (!newPassword) {
      errors.new = 'New password is required.';
    } else if (newPassword.length < 8) {
      errors.new = 'Must be at least 8 characters.';
    }
    if (newPassword !== confirmPassword) {
      errors.confirm = 'Passwords do not match.';
    }
    if (newPassword === currentPassword && newPassword !== '') {
      errors.new = 'New password must be different from your current password.';
    }

    setPwErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSavingPassword(true);
    try {
      const res = await axiosInstance.put<UpdateResponse>(
        '/api/auth/staff/me',
        {
          current_password: currentPassword,
          new_password    : newPassword,
        }
      );
      if (res.data.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPwErrors({});
        setToast({ type: 'success', message: res.data.message });
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { status?: number; data?: { message?: string } } };
        if (err.response?.status === 401) {
          setPwErrors({ current: 'Current password is incorrect.' });
        } else {
          setPwErrors({ general: err.response?.data?.message ?? 'Failed to update password.' });
        }
      } else {
        setPwErrors({ general: 'Failed to update password. Please try again.' });
      }
    } finally {
      setIsSavingPassword(false);
    }
  };


  // ── Format date ───────────────────────────────────────────────

  const formatDate = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat('en-NG', {
        day  : '2-digit',
        month: 'long',
        year : 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };


  // ================================================================
  //  LOADING STATE
  // ================================================================

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <div className="h-7 w-40 bg-[#F0F2F5] rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-[#F0F2F5] rounded mt-2 animate-pulse" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white border border-[#D1D9E0] rounded-2xl p-6 h-44 animate-pulse" />
        ))}
      </div>
    );
  }


  // ================================================================
  //  LOAD ERROR STATE
  // ================================================================

  if (loadError !== null) {
    return (
      <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4 max-w-2xl">
        <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[#991B1B] text-base font-semibold">{loadError}</p>
          <button
            type      = "button"
            onClick   = {() => void loadProfile()}
            className = "text-[#991B1B] text-sm underline mt-1"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (profile === null) return <></>;


  // ================================================================
  //  RENDER
  // ================================================================

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Page header ─────────────────────────────────────── */}
      <div>
        <h1 className="text-[#0F172A] text-2xl font-bold tracking-tight">My Account</h1>
        <p className="text-[#6B7280] text-base mt-1">
          View your account information and update your display name or password.
        </p>
      </div>


      {/* ── Account info card (read-only) ────────────────────── */}
      <div className="bg-white border border-[#D1D9E0] rounded-2xl overflow-hidden">

        <div className="px-6 py-4 border-b border-[#D1D9E0] bg-[#F7F8FA]">
          <h2 className="text-[#0F172A] text-base font-bold">Account Information</h2>
          <p className="text-[#6B7280] text-sm mt-0.5">
            These details are managed by your administrator.
          </p>
        </div>

        <div className="px-6 py-6 space-y-5">

          {/* Avatar + name + role */}
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-[#1D4ED8] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-2xl font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-[#0F172A] text-xl font-bold">{profile.username}</p>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border mt-1.5 ${ROLE_BADGE[profile.role] ?? 'bg-[#F7F8FA] text-[#374151] border-[#D1D9E0]'}`}>
                <Shield size={12} />
                {ROLE_LABELS[profile.role] ?? profile.role}
              </span>
            </div>
          </div>

          {/* Info rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">

            {/* Email — read only */}
            <div className="bg-[#F7F8FA] border border-[#D1D9E0] rounded-xl px-4 py-3.5">
              <p className="text-[#9CA3AF] text-sm font-medium mb-0.5">Email Address</p>
              <p className="text-[#0F172A] text-base font-semibold break-all">
                {profile.email}
              </p>
              <p className="text-[#9CA3AF] text-xs mt-1">
                Contact Super Admin to change email
              </p>
            </div>

            {/* Branch */}
            {profile.branch_id !== null && (
              <div className="bg-[#F7F8FA] border border-[#D1D9E0] rounded-xl px-4 py-3.5">
                <p className="text-[#9CA3AF] text-sm font-medium mb-0.5 flex items-center gap-1.5">
                  <Building2 size={13} />
                  Campus Branch
                </p>
                <p className="text-[#0F172A] text-base font-semibold">
                  {profile.branch_name ?? `Branch ID ${profile.branch_id}`}
                </p>
              </div>
            )}

            {/* Joined date */}
            <div className="bg-[#F7F8FA] border border-[#D1D9E0] rounded-xl px-4 py-3.5">
              <p className="text-[#9CA3AF] text-sm font-medium mb-0.5 flex items-center gap-1.5">
                <Calendar size={13} />
                Account Created
              </p>
              <p className="text-[#0F172A] text-base font-semibold">
                {formatDate(profile.created_at)}
              </p>
            </div>

            {/* Account ID */}
            <div className="bg-[#F7F8FA] border border-[#D1D9E0] rounded-xl px-4 py-3.5">
              <p className="text-[#9CA3AF] text-sm font-medium mb-0.5 flex items-center gap-1.5">
                <User size={13} />
                Account ID
              </p>
              <p className="text-[#0F172A] text-base font-semibold font-mono">
                #{String(profile.id).padStart(4, '0')}
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* ── Change display name ───────────────────────────────── */}
      <div className="bg-white border border-[#D1D9E0] rounded-2xl overflow-hidden">

        <div className="px-6 py-4 border-b border-[#D1D9E0] bg-[#F7F8FA]">
          <h2 className="text-[#0F172A] text-base font-bold">Display Name</h2>
          <p className="text-[#6B7280] text-sm mt-0.5">
            This is the name shown across all dashboards and reports.
          </p>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-[#374151] text-base font-semibold mb-2">
              Username / Display Name
            </label>
            <input
              type        = "text"
              value       = {newUsername}
              onChange    = {(e) => {
                setNewUsername(e.target.value);
                setUsernameError('');
              }}
              placeholder = "Your display name"
              maxLength   = {100}
              disabled    = {isSavingUsername}
              className   = {[
                'w-full bg-white border-2 rounded-xl px-4 py-3.5 text-[#0F172A] text-base',
                'placeholder:text-[#9CA3AF] focus:outline-none transition-all',
                'disabled:bg-[#F7F8FA] disabled:cursor-not-allowed',
                usernameError !== ''
                  ? 'border-[#FCA5A5] focus:border-[#DC2626]'
                  : 'border-[#D1D9E0] focus:border-[#1D4ED8]',
              ].join(' ')}
            />
            {usernameError !== '' && (
              <p className="text-[#991B1B] text-sm mt-1.5">{usernameError}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[#9CA3AF] text-sm">
              {newUsername.trim().length}/100 characters
            </p>
            <button
              type      = "button"
              onClick   = {() => void handleSaveUsername()}
              disabled  = {
                isSavingUsername ||
                newUsername.trim() === profile.username ||
                newUsername.trim().length < 2
              }
              className = "flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingUsername
                ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
                : <><Save size={16} /> Save Name</>
              }
            </button>
          </div>
        </div>
      </div>


      {/* ── Change password ───────────────────────────────────── */}
      <div className="bg-white border border-[#D1D9E0] rounded-2xl overflow-hidden">

        <div className="px-6 py-4 border-b border-[#D1D9E0] bg-[#F7F8FA]">
          <div className="flex items-center gap-3">
            <Lock size={17} className="text-[#374151]" />
            <div>
              <h2 className="text-[#0F172A] text-base font-bold">Change Password</h2>
              <p className="text-[#6B7280] text-sm mt-0.5">
                You must enter your current password to set a new one.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-4">

          {pwErrors.general !== undefined && (
            <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
              <p className="text-[#991B1B] text-base">{pwErrors.general}</p>
            </div>
          )}

          <PasswordInput
            label       = "Current Password"
            value       = {currentPassword}
            onChange    = {(v) => { setCurrentPassword(v); setPwErrors((p) => ({ ...p, current: '' })); }}
            placeholder = "Enter your current password"
            error       = {pwErrors.current}
            disabled    = {isSavingPassword}
          />

          <PasswordInput
            label       = "New Password"
            value       = {newPassword}
            onChange    = {(v) => { setNewPassword(v); setPwErrors((p) => ({ ...p, new: '' })); }}
            placeholder = "At least 8 characters"
            error       = {pwErrors.new}
            disabled    = {isSavingPassword}
            hint        = "Minimum 8 characters"
          />

          <PasswordInput
            label       = "Confirm New Password"
            value       = {confirmPassword}
            onChange    = {(v) => { setConfirmPassword(v); setPwErrors((p) => ({ ...p, confirm: '' })); }}
            placeholder = "Re-enter your new password"
            error       = {pwErrors.confirm}
            disabled    = {isSavingPassword}
          />

          <div className="flex justify-end pt-2">
            <button
              type      = "button"
              onClick   = {() => void handleSavePassword()}
              disabled  = {
                isSavingPassword ||
                currentPassword === '' ||
                newPassword === '' ||
                confirmPassword === ''
              }
              className = "flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingPassword
                ? <><Loader2 size={16} className="animate-spin" /> Updating…</>
                : <><Lock size={16} /> Update Password</>
              }
            </button>
          </div>
        </div>
      </div>


      {/* Toast */}
      {toast !== null && (
        <Toast
          type      = {toast.type}
          message   = {toast.message}
          onDismiss = {() => setToast(null)}
        />
      )}
    </div>
  );
}