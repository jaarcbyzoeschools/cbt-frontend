// ================================================================
//  CBT SYSTEM — STUDENT EXAM LOGIN TERMINAL
//  File    : src/pages/auth/StudentLoginPage.tsx
//
//  Design system: Vibrant Institutional Light Mode
//  Same palette as StaffLoginPage — consistent system identity.
//
//  UX decisions carried forward:
//    — Auto-submit on 5th character (no button needed)
//    — Auto-focus on mount
//    — Uppercase conversion + silent strip of invalid chars
//    — Crash recovery via location.state.from
//    — Specific error messages per status code
// ================================================================

import React, {
  useEffect,
  useRef,
  useState,
}                                   from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  KeyRound,

  RefreshCw,
 
}                                   from 'lucide-react';

import axiosInstance                from '../../api/axiosInstance';
import { useAuth }                  from '../../context/AuthContext';
import type { StudentLoginResponse } from '../../types/auth';
import {
  sanitisePin,
  isValidPin,
  pinToCharArray,
  PIN_LENGTH,
}                                   from '../../utils/pinFormatter';


// ── TYPES ─────────────────────────────────────────────────────────

interface LocationState { from?: string }

type PinState = 'idle' | 'typing' | 'verifying' | 'success' | 'error';


// ================================================================
//  COMPONENT
// ================================================================

export default function StudentLoginPage(): React.JSX.Element {
  const { loginStudent, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [pinValue,     setPinValue]     = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error,        setError]        = useState<string | null>(null);
  const [succeeded,    setSucceeded]    = useState<boolean>(false);

  const inputRef        = useRef<HTMLInputElement>(null);
  const hasSubmittedRef = useRef<boolean>(false);

  // Derived PIN state for clean rendering logic
  const pinState: PinState =
    succeeded                      ? 'success'   :
    isSubmitting                   ? 'verifying' :
    error !== null                 ? 'error'     :
    pinValue.length > 0            ? 'typing'    :
                                     'idle';

  // Redirect if already authenticated as student
  useEffect((): void => {
    if (isAuthenticated && role === 'student') {
      navigate('/student/lobby', { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  // Auto-focus on mount
  useEffect((): void => { inputRef.current?.focus(); }, []);


  // ── PIN SUBMISSION ────────────────────────────────────────────

  const submitPin = async (pin: string): Promise<void> => {
    if (hasSubmittedRef.current || isSubmitting) return;
    hasSubmittedRef.current = true;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await axiosInstance.post<StudentLoginResponse>(
        '/api/auth/student/login',
        { login_pin: pin }
      );

      if (response.data.success) {
        const { token, student } = response.data;
        loginStudent(token, student);
        setSucceeded(true);

        const state       = location.state as LocationState | null;
        const destination = state?.from ?? '/student/lobby';

        setTimeout((): void => {
          navigate(destination, { replace: true });
        }, 700);
      }
    } catch (thrown: unknown) {
      hasSubmittedRef.current = false;
      setIsSubmitting(false);
      setPinValue('');
      inputRef.current?.focus();

      if (thrown !== null && typeof thrown === 'object' && 'response' in thrown) {
        const err     = thrown as { response?: { status?: number; data?: { message?: string } } };
        const status  = err.response?.status;
        const message = err.response?.data?.message;

        if (status === 403) {
          setError('Your account has been deactivated. Contact your teacher or exam officer.');
        } else if (status === 401 || status === 404) {
          setError('Invalid Exam PIN. Please check your PIN card and try again.');
        } else if (message !== undefined) {
          setError(message);
        } else {
          setError('Cannot reach the server. Check that the CBT server is powered on.');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    }
  };


  // ── INPUT HANDLER ─────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const cleaned = sanitisePin(e.target.value);
    setPinValue(cleaned);
    if (error !== null) setError(null);
    if (isValidPin(cleaned) && !hasSubmittedRef.current && !isSubmitting) {
      void submitPin(cleaned);
    }
  };

  const handleReset = (): void => {
    setPinValue('');
    setError(null);
    hasSubmittedRef.current = false;
    setTimeout((): void => inputRef.current?.focus(), 50);
  };


  // ── PIN CHARACTER BOX RENDERER ────────────────────────────────

  const charArray   = pinToCharArray(pinValue);
  const activeIndex = Math.min(pinValue.length, PIN_LENGTH - 1);

  const renderPinBoxes = (): React.JSX.Element[] =>
    charArray.map((char, index) => {
      const isFilled = char !== '';
      const isActive = index === activeIndex && pinState === 'typing';

      // Box visual state → exact token
      let boxCls: string;

      if (pinState === 'success') {
        boxCls = 'bg-[#E7FBEE] border-2 border-[#86EFAC] text-[#15803D]';
      } else if (pinState === 'error') {
        boxCls = 'bg-[#FEF2F2] border-2 border-[#FCA5A5] text-[#991B1B]';
      } else if (pinState === 'verifying' && isFilled) {
        boxCls = 'bg-[#E7FBEE] border-2 border-[#86EFAC] text-[#15803D]';
      } else if (isFilled && isActive) {
        boxCls = 'bg-[#E7FBEE] border-2 border-[#4AE17A] text-[#15803D]';
      } else if (isFilled) {
        boxCls = 'bg-[#E7FBEE] border-2 border-[#86EFAC] text-[#15803D]';
      } else if (isActive) {
        boxCls = 'bg-white border-2 border-[#4AE17A] text-[#0B1F14]';
      } else {
        boxCls = 'bg-[#F4FBF6] border-2 border-[#D7F2E0] text-[#6B8479]';
      }

      return (
        <div
          key       = {index}
          className = {`w-14 h-16 rounded-xl flex items-center justify-center text-2xl font-bold transition-all duration-100 select-none ${boxCls}`}
        >
          {pinState === 'success'
            ? (char !== '' ? char : '')
            : char
          }
        </div>
      );
    });


  // ================================================================
  //  RENDER
  // ================================================================

  return (
    <div className="min-h-screen bg-[#F4FBF6] flex flex-col">

      {/* ── Main body — two column ──────────────────────────────── */}
      <main className="flex-1 flex">

        {/* LEFT PANEL — instructions */}
        <div className="hidden lg:flex lg:w-[45%] bg-[#0B1F14] flex-col justify-between p-12 xl:p-16">

          <div>
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-[#4AE17A]/10 border border-[#4AE17A]/20 flex items-center justify-center mb-10">
              <KeyRound size={32} className="text-[#4AE17A]" />
            </div>

            {/* Hero copy */}
            <h2 className="text-white text-4xl xl:text-5xl font-bold leading-tight mb-5">
              Student<br />
              Examination<br />
              Terminal
            </h2>
            <p className="text-white/70 text-lg leading-relaxed max-w-sm">
              Enter your unique 5-character Exam PIN to access your assigned exams for this session.
            </p>

            <div className="w-12 h-1 bg-[#4AE17A]/30 rounded-full my-8" />

            {/* Step-by-step instructions */}
            <div className="space-y-5">
              {[
                {
                  step: '01',
                  title: 'Locate your PIN card',
                  desc : 'Your teacher issued a printed card with your unique 5-character PIN.',
                },
                {
                  step: '02',
                  title: 'Type your PIN',
                  desc : 'Enter the 5 characters — the system submits automatically when complete.',
                },
                {
                  step: '03',
                  title: 'Select your exam',
                  desc : 'Choose from your available exams on the lobby screen.',
                },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#4AE17A]/10 border border-[#4AE17A]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#4AE17A] text-sm font-bold">{step}</span>
                  </div>
                  <div>
                    <p className="text-white text-base font-semibold leading-tight">{title}</p>
                    <p className="text-white/60 text-sm mt-0.5 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Crash recovery note */}
          
        </div>


        {/* RIGHT PANEL — PIN entry */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">

            {/* Page heading */}
            <div className="mb-8">
              <h1 className="text-[#0B1F14] text-3xl font-bold tracking-tight mb-2">
                Enter your Exam PIN
              </h1>
              <p className="text-[#6B8479] text-base">
                Type your 5-character PIN — the system logs you in automatically
              </p>
            </div>

            {/* ── PIN entry card ─────────────────────────────────── */}
            <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">

              {/* Card header */}
              <div className="bg-[#F4FBF6] border-b border-[#D7F2E0] px-6 py-3.5 flex items-center gap-2">
                <KeyRound size={15} className="text-[#15803D]" />
                <span className="text-[#3D5347] text-sm font-semibold">
                  PIN Authentication
                </span>
                {pinState === 'verifying' && (
                  <div className="ml-auto flex items-center gap-1.5 text-[#15803D]">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-sm font-medium">Verifying…</span>
                  </div>
                )}
                {pinState === 'success' && (
                  <div className="ml-auto flex items-center gap-1.5 text-[#15803D]">
                    <CheckCircle size={14} />
                    <span className="text-sm font-medium">Verified</span>
                  </div>
                )}
              </div>

              <div className="px-8 py-8">

                {/* PIN boxes — the visual centrepiece */}
                <div className="flex items-center justify-center gap-3 mb-7">
                  {renderPinBoxes()}
                </div>

                {/* Hidden real input */}
                <input
                  ref           = {inputRef}
                  type          = "text"
                  inputMode     = "text"
                  autoComplete  = "off"
                  autoCorrect   = "off"
                  autoCapitalize= "characters"
                  spellCheck    = {false}
                  maxLength     = {PIN_LENGTH}
                  value         = {pinValue}
                  onChange      = {handleInputChange}
                  disabled      = {isSubmitting || succeeded}
                  aria-label    = "Enter your 5-character Exam PIN"
                  className     = {[
                    'w-full border-2 rounded-xl px-4 py-4 text-center',
                    'text-[#0B1F14] text-xl font-bold tracking-[0.6em]',
                    'placeholder:tracking-normal placeholder:text-[#6B8479]',
                    'placeholder:text-base placeholder:font-normal',
                    'transition-all duration-100 focus:outline-none',
                    isSubmitting || succeeded
                      ? 'bg-[#F4FBF6] border-[#D7F2E0] cursor-not-allowed'
                      : pinState === 'error'
                      ? 'bg-[#FEF2F2] border-[#FCA5A5] focus:border-[#991B1B]'
                      : 'bg-white border-[#D7F2E0] focus:border-[#4AE17A]',
                  ].join(' ')}
                  placeholder   = "_ _ _ _ _"
                />

                {/* Status message area */}
                <div className="mt-5 min-h-[52px]">

                  {/* Error */}
                  {pinState === 'error' && (
                    <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                      <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#991B1B] text-base leading-snug">{error}</p>
                      </div>
                      <button
                        type      = "button"
                        onClick   = {handleReset}
                        className = "flex-shrink-0 p-1.5 rounded-lg hover:bg-[#FCA5A5]/30 text-[#991B1B] transition-colors"
                        title     = "Clear and retry"
                      >
                        <RefreshCw size={15} />
                      </button>
                    </div>
                  )}

                  {/* Success */}
                  {pinState === 'success' && (
                    <div className="flex items-center gap-3 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-4 py-3">
                      <CheckCircle size={18} className="text-[#15803D] flex-shrink-0" />
                      <p className="text-[#15803D] text-base font-semibold">
                        PIN verified — loading your exams…
                      </p>
                    </div>
                  )}

                  {/* Verifying */}
                  {pinState === 'verifying' && (
                    <div className="flex items-center gap-3 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-4 py-3">
                      <Loader2 size={18} className="text-[#15803D] flex-shrink-0 animate-spin" />
                      <p className="text-[#15803D] text-base font-semibold">
                        Verifying your PIN…
                      </p>
                    </div>
                  )}

                  {/* Idle / typing helper */}
                  {(pinState === 'idle' || pinState === 'typing') && (
                    <div className="flex items-center justify-between">
                      <p className="text-[#6B8479] text-sm">
                        {pinState === 'idle'
                          ? 'Begin typing your PIN to get started'
                          : `${PIN_LENGTH - pinValue.length} character${PIN_LENGTH - pinValue.length !== 1 ? 's' : ''} remaining`
                        }
                      </p>
                      {/* PIN character counter dots */}
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                          <div
                            key       = {i}
                            className = {`w-2 h-2 rounded-full transition-all duration-100 ${
                              i < pinValue.length
                                ? 'bg-[#4AE17A]'
                                : 'bg-[#D7F2E0]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card footer */}
              <div className="bg-[#F4FBF6] border-t border-[#D7F2E0] px-6 py-3.5">
                <p className="text-[#6B8479] text-sm text-center">
                  PIN not working?{' '}
                  <span className="text-[#3D5347] font-semibold">
                    Contact your teacher or exam officer
                  </span>
                </p>
              </div>
            </div>


            


            {/* ── Staff portal link ────────────────────────────────── */}
            <div className="mt-5 text-center">
              <button
                type      = "button"
                onClick   = {() => navigate('/login/staff')}
                className = "text-[#6B8479] text-sm hover:text-[#15803D] transition-colors font-medium"
              >
                Staff administration portal →
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