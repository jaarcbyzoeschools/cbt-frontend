// ================================================================
//  CBT SYSTEM — STUDENT DASHBOARD PAGE
//  File    : src/pages/student/StudentDashboardPage.tsx
//
//  NEW — replaces the old StudentLobbyPage as the /student/lobby
//  landing page. Redesigned per the reference layout the user
//  provided: stat cards row + Open Tests, in this app's green
//  palette. Class+Arm/Term/Session now live in the shared
//  StudentDashboardLayout's top bar instead of repeating them here.
//
//  The exam-card rendering (ExamCard, AllDoneCard) is duplicated
//  from the old StudentLobbyPage.tsx rather than extracted into a
//  shared file — both are self-contained, prop-driven components,
//  and duplicating them here is lower-risk than a shared-file
//  refactor done mid-build.
//
//  "Live subject scores" (an aggregated per-subject bar chart) was
//  explicitly confirmed OUT of scope here — Open Tests is the only
//  dashboard content, matching what was actually asked for.
// ================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen,
  Clock,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  FileQuestion,
  PartyPopper,
  Trophy,
  Timer,
  ChevronDown,
  PlayCircle,
  IdCard,
  Layers,
  // GraduationCap,
} from "lucide-react";

import axiosInstance from "../../api/axiosInstance";
import type { Exam } from "../../types/exam";
import { formatDuration } from "../../utils/timeFormatter";

// ================================================================
//  TYPES
// ================================================================

interface ExamListResponse {
  success: boolean;
  count: number;
  exams: Exam[];
}
interface LobbyLocationState {
  examCompleted?: boolean;
}
interface MyProfileResponse {
  success: boolean;
  student: {
    full_name: string;
    class_name: string;
    arm_name: string | null;
    department_name: string;
    admission_number: string | null;
  };
}

// ================================================================
//  EXAM CARD (duplicated from the old lobby page — see header note)
// ================================================================

function ExamCard({
  exam,
  onStart,
}: {
  exam: Exam;
  onStart: (id: number) => void;
}): React.JSX.Element {
  const [rulesOpen, setRulesOpen] = useState<boolean>(false);

  const RULES = [
    {
      icon: <Timer size={13} />,
      text: "Timer starts immediately and counts down in real time.",
    },
    {
      icon: <ChevronRight size={13} />,
      text: "Navigating away or pressing back auto-submits the exam.",
    },
    {
      icon: <RefreshCw size={13} />,
      text: "Power cut? Log back in with your PIN on any machine to recover.",
    },
    {
      icon: <FileQuestion size={13} />,
      text: "Unanswered questions count as wrong — answer all before submitting.",
    },
  ];

  return (
    <div className="bg-white border-2 border-[#D7F2E0] rounded-2xl overflow-hidden hover:border-[#4AE17A] transition-all duration-200 group">
      <div className="h-1 w-full bg-[#4AE17A]" />
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-sm font-semibold">
            <Layers size={12} className="text-[#6B8479]" />
            {exam.subject_name}
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E7FBEE] border border-[#4AE17A] text-[#15803D] text-sm font-bold">
            <span className="w-2 h-2 rounded-full bg-[#4AE17A] animate-pulse" />
            Live
          </span>
        </div>

        <h3 className="text-[#0B1F14] text-lg font-bold leading-snug mb-4">
          {exam.exam_title}
        </h3>

        <div className="flex flex-wrap gap-2 mb-5">
          {/* <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-sm font-medium">
            <GraduationCap size={12} className="text-[#6B8479]" />
            {exam.class_name}
          </span> */}
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-sm font-medium">
            <Clock size={12} className="text-[#6B8479]" />
            {formatDuration(exam.duration_minutes)}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-sm font-medium">
            <FileQuestion size={12} className="text-[#6B8479]" />
            {exam.total_questions_to_show} questions
          </span>
        </div>

        <div className="border border-[#D7F2E0] rounded-xl overflow-hidden mb-4">
          <button
            type="button"
            onClick={() => setRulesOpen((p) => !p)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors text-left"
          >
            <span className="text-[#3D5347] text-sm font-semibold flex items-center gap-2">
              <AlertCircle size={14} className="text-[#92400E]" />
              Before you start — read exam rules
            </span>
            <ChevronDown
              size={14}
              className={`text-[#6B8479] transition-transform duration-200 flex-shrink-0 ${rulesOpen ? "rotate-180" : ""}`}
            />
          </button>
          {rulesOpen && (
            <div className="px-4 py-3 bg-[#FFFBEB] border-t border-[#FCD34D] space-y-2.5">
              {RULES.map((rule, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-lg bg-white border border-[#D7F2E0] flex items-center justify-center flex-shrink-0 mt-0.5 text-[#92400E]">
                    {rule.icon}
                  </div>
                  <p className="text-[#92400E] text-sm leading-relaxed">
                    {rule.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onStart(exam.exam_id)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#4AE17A] hover:bg-[#22B85C] active:bg-[#1A9C4B] text-[#0B1F14] text-base font-bold transition-all duration-150"
        >
          <PlayCircle size={18} />
          <span>Start Exam</span>
        </button>
      </div>
    </div>
  );
}

// ================================================================
//  ALL DONE CARD (duplicated — see header note)
// ================================================================

function AllDoneCard({
  studentFirstName,
  onRefresh,
  isLoading,
}: {
  studentFirstName: string;
  onRefresh: () => void;
  isLoading: boolean;
}): React.JSX.Element {
  return (
    <div className="bg-white border-2 border-[#D7F2E0] rounded-2xl px-6 py-14 text-center">
      <div className="w-20 h-20 rounded-3xl bg-[#E7FBEE] border-2 border-[#4AE17A] flex items-center justify-center mx-auto mb-5">
        <Trophy size={38} className="text-[#15803D]" />
      </div>
      <div className="flex items-center justify-center gap-2 mb-2">
        <PartyPopper size={18} className="text-[#92400E]" />
        <h3 className="text-[#0B1F14] text-xl font-bold">
          Well done, {studentFirstName}!
        </h3>
        <PartyPopper size={18} className="text-[#92400E]" />
      </div>
      <p className="text-[#15803D] text-base font-semibold mb-3">
        All exams completed
      </p>
      <p className="text-[#6B8479] text-base max-w-xs mx-auto leading-relaxed mb-8">
        You have submitted all your available exams. Check "My Results" in the
        sidebar to review your history, or wait for your teacher to activate
        more exams.
      </p>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-base font-semibold hover:bg-[#E7FBEE] hover:border-[#4AE17A] transition-colors disabled:opacity-50 mx-auto"
      >
        <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
        Check for New Exams
      </button>
    </div>
  );
}

// ================================================================
//  MAIN COMPONENT
// ================================================================

export default function StudentDashboardPage(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MyProfileResponse["student"] | null>(
    null,
  );

  const hasCompletedAtLeastOneRef = useRef<boolean>(false);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const res =
          await axiosInstance.get<MyProfileResponse>("/api/student/me");
        if (res.data.success) setProfile(res.data.student);
      } catch {
        /* non-fatal — stat cards just show blank */
      }
    };
    void load();
  }, []);

  const fetchExams = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get<ExamListResponse>("/api/exams");
      if (res.data.success) setExams(res.data.exams);
    } catch {
      setError("Failed to load your available exams. Please try refreshing.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => {
    void fetchExams();
  }, [fetchExams]);

  useEffect((): void => {
    const state = location.state as LobbyLocationState | null;
    if (state?.examCompleted === true) {
      hasCompletedAtLeastOneRef.current = true;
      navigate("/student/lobby", { replace: true, state: null });
      void fetchExams();
    }
  }, [location.state, navigate, fetchExams]);

  const showAllDone =
    !isLoading &&
    exams.length === 0 &&
    error === null &&
    hasCompletedAtLeastOneRef.current;
  const showNoExams =
    !isLoading &&
    exams.length === 0 &&
    error === null &&
    !hasCompletedAtLeastOneRef.current;
  const firstName = profile?.full_name.split(" ")[0] ?? "Student";

  const StatCard = ({
    icon,
    value,
    label,
  }: {
    icon: React.ReactNode;
    value: string;
    label: string;
  }): React.JSX.Element => (
    <div className="bg-white border border-[#D7F2E0] rounded-2xl px-5 py-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center flex-shrink-0 text-[#15803D]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[#0B1F14] text-base font-bold truncate">
          {value || "—"}
        </p>
        <p className="text-[#6B8479] text-sm">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
          Welcome, {profile?.full_name ?? "…"}
        </h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<IdCard size={18} />}
          value={profile?.admission_number ?? "Not set"}
          label="Student ID"
        />
        {/* <StatCard
          icon={<GraduationCap size={18} />}
          value={`${profile?.class_name ?? ""}${profile?.arm_name ?? ""}`}
          label="Class"
        /> */}
        <StatCard
          icon={<Layers size={18} />}
          value={profile?.department_name ?? ""}
          label="Department"
        />
      </div>

      {/* Open Tests */}
      <div>
        {error !== null && (
          <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4 mb-4">
            <AlertCircle
              size={18}
              className="text-[#991B1B] flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="text-[#991B1B] text-base font-semibold">{error}</p>
              <button
                type="button"
                onClick={() => void fetchExams()}
                className="text-[#991B1B] text-sm underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-[#D7F2E0] rounded-2xl h-56 animate-pulse"
              />
            ))}
          </div>
        )}

        {showAllDone && (
          <AllDoneCard
            studentFirstName={firstName}
            onRefresh={() => void fetchExams()}
            isLoading={isLoading}
          />
        )}

        {showNoExams && (
          <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mx-auto mb-5">
              <BookOpen size={28} className="text-[#6B8479]" />
            </div>
            <h3 className="text-[#0B1F14] text-lg font-bold">
              No exams available yet
            </h3>
            <p className="text-[#6B8479] text-base mt-2 max-w-xs mx-auto leading-relaxed">
              Your teacher hasn't activated any exams for your class yet. Check
              back soon or ask your teacher.
            </p>
            <button
              type="button"
              onClick={() => void fetchExams()}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-base font-semibold hover:bg-[#E7FBEE] hover:border-[#4AE17A] transition-colors mx-auto"
            >
              <RefreshCw size={14} />
              Check Again
            </button>
          </div>
        )}

        {!isLoading && exams.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[#0B1F14] text-lg font-bold">
                  {exams.length === 1
                    ? "Open Tests — 1 ready for you"
                    : `Open Tests — ${exams.length} ready for you`}
                </h2>
                <p className="text-[#6B8479] text-sm mt-0.5">
                  Expand "Before you start" inside each card to see the rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchExams()}
                disabled={isLoading}
                className="p-2 rounded-xl text-[#6B8479] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={isLoading ? "animate-spin" : ""}
                />
              </button>
            </div>

            {exams.map((exam) => (
              <ExamCard
                key={exam.exam_id}
                exam={exam}
                onStart={(id) => navigate(`/student/exam/${id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
