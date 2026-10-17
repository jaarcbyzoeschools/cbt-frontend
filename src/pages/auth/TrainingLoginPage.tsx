// ================================================================
//  CBT SYSTEM — TRAINING CANDIDATE LOGIN
//  File    : src/pages/auth/TrainingLoginPage.tsx
//  Design  : Vibrant Institutional Light Mode (matches StudentLoginPage)
//
//  For JAARC training-course candidates (outsiders, not school
//  students). Their PIN is 6 characters and always starts with "T",
//  so it can never be confused with a 5-character student PIN.
//  Logs in through POST /api/auth/candidate/login and shares the
//  student session slot, so the normal exam room works unchanged.
// ================================================================

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, GraduationCap, KeyRound, Loader2, RefreshCw } from 'lucide-react';

import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import type { Student } from '../../types/auth';
import { isCandidate, TRAINING_LOBBY_PATH } from '../../utils/participant';

const PIN_LENGTH = 6;
const PIN_PATTERN = /^T[A-Z0-9]{5}$/;

interface CandidateLoginResponse {
  success: boolean;
  message: string;
  token  : string;
  student: Student;
}

type PinState = 'idle' | 'typing' | 'verifying' | 'success' | 'error';

function sanitise(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, PIN_LENGTH);
}

export default function TrainingLoginPage(): React.JSX.Element {
  const { loginStudent, student } = useAuth();
  const navigate = useNavigate();

  const [pin,          setPin]          = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error,        setError]        = useState<string | null>(null);
  const [succeeded,    setSucceeded]    = useState<boolean>(false);

  const inputRef        = useRef<HTMLInputElement>(null);
  const hasSubmittedRef = useRef<boolean>(false);

  const pinState: PinState =
    succeeded        ? 'success'   :
    isSubmitting     ? 'verifying' :
    error !== null   ? 'error'     :
    pin.length > 0   ? 'typing'    :
                       'idle';

  // Already logged in as a candidate → straight to the lobby
  useEffect((): void => {
    if (isCandidate(student)) navigate(TRAINING_LOBBY_PATH, { replace: true });
  }, [student, navigate]);

  useEffect((): void => { inputRef.current?.focus(); }, []);

  const submit = async (value: string): Promise<void> => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await axiosInstance.post<CandidateLoginResponse>(
        '/api/auth/candidate/login',
        { login_pin: value }
      );
      if (res.data.success) {
        loginStudent(res.data.token, res.data.student);
        setSucceeded(true);
        setTimeout((): void => navigate(TRAINING_LOBBY_PATH, { replace: true }), 600);
      }
    } catch (thrown: unknown) {
      hasSubmittedRef.current = false;
      setIsSubmitting(false);
      setPin('');
      inputRef.current?.focus();
      const err = thrown as { response?: { status?: number; data?: { message?: string } } };
      const status = err?.response?.status;
      if (status === 403) {
        setError('Your access has been deactivated. Please contact the exam officer.');
      } else if (status === 401) {
        setError('PIN not recognised. Check your PIN slip and try again.');
      } else if (err?.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Cannot reach the server. Check that the CBT server is on.');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const cleaned = sanitise(e.target.value);
    setPin(cleaned);
    if (error !== null) setError(null);
    if (cleaned.length === PIN_LENGTH && PIN_PATTERN.test(cleaned) && !isSubmitting) {
      void submit(cleaned);
    }
  };

  const reset = (): void => {
    setPin('');
    setError(null);
    hasSubmittedRef.current = false;
    setTimeout((): void => inputRef.current?.focus(), 50);
  };

  const wrongStart = pin.length > 0 && pin[0] !== 'T';
  const fullButInvalid = pin.length === PIN_LENGTH && !PIN_PATTERN.test(pin);

  const boxes = Array.from({ length: PIN_LENGTH }, (_, i) => pin[i] ?? '');
  const activeIndex = Math.min(pin.length, PIN_LENGTH - 1);

  return (
    <div className="min-h-screen bg-[#F4FBF6] flex flex-col">
      <main className="flex-1 flex">

        {/* LEFT — instructions */}
        <div className="hidden lg:flex lg:w-[45%] bg-[#0B1F14] flex-col justify-between p-12 xl:p-16">
          <div>
            <div className="w-16 h-16 rounded-2xl bg-[#4AE17A]/10 border border-[#4AE17A]/20 flex items-center justify-center mb-10">
              <GraduationCap size={32} className="text-[#4AE17A]" />
            </div>
            <h2 className="text-white text-4xl xl:text-5xl font-bold leading-tight mb-5">
              Training<br />Course<br />Examination
            </h2>
            <p className="text-white/70 text-lg leading-relaxed max-w-sm">
              For JAARC training-course candidates. Enter the 6-character PIN on your slip — it starts with the letter T.
            </p>
            <div className="w-12 h-1 bg-[#4AE17A]/30 rounded-full my-8" />
            <div className="space-y-5">
              {[
                { step: '01', title: 'Find your PIN slip',  desc: 'Your PIN looks like T4K9P2 — six characters starting with T.' },
                { step: '02', title: 'Type the whole PIN',   desc: 'Include the T. You are logged in automatically.' },
                { step: '03', title: 'Start your paper',     desc: 'Your course papers are listed on the next screen.' },
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
        </div>

        {/* RIGHT — PIN entry */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-[#0B1F14] text-3xl font-bold tracking-tight mb-2">Enter your Training PIN</h1>
              <p className="text-[#6B8479] text-base">Six characters, starting with T</p>
            </div>

            <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
              <div className="bg-[#F4FBF6] border-b border-[#D7F2E0] px-6 py-3.5 flex items-center gap-2">
                <KeyRound size={15} className="text-[#15803D]" />
                <span className="text-[#3D5347] text-sm font-semibold">Candidate Login</span>
                {pinState === 'verifying' && (
                  <span className="ml-auto flex items-center gap-1.5 text-[#15803D] text-sm font-medium">
                    <Loader2 size={14} className="animate-spin" /> Verifying…
                  </span>
                )}
                {pinState === 'success' && (
                  <span className="ml-auto flex items-center gap-1.5 text-[#15803D] text-sm font-medium">
                    <CheckCircle size={14} /> Verified
                  </span>
                )}
              </div>

              <div className="px-6 sm:px-8 py-8">
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-7">
                  {boxes.map((ch, i) => {
                    const filled = ch !== '';
                    const active = i === activeIndex && pinState === 'typing';
                    const cls =
                      pinState === 'success' || (pinState === 'verifying' && filled) ? 'bg-[#E7FBEE] border-[#86EFAC] text-[#15803D]' :
                      pinState === 'error'                                          ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]' :
                      filled && active                                              ? 'bg-[#E7FBEE] border-[#4AE17A] text-[#15803D]' :
                      filled                                                        ? 'bg-[#E7FBEE] border-[#86EFAC] text-[#15803D]' :
                      active                                                        ? 'bg-white border-[#4AE17A] text-[#0B1F14]' :
                                                                                      'bg-[#F4FBF6] border-[#D7F2E0] text-[#6B8479]';
                    return (
                      <div key={i} className={`w-11 h-14 sm:w-12 sm:h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-bold select-none transition-all duration-100 ${cls}`}>
                        {ch || (i === 0 && pin.length === 0 ? <span className="text-[#6B8479]/50">T</span> : '')}
                      </div>
                    );
                  })}
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={PIN_LENGTH}
                  value={pin}
                  onChange={handleChange}
                  disabled={isSubmitting || succeeded}
                  aria-label="Enter your 6-character training PIN"
                  placeholder="T _ _ _ _ _"
                  className={[
                    'w-full border-2 rounded-xl px-4 py-4 text-center text-[#0B1F14] text-xl font-bold tracking-[0.5em]',
                    'placeholder:tracking-normal placeholder:text-[#6B8479] placeholder:text-base placeholder:font-normal',
                    'transition-all duration-100 focus:outline-none',
                    isSubmitting || succeeded ? 'bg-[#F4FBF6] border-[#D7F2E0] cursor-not-allowed'
                      : pinState === 'error' ? 'bg-[#FEF2F2] border-[#FCA5A5]'
                      : 'bg-white border-[#D7F2E0] focus:border-[#4AE17A]',
                  ].join(' ')}
                />

                <div className="mt-5 min-h-[52px]">
                  {pinState === 'error' && (
                    <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                      <AlertCircle size={18} className="text-[#991B1B] flex-shrink-0 mt-0.5" />
                      <p className="text-[#991B1B] text-base leading-snug flex-1">{error}</p>
                      <button type="button" onClick={reset} title="Clear and retry"
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[#FCA5A5]/30 text-[#991B1B] transition-colors">
                        <RefreshCw size={15} />
                      </button>
                    </div>
                  )}
                  {pinState === 'success' && (
                    <div className="flex items-center gap-3 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-4 py-3">
                      <CheckCircle size={18} className="text-[#15803D]" />
                      <p className="text-[#15803D] text-base font-semibold">PIN verified — loading your papers…</p>
                    </div>
                  )}
                  {pinState === 'verifying' && (
                    <div className="flex items-center gap-3 bg-[#E7FBEE] border border-[#86EFAC] rounded-xl px-4 py-3">
                      <Loader2 size={18} className="text-[#15803D] animate-spin" />
                      <p className="text-[#15803D] text-base font-semibold">Verifying your PIN…</p>
                    </div>
                  )}
                  {(pinState === 'idle' || pinState === 'typing') && (
                    wrongStart || fullButInvalid ? (
                      <p className="text-[#92400E] text-sm">
                        Training PINs start with the letter <span className="font-bold">T</span>. Students should use the{' '}
                        <button type="button" onClick={() => navigate('/login/student')} className="underline font-semibold">student login</button>.
                      </p>
                    ) : (
                      <p className="text-[#6B8479] text-sm">
                        {pin.length === 0 ? 'Begin typing your PIN' : `${PIN_LENGTH - pin.length} character${PIN_LENGTH - pin.length === 1 ? '' : 's'} remaining`}
                      </p>
                    )
                  )}
                </div>
              </div>

              <div className="bg-[#F4FBF6] border-t border-[#D7F2E0] px-6 py-3.5">
                <p className="text-[#6B8479] text-sm text-center">
                  PIN not working? <span className="text-[#3D5347] font-semibold">Ask the exam officer</span>
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-5 text-sm">
              <button type="button" onClick={() => navigate('/login/student')}
                className="text-[#6B8479] hover:text-[#15803D] transition-colors font-medium">
                School student login →
              </button>
              <button type="button" onClick={() => navigate('/login/staff')}
                className="text-[#6B8479] hover:text-[#15803D] transition-colors font-medium">
                Staff portal →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
