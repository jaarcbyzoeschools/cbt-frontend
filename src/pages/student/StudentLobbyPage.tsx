// ================================================================
//  CBT SYSTEM — STUDENT LOBBY PAGE
//  File    : src/pages/student/StudentLobbyPage.tsx
//
//  Addition: fetches the student's own arm via the new
//  GET /api/student/me endpoint (studentProfileController.js) —
//  the `student` object from useAuth() has no arm field, and
//  rather than touch the login/JWT flow blind, this is a small
//  separate fetch on mount, merged into the identity card display
//  as a compact class+arm code (e.g. "JSS1A") instead of showing
//  class and arm as two separate pieces of text.
// ================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen,
  Clock,
  ChevronRight,
  GraduationCap,
  Building2,
  Layers,
  RefreshCw,
  AlertCircle,
  LogOut,
  CheckCircle2,
  FileQuestion,
  PartyPopper,
  Trophy,
  Timer,
  History,
  Calendar,
  Tag,
  ChevronDown,
  Lock,
  PlayCircle,
} from "lucide-react";

import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../../context/AuthContext";
import type { Exam } from "../../types/exam";
import { formatDuration } from "../../utils/timeFormatter";

import ReportCardStatusCard from "../../../components/student/ReportCardStatusCard";

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

type LobbyTab = "exams" | "results";

interface ResultRow {
  result_id: number;
  exam_id: number;
  exam_title: string;
  subject_name: string;
  evaluation_type: "midterm" | "terminal" | null;
  academic_session: string | null;
  term: number | null;
  total_questions: number;
  correct_answers: number | null; // null when results hidden
  score_percentage: number | null; // null when results hidden
  submitted_at: string;
}

interface ResultsSummary {
  total_exams: number;
  average_score: number | null;
}

interface MyResultsResponse {
  success: boolean;
  results_visible: boolean;
  summary: ResultsSummary;
  results: ResultRow[];
}

// New — GET /api/student/me
interface MyProfileResponse {
  success: boolean;
  student: {
    id: number;
    full_name: string;
    class_id: number;
    class_name: string;
    department_id: number;
    department_name: string;
    branch_id: number;
    branch_name: string;
    arm_id: number | null;
    arm_name: string | null;
    photo_path: string | null;
  };
}

// ================================================================
//  EXAM CARD — redesigned
//  Rules are now inside the card as a collapsible section,
//  replacing the full-page ExamRulesPanel. This way the card
//  IS the exam, and rules are contextual to that specific exam.
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
      {/* Card top accent */}
      <div className="h-1 w-full bg-[#4AE17A]" />

      <div className="px-5 pt-5 pb-4">
        {/* Subject badge + Live pill */}
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

        {/* Exam title */}
        <h3 className="text-[#0B1F14] text-lg font-bold leading-snug mb-4">
          {exam.exam_title}
        </h3>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-sm font-medium">
            <GraduationCap size={12} className="text-[#6B8479]" />
            {exam.class_name}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-sm font-medium">
            <Clock size={12} className="text-[#6B8479]" />
            {formatDuration(exam.duration_minutes)}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] text-sm font-medium">
            <FileQuestion size={12} className="text-[#6B8479]" />
            {exam.total_questions_to_show} questions
          </span>
        </div>

        {/* Collapsible rules */}
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

        {/* Start button */}
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
//  RESULT CARD — Phase 2: respects visibility gate
// ================================================================

function formatResultDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-NG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function ResultCard({
  result,
  resultsVisible,
}: {
  result: ResultRow;
  resultsVisible: boolean;
}): React.JSX.Element {
  return (
    <div className="bg-white border border-[#D7F2E0] rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          {/* Title + type badge */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <p className="text-[#0B1F14] text-base font-bold">
              {result.exam_title}
            </p>
            {result.evaluation_type !== null && (
              <span
                className={[
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
                  result.evaluation_type === "midterm"
                    ? "bg-[#EFF6FF] text-[#0369A1] border-[#BAE6FD]"
                    : "bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]",
                ].join(" ")}
              >
                <Tag size={9} />
                {result.evaluation_type === "midterm" ? "CA" : "Terminal"}
              </span>
            )}
          </div>
          {/* Meta */}
          <div className="flex items-center gap-2 flex-wrap text-sm text-[#6B8479]">
            <span>{result.subject_name}</span>
            {result.academic_session !== null && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {result.academic_session}
                  {result.term !== null && ` · T${result.term}`}
                </span>
              </>
            )}
            <span>·</span>
            <span>{formatResultDate(result.submitted_at)}</span>
          </div>
        </div>

        {/* Score or pending badge */}
        <div className="flex-shrink-0 text-right">
          {resultsVisible && result.score_percentage !== null ? (
            <div>
              <p className="text-[#0B1F14] text-2xl font-bold tabular-nums">
                {result.score_percentage.toFixed(1)}%
              </p>
              <p className="text-[#6B8479] text-sm mt-0.5">
                {result.correct_answers}/{result.total_questions} correct
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E]">
              <Lock size={12} />
              <span className="text-sm font-semibold">Pending release</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================================================
//  ALL DONE CARD
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
        You have submitted all your available exams. Check the "Completed Tests"
        tab to review your history, or wait for your teacher to activate more
        exams.
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

export default function StudentLobbyPage(): React.JSX.Element {
  const { student, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<LobbyTab>("exams");

  // Exams tab
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Results tab
  const [resultsData, setResultsData] = useState<MyResultsResponse | null>(
    null,
  );
  const [resultsLoading, setResultsLoading] = useState<boolean>(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsFetched, setResultsFetched] = useState<boolean>(false);

  // Own arm — fetched separately since useAuth()'s student object
  // has no arm field. See studentProfileController.js.
  const [armName, setArmName] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);

  const hasCompletedAtLeastOneRef = useRef<boolean>(false);

  // ── Fetch my own profile (for arm + photo) ─────────────────────

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const res =
          await axiosInstance.get<MyProfileResponse>("/api/student/me");
        if (res.data.success) {
          setArmName(res.data.student.arm_name);
          setPhotoPath(res.data.student.photo_path);
        }
      } catch {
        /* non-fatal — identity card just won't show an arm/photo */
      }
    };
    void load();
  }, []);

  // ── Fetch exams ──────────────────────────────────────────────

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

  // ── Fetch results (lazy) ──────────────────────────────────────

  const fetchResults = useCallback(async (): Promise<void> => {
    setResultsLoading(true);
    setResultsError(null);
    try {
      const res = await axiosInstance.get<MyResultsResponse>(
        "/api/exams/my-results",
      );
      if (res.data.success) {
        setResultsData(res.data);
        setResultsFetched(true);
      }
    } catch {
      setResultsError("Failed to load your results. Please try again.");
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect((): void => {
    if (activeTab === "results" && !resultsFetched) {
      void fetchResults();
    }
  }, [activeTab, resultsFetched, fetchResults]);

  // ── Auto-refresh after exam completion ───────────────────────

  useEffect((): void => {
    const state = location.state as LobbyLocationState | null;
    if (state?.examCompleted === true) {
      hasCompletedAtLeastOneRef.current = true;
      navigate("/student/lobby", { replace: true, state: null });
      void fetchExams();
      setResultsFetched(false);
    }
  }, [location.state, navigate, fetchExams]);

  // ── Derived ──────────────────────────────────────────────────

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
  const firstName = student?.full_name.split(" ")[0] ?? "Student";
  const resultsVisible = resultsData?.results_visible ?? false;

  // ================================================================
  //  RENDER
  // ================================================================

  return (
    <div className="min-h-screen bg-[#F4FBF6]">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-5">
        {/* ── Top bar ──────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#4AE17A] flex items-center justify-center">
              <BookOpen size={16} className="text-[#0B1F14]" />
            </div>
            <span className="text-[#3D5347] text-sm font-bold hidden sm:block">
              CBT Examination Portal
            </span>
          </div>
          <button
            type="button"
            onClick={() => logout("/login/student")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#FCA5A5] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-all"
          >
            <LogOut size={14} />
            Log Out
          </button>
        </div>

        {/* ── Student identity card — compact ──────────────── */}
        {student !== null && (
          <div className="bg-white border border-[#D7F2E0] rounded-2xl px-5 py-4">
            <div className="flex items-center gap-4">
              {/* Avatar — real photo if uploaded, letter fallback otherwise */}
              {photoPath !== null ? (
                <img
                  src={`${axiosInstance.defaults.baseURL ?? ""}${photoPath}`}
                  alt={student.full_name}
                  className="w-12 h-12 rounded-2xl object-cover flex-shrink-0 border border-[#D7F2E0]"
                  onError={() => setPhotoPath(null)}
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-[#4AE17A] flex items-center justify-center flex-shrink-0">
                  <span className="text-[#0B1F14] text-xl font-bold">
                    {student.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-[#0B1F14] text-base font-bold truncate">
                  {student.full_name}
                </p>
                <div className="flex items-center gap-3 flex-wrap mt-0.5">
                  <span className="flex items-center gap-1 text-[#6B8479] text-sm">
                    <Building2 size={12} />
                    {student.branch_name}
                  </span>
                  <span className="flex items-center gap-1 text-[#6B8479] text-sm">
                    <GraduationCap size={12} />
                    {student.class_name}
                    {armName ?? ""}
                  </span>
                  <span className="flex items-center gap-1 text-[#6B8479] text-sm">
                    <Layers size={12} />
                    {student.department_name}
                  </span>
                </div>
              </div>
              {/* Verified badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-xs font-semibold flex-shrink-0">
                <CheckCircle2 size={12} />
                Verified
              </div>
            </div>
          </div>
        )}

        {/* ── Report cards — Phase 4 ─────────────────────────
            Self-contained; renders null if no periods exist yet,
            so it never shows an empty/broken card on first login. */}
        <ReportCardStatusCard />

        {/* ── Tab strip ────────────────────────────────────── */}
        <div className="flex bg-white border border-[#D7F2E0] rounded-2xl p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("exams")}
            className={[
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-base font-bold transition-all",
              activeTab === "exams"
                ? "bg-[#4AE17A] text-[#0B1F14]"
                : "text-[#6B8479] hover:bg-[#F4FBF6]",
            ].join(" ")}
          >
            <BookOpen size={16} />
            <span>Available Exams</span>
            {!isLoading && exams.length > 0 && (
              <span
                className={[
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                  activeTab === "exams"
                    ? "bg-[#0B1F14] text-[#4AE17A]"
                    : "bg-[#E7FBEE] text-[#15803D]",
                ].join(" ")}
              >
                {exams.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("results")}
            className={[
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-base font-bold transition-all",
              activeTab === "results"
                ? "bg-[#4AE17A] text-[#0B1F14]"
                : "text-[#6B8479] hover:bg-[#F4FBF6]",
            ].join(" ")}
          >
            <History size={16} />
            <span>Completed Tests</span>
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB A — AVAILABLE EXAMS
        ══════════════════════════════════════════════════════ */}
        {activeTab === "exams" && (
          <>
            {/* Error */}
            {error !== null && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
                <AlertCircle
                  size={18}
                  className="text-[#991B1B] flex-shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-[#991B1B] text-base font-semibold">
                    {error}
                  </p>
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

            {/* Loading skeleton */}
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

            {/* All done */}
            {showAllDone && (
              <AllDoneCard
                studentFirstName={firstName}
                onRefresh={() => void fetchExams()}
                isLoading={isLoading}
              />
            )}

            {/* No exams yet */}
            {showNoExams && (
              <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mx-auto mb-5">
                  <BookOpen size={28} className="text-[#6B8479]" />
                </div>
                <h3 className="text-[#0B1F14] text-lg font-bold">
                  No exams available yet
                </h3>
                <p className="text-[#6B8479] text-base mt-2 max-w-xs mx-auto leading-relaxed">
                  Your teacher hasn't activated any exams for your class yet.
                  Check back soon or ask your teacher.
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

            {/* Exam cards */}
            {!isLoading && exams.length > 0 && (
              <div className="space-y-4">
                {/* Subtle header — exams are the hero, not a long instruction block */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[#0B1F14] text-lg font-bold">
                      {exams.length === 1
                        ? "1 exam ready for you"
                        : `${exams.length} exams ready for you`}
                    </h2>
                    <p className="text-[#6B8479] text-sm mt-0.5">
                      Expand "Before you start" inside each card to see the
                      rules.
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
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB B — COMPLETED TESTS
        ══════════════════════════════════════════════════════ */}
        {activeTab === "results" && (
          <>
            {/* Loading */}
            {resultsLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 bg-white border border-[#D7F2E0] rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* Error */}
            {resultsError !== null && !resultsLoading && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
                <AlertCircle
                  size={18}
                  className="text-[#991B1B] flex-shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-[#991B1B] text-base font-semibold">
                    {resultsError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void fetchResults()}
                    className="text-[#991B1B] text-sm underline mt-1"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Content */}
            {!resultsLoading &&
              resultsError === null &&
              resultsData !== null && (
                <>
                  {/* Results hidden banner */}
                  {!resultsVisible && resultsData.results.length > 0 && (
                    <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-5 py-4">
                      <Lock
                        size={16}
                        className="text-[#92400E] flex-shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="text-[#92400E] text-base font-semibold">
                          Results not yet released
                        </p>
                        <p className="text-[#92400E]/80 text-sm mt-0.5 leading-relaxed">
                          Your scores have been recorded but are hidden until
                          your principal releases results at the end of term.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {resultsData.results.length === 0 && (
                    <div className="bg-white border border-[#D7F2E0] rounded-2xl px-6 py-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mx-auto mb-5">
                        <History size={28} className="text-[#6B8479]" />
                      </div>
                      <h3 className="text-[#0B1F14] text-lg font-bold">
                        No completed tests yet
                      </h3>
                      <p className="text-[#6B8479] text-base mt-2 max-w-xs mx-auto leading-relaxed">
                        Once you complete an exam your history will appear here.
                      </p>
                    </div>
                  )}

                  {/* Summary + list */}
                  {resultsData.results.length > 0 && (
                    <>
                      {/* Count + average */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white border border-[#D7F2E0] rounded-2xl p-4 text-center">
                          <p className="text-3xl font-bold text-[#0B1F14] tabular-nums">
                            {resultsData.summary.total_exams}
                          </p>
                          <p className="text-[#6B8479] text-sm mt-1">
                            Tests Completed
                          </p>
                        </div>
                        <div className="bg-white border border-[#D7F2E0] rounded-2xl p-4 text-center">
                          {resultsVisible &&
                          resultsData.summary.average_score !== null ? (
                            <>
                              <p className="text-3xl font-bold text-[#15803D] tabular-nums">
                                {resultsData.summary.average_score.toFixed(1)}%
                              </p>
                              <p className="text-[#6B8479] text-sm mt-1">
                                Average Score
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-center gap-1.5 mt-1">
                                <Lock size={16} className="text-[#92400E]" />
                              </div>
                              <p className="text-[#92400E] text-base font-semibold mt-1">
                                Pending
                              </p>
                              <p className="text-[#6B8479] text-sm mt-0.5">
                                Average Score
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Refresh */}
                      <div className="flex items-center justify-between">
                        <h2 className="text-[#0B1F14] text-lg font-bold">
                          Test History
                        </h2>
                        <button
                          type="button"
                          onClick={() => void fetchResults()}
                          disabled={resultsLoading}
                          className="p-2 rounded-xl text-[#6B8479] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
                        >
                          <RefreshCw
                            size={14}
                            className={resultsLoading ? "animate-spin" : ""}
                          />
                        </button>
                      </div>

                      {/* Result cards */}
                      <div className="space-y-3">
                        {resultsData.results.map((r) => (
                          <ResultCard
                            key={r.result_id}
                            result={r}
                            resultsVisible={resultsVisible}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
          </>
        )}

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm pt-2">
          CBT System · Offline Mode · Answers saved automatically
        </p>
      </div>
    </div>
  );
}
