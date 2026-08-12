// ================================================================
//  CBT SYSTEM — STAFF LOGIN PAGE
//  File    : src/pages/auth/StaffLoginPage.tsx
//
//  Design philosophy:
//    Modern institutional — clean, confident, high-contrast.
//    Light mode. No gradients. No blur. No opacity tricks.
//    Large readable typography. Bold structural hierarchy.
//    Every element earns its place.
//
//  Palette (Vibrant Institutional Light Mode):
//    Canvas      #F4FBF6   page background
//    Surface     #FFFFFF   cards and panels
//    Border      #D7F2E0   all structural edges
//    Ink-1       #0B1F14   primary text
//    Ink-2       #3D5347   secondary text
//    Ink-3       #6B8479   tertiary / helper
//    Accent      #4AE17A   brand green — buttons, active states
//    Accent-Hov  #22B85C   hover/pressed states
//    Accent-L    #E7FBEE   accent light fill
//    Error-bg    #FEF2F2
//    Error-text  #991B1B
//    Error-bdr   #FCA5A5
//    Success-bg  #E7FBEE
//    Success-txt #15803D
//    Success-bdr #86EFAC
// ================================================================

import React, {
  useEffect,
  useRef,
  useState,
}                                     from 'react';
import { useNavigate, useLocation }   from 'react-router-dom';
import {
  BookOpen,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Users,
  GraduationCap,
}                                     from 'lucide-react';

import axiosInstance                  from '../../api/axiosInstance';
import { useAuth }                    from '../../context/AuthContext';
import type {
  StaffLoginResponse,
  StaffRole,
}                                     from '../../types/auth';


// ── CONSTANTS ─────────────────────────────────────────────────────

const ROLE_DASHBOARD: Record<StaffRole, string> = {
  super_admin : '/dashboard/superadmin',
  admin       : '/dashboard/admin',
  teacher     : '/dashboard/teacher',
} as const;


// ── TYPES ─────────────────────────────────────────────────────────

interface LocationState { from?: string }
interface FormState     { email: string; password: string }
interface FormErrors    { email?: string; password?: string }


// ── VALIDATION ────────────────────────────────────────────────────

function validateForm(values: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!values.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (values.password.length < 8) {
    errors.password = 'Minimum 8 characters required.';
  }
  return errors;
}


// ================================================================
//  COMPONENT
// ================================================================

export default function StaffLoginPage(): React.JSX.Element {
  const { loginStaff, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form,         setForm]         = useState<FormState>({ email: '', password: '' });
  const [formErrors,   setFormErrors]   = useState<FormErrors>({});
  const [apiError,     setApiError]     = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const emailRef   = useRef<HTMLInputElement>(null);
  const submitLock = useRef<boolean>(false);

  useEffect((): void => {
    if (isAuthenticated && role !== null && role !== 'student') {
      navigate(ROLE_DASHBOARD[role as StaffRole], { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  useEffect((): void => { emailRef.current?.focus(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    setApiError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitLock.current || isSubmitting) return;

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    submitLock.current = true;
    setIsSubmitting(true);
    setApiError(null);
    setFormErrors({});

    try {
      const response = await axiosInstance.post<StaffLoginResponse>(
        '/api/auth/staff/login',
        { email: form.email.trim().toLowerCase(), password: form.password }
      );

      if (response.data.success) {
        const { token, user } = response.data;
        loginStaff(token, user);
        const state       = location.state as LocationState | null;
        const destination = state?.from ?? ROLE_DASHBOARD[user.role];
        navigate(destination, { replace: true });
      }
    } catch (thrown: unknown) {
      submitLock.current = false;
      setIsSubmitting(false);

      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err    = thrown as {
          response?: { status?: number; data?: { message?: string } };
          request?: unknown;
        };
        const status = err.response?.status;
        const msg    = err.response?.data?.message;

        if (status === 401) {
          setApiError('Invalid email or password. Please check your credentials and try again.');
          setForm((prev) => ({ ...prev, password: '' }));
        } else if (status === 403) {
          setApiError('Your account has been suspended. Contact your system administrator.');
        } else if (status !== undefined && status >= 500) {
          setApiError('Server error. Please try again or contact IT support.');
        } else if (err.request !== undefined && err.response === undefined) {
          setApiError('Cannot reach the server. Check that the CBT server is powered on and connected to the network.');
        } else {
          setApiError(msg ?? 'An unexpected error occurred. Please try again.');
        }
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
    }
  };

  // Input field class builder
  const inputCls = (field: keyof FormErrors): string => [
    'w-full bg-white border-2 rounded-xl px-4 py-4 text-[#0B1F14] text-base',
    'placeholder:text-[#6B8479] transition-all duration-100',
    'focus:outline-none',
    formErrors[field]
      ? 'border-[#FCA5A5] focus:border-[#991B1B]'
      : 'border-[#D7F2E0] focus:border-[#4AE17A]',
  ].join(' ');


  // ================================================================
  //  RENDER
  // ================================================================

  return (
    <div className="min-h-screen bg-[#F4FBF6] flex flex-col">


      {/* ── Main body — two-column layout ───────────────────────── */}
      <main className="flex-1 flex">

        {/* LEFT PANEL — decorative info column */}
        <div className="hidden lg:flex lg:w-[45%] bg-[#0B1F14] flex-col justify-between p-12 xl:p-16">

          {/* Top content */}
          <div>
            {/* Large icon */}
            <div className="w-16 h-16 rounded-2xl bg-[#4AE17A]/10 border border-[#4AE17A]/20 flex items-center justify-center mb-10">
              <BookOpen size={32} className="text-[#4AE17A]" />
            </div>

            {/* Hero copy */}
            <h2 className="text-white text-4xl xl:text-5xl font-bold leading-tight mb-5">
              Examination<br />
              Management<br />
              Platform
            </h2>
            <p className="text-white/70 text-lg leading-relaxed max-w-sm">
              A complete offline CBT solution built for secondary schools.
              Manage exams, students, and results — all on your local network.
            </p>

            {/* Divider */}
            <div className="w-12 h-1 bg-[#4AE17A]/30 rounded-full my-8" />

            {/* Feature list */}
            <div className="space-y-4">
              {[
                { icon: <ShieldCheck size={18} />, text: '2,000+ students across multiple branches' },
                { icon: <GraduationCap size={18} />, text: 'Real-time grading with crash recovery' },
                { icon: <Users size={18} />, text: 'Full role hierarchy — Super Admin to Student' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#4AE17A]/10 border border-[#4AE17A]/20 flex items-center justify-center flex-shrink-0 text-[#4AE17A]">
                    {icon}
                  </div>
                  <p className="text-white/80 text-base">{text}</p>
                </div>
              ))}
            </div>
          </div>

          
        </div>


        {/* RIGHT PANEL — login form */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">

            {/* Page heading */}
            <div className="mb-8">
              <h1 className="text-[#0B1F14] text-3xl font-bold tracking-tight mb-2">
                Sign in to your account
              </h1>
              <p className="text-[#6B8479] text-base">
                Enter your email and password to continue
              </p>
            </div>

            {/* ── Error banner ──────────────────────────────────── */}
            {apiError !== null && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-4 mb-6">
                <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                <p className="text-[#991B1B] text-base leading-snug">{apiError}</p>
              </div>
            )}

            {/* ── Login form card ───────────────────────────────── */}
            <div className="bg-white border border-[#D7F2E0] rounded-2xl p-8">
              <form onSubmit={handleSubmit} noValidate className="space-y-6">

                {/* Email */}
                <div>
                  <label
                    htmlFor   = "email"
                    className = "block text-[#0B1F14] text-base font-semibold mb-2"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      size      = {18}
                      className = "absolute left-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none"
                    />
                    <input
                      ref          = {emailRef}
                      id           = "email"
                      name         = "email"
                      type         = "email"
                      autoComplete = "email"
                      value        = {form.email}
                      onChange     = {handleChange}
                      disabled     = {isSubmitting}
                      placeholder  = "admin@school.edu.ng"
                      aria-invalid = {formErrors.email !== undefined}
                      className    = {`${inputCls('email')} pl-12`}
                    />
                  </div>
                  {formErrors.email !== undefined && (
                    <p className="mt-2 text-[#991B1B] text-sm flex items-center gap-1.5">
                      <AlertCircle size={13} />
                      {formErrors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor   = "password"
                    className = "block text-[#0B1F14] text-base font-semibold mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      size      = {18}
                      className = "absolute left-4 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none"
                    />
                    <input
                      id           = "password"
                      name         = "password"
                      type         = {showPassword ? 'text' : 'password'}
                      autoComplete = "current-password"
                      value        = {form.password}
                      onChange     = {handleChange}
                      disabled     = {isSubmitting}
                      placeholder  = "Enter your password"
                      aria-invalid = {formErrors.password !== undefined}
                      className    = {`${inputCls('password')} pl-12 pr-14`}
                    />
                    <button
                      type      = "button"
                      tabIndex  = {-1}
                      onClick   = {() => setShowPassword((p) => !p)}
                      className = "absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[#6B8479] hover:text-[#3D5347] transition-colors"
                      aria-label= {showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {formErrors.password !== undefined && (
                    <p className="mt-2 text-[#991B1B] text-sm flex items-center gap-1.5">
                      <AlertCircle size={13} />
                      {formErrors.password}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type      = "submit"
                  disabled  = {isSubmitting}
                  className = {[
                    'w-full flex items-center justify-center gap-3 px-6 py-4',
                    'rounded-xl text-base font-bold transition-colors duration-100',
                    'focus:outline-none focus:ring-2 focus:ring-[#86EFAC] focus:ring-offset-2',
                    isSubmitting
                      ? 'bg-[#E7FBEE] text-[#15803D] cursor-not-allowed'
                      : 'bg-[#4AE17A] hover:bg-[#22B85C] active:bg-[#1A9C4B] text-[#0B1F14]',
                  ].join(' ')}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </form>
            </div>




            {/* ── Student portal link ───────────────────────────── */}
            <div className="mt-6 bg-white border border-[#D7F2E0] rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[#0B1F14] text-base font-semibold">
                  Student Exam Terminal
                </p>
               
              </div>
              <button
                type      = "button"
                onClick   = {() => navigate('/login/student')}
                className = "flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-sm font-semibold hover:bg-[#E7FBEE] hover:border-[#4AE17A] hover:text-[#15803D] transition-colors whitespace-nowrap flex-shrink-0"
              >
                Student Login
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-center text-center">
              <p
                
                className = "text-[#6B8479] text-sm  transition-colors font-bold"
              >
                Powered by
              </p>
                <img src='/logo.png' className='w-22 -ml-2' />

            </div>
          </div>
          
        </div>
        
      </main>


     
    </div>
  );
}