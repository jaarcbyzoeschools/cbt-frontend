// ================================================================
//  CBT SYSTEM — SCHOOL SETTINGS PAGE
//  File    : src/pages/superadmin/SchoolSettingsPage.tsx
//  Design  : Vibrant Institutional Light Mode (matches existing pages)
//
//  Super Admin only. Fixes the gap where school_name, motto, board
//  affiliation, and address had no settings screen at all — the
//  report card PDF was reading system_settings keys that nothing
//  ever wrote to.
//
//  Built to grow: fields are rendered off whatever the backend's
//  `fields` metadata array contains, not hardcoded here — adding a
//  fifth setting on the backend automatically gets a form field
//  here too, no frontend change needed for the common case (a
//  plain required/optional text input).
// ================================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';

import axiosInstance from '../../api/axiosInstance';


interface SettingField { key: string; label: string; required: boolean; maxLength: number }
interface SchoolSettingsResponse {
  success : boolean;
  settings: Record<string, string | null>;
  fields  : SettingField[];
}

export default function SchoolSettingsPage(): React.JSX.Element {
  const [fields,   setFields]   = useState<SettingField[]>([]);
  const [values,   setValues]   = useState<Record<string, string>>({});
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving,  setIsSaving]  = useState<boolean>(false);
  const [isLogoBusy, setIsLogoBusy] = useState<boolean>(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get<SchoolSettingsResponse>('/api/superadmin/school-settings');
      if (res.data.success) {
        setFields(res.data.fields);
        setLogoPath(res.data.settings.school_logo_path ?? null);
        const initial: Record<string, string> = {};
        res.data.fields.forEach((f) => { initial[f.key] = res.data.settings[f.key] ?? ''; });
        setValues(initial);
      }
    } catch {
      setError('Failed to load school settings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect((): void => { void fetchSettings(); }, []);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await axiosInstance.put<{ success: boolean; message: string }>(
        '/api/superadmin/school-settings',
        values
      );
      if (res.data.success) {
        setSuccess(res.data.message);
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? 'Failed to save school settings.');
      } else {
        setError('Failed to save school settings.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoSelected = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
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

    setIsLogoBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await axiosInstance.post<{ success: boolean; logo_path: string }>(
        '/api/media/school-logo',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (res.data.success) {
        setLogoPath(res.data.logo_path);
        setSuccess('School logo updated.');
      }
    } catch (thrown: unknown) {
      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? 'Failed to upload logo.');
      } else {
        setError('Failed to upload logo.');
      }
    } finally {
      setIsLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const fieldCls = "w-full bg-white border-2 border-[#D7F2E0] rounded-xl px-4 py-3 text-[#0B1F14] text-base placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A] transition-all";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">School Settings</h1>
        <p className="text-[#6B8479] text-base mt-1">
          Information used across the system — report cards, printed documents, and more as they're added.
        </p>
      </div>

      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle size={17} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
          <p className="text-[#991B1B] text-base">{error}</p>
        </div>
      )}
      {success !== null && (
        <div className="flex items-center gap-2 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-5 py-4">
          <CheckCircle size={17} className="text-[#15803D] flex-shrink-0" />
          <p className="text-[#15803D] text-base">{success}</p>
        </div>
      )}

      {isLoading ? (
        <div className="h-64 bg-white border border-[#D7F2E0] rounded-2xl animate-pulse" />
      ) : (
        <>
          {/* School logo */}
          <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-5">
            <p className="text-[#3D5347] text-base font-semibold mb-3">School Logo</p>
            <div className="flex items-center gap-4">
              <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void handleLogoSelected(e)} />
              {logoPath !== null ? (
                <img
                  src       = {`${axiosInstance.defaults.baseURL ?? ''}${logoPath}`}
                  alt       = "School logo"
                  className = "w-16 h-16 rounded-2xl object-contain border border-[#D7F2E0] bg-[#F4FBF6] flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center flex-shrink-0">
                  <ImageIcon size={24} className="text-[#6B8479]" />
                </div>
              )}
              <button
                type      = "button"
                onClick   = {() => logoInputRef.current?.click()}
                disabled  = {isLogoBusy}
                className = "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#15803D] bg-[#F4FBF6] border border-[#D7F2E0] hover:border-[#4AE17A] transition-all disabled:opacity-50"
              >
                {isLogoBusy ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Camera size={14} /> {logoPath !== null ? 'Change Logo' : 'Upload Logo'}</>}
              </button>
            </div>
          </div>

          {/* Text fields — driven off backend field metadata */}
          <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={16} className="text-[#3D5347]" />
              <p className="text-[#3D5347] text-base font-semibold">School Information</p>
            </div>

            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-[#3D5347] text-base font-semibold mb-1.5">
                  {field.label}
                  {field.required
                    ? <span className="text-[#991B1B] font-normal text-sm ml-1">(required)</span>
                    : <span className="text-[#6B8479] font-normal text-sm ml-1">(optional)</span>}
                </label>
                {field.key === 'school_address' ? (
                  <textarea
                    rows        = {2}
                    value       = {values[field.key] ?? ''}
                    onChange    = {(e) => setValues((p) => ({ ...p, [field.key]: e.target.value }))}
                    maxLength   = {field.maxLength}
                    className   = {`${fieldCls} resize-none`}
                  />
                ) : (
                  <input
                    type        = "text"
                    value       = {values[field.key] ?? ''}
                    onChange    = {(e) => setValues((p) => ({ ...p, [field.key]: e.target.value }))}
                    maxLength   = {field.maxLength}
                    className   = {fieldCls}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type      = "button"
              onClick   = {() => void handleSave()}
              disabled  = {isSaving}
              className = "flex items-center gap-2 px-6 py-3 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
            >
              {isSaving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> Save Changes</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}