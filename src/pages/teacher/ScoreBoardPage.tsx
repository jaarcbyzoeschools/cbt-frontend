// ================================================================
//  CBT SYSTEM — SCOREBOARD & RESULTS PAGE
//  File    : src/pages/teacher/ScoreboardPage.tsx
//  Design  : Vibrant Institutional Light Mode
//
//  NEW FIX: Class/Department filter dropdowns were previously
//  populated from the full unfiltered system-wide lists for every
//  role — but a restricted teacher's actual visible results are
//  scoped (subject assignments + homeroom), so picking a class/dept
//  outside that scope always silently returned zero results with
//  no explanation, looking like a bug rather than correct scoping.
//  For role === 'teacher', these two dropdowns are now populated
//  from GET /api/teacher/my-visible-classes — the exact same union
//  rule (subject assignment OR homeroom) already enforced server-
//  side in getScoreboardResults, so a restricted teacher can never
//  select a combination that was always going to return nothing.
//  Admin/Super Admin are unaffected — full unfiltered lists, as before.
// ================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Trophy,
  TrendingUp,
  TrendingDown,
  Loader2,
  FileDown,
  Tag,
  Calendar,
  Award,
  X,
  SlidersHorizontal,
  PenLine,
  Clock as ClockIcon,
  Lock,
} from "lucide-react";

import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../../context/AuthContext";
import { useBranchContext } from "../../../components/layout/StaffSidebar";
import type {
  ClassLevel,
  Department,
  ScoreboardRow,
  PaginationMeta,
} from "../../types/exam";
import {
  getScoreColour,
  formatScorePercentage,
  SCORE_THRESHOLDS,
  toNumericScore,
} from "../../utils/scoreColour";
import type {
  ManualScoreEntry,
  ManualEntryType,
  CreateManualScorePayload,
} from "../../types/exam";

import { formatSubmittedAt } from "../../utils/timeFormatter";

// ================================================================
//  EXTENDED TYPES
// ================================================================

interface ScoreboardRowExtended extends ScoreboardRow {
  evaluation_type: "midterm" | "terminal" | null;
  max_raw_mark: number | null;
  score_weight: number | null;
  academic_session: string | null;
  term: number | null;
  raw_score: number | null;
  weighted_score: number | null;
}

interface FilterState {
  classId: string;
  deptId: string;
  examId: string;
  search: string;
  evaluationType: string;
  session: string;
  term: string;
  page: number;
}

interface ExamOption {
  exam_id: number;
  exam_title: string;
  subject_name: string;
  class_name: string;
  department_name: string;
  question_count: number;
  created_by_username: string;
}

// NEW — GET /api/teacher/my-visible-classes
interface MyVisibleClassCombo {
  class_id: number;
  class_name: string;
  department_id: number;
  department_name: string;
}
interface MyVisibleClassesResponse {
  success: boolean;
  count: number;
  combos: MyVisibleClassCombo[];
}

interface ExamListResponse {
  success: boolean;
  exams: ExamOption[];
}
interface ClassListResponse {
  success: boolean;
  classes: ClassLevel[];
}
interface DeptListResponse {
  success: boolean;
  departments: Department[];
}
interface ResultsResponse {
  success: boolean;
  pagination: PaginationMeta;
  results: ScoreboardRowExtended[];
}

interface ManualScoreModalProps {
  student: { id: number; name: string; pin: string };
  exam: {
    id: number;
    title: string;
    max_raw_mark: number | null;
    evaluation_type: string | null;
  };
  cbtScore: number;
  onClose: () => void;
  onSaved: (entry: ManualScoreEntry) => void;
}

const PAGE_SIZE = 25;

function generateSessionOptions(): { value: string; label: string }[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => {
    const s = y - 3 + i;
    return { value: `${s}/${s + 1}`, label: `${s}/${s + 1}` };
  });
}

const SESSION_OPTIONS = generateSessionOptions();

const TERM_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "1st Term" },
  { value: "2", label: "2nd Term" },
  { value: "3", label: "3rd Term" },
];

const CLASS_ORDER = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

function EvalTypeBadge({
  type,
}: {
  type: "midterm" | "terminal" | null | undefined;
}): React.JSX.Element {
  if (type === null || type === undefined) {
    return <span className="text-[#6B8479] text-sm">—</span>;
  }
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold border",
        type === "midterm"
          ? "bg-[#EFF6FF] text-[#0369A1] border-[#BAE6FD]"
          : "bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]",
      ].join(" ")}
    >
      <Tag size={11} />
      {type === "midterm" ? "CA / Midterm" : "Terminal"}
    </span>
  );
}

function WeightedScoreCell({
  scorePercentage,
  maxRawMark,
  scoreWeight,
  rawScore,
  weightedScore,
}: {
  scorePercentage: number;
  maxRawMark: number | null;
  scoreWeight: number | null;
  rawScore: number | null;
  weightedScore: number | null;
}): React.JSX.Element {
  const effectiveMax = Number(maxRawMark ?? 100);
  const effectiveWeight = Number(scoreWeight ?? 1.0);
  const displayRaw =
    rawScore !== null
      ? Number(rawScore)
      : parseFloat(((scorePercentage / 100) * effectiveMax).toFixed(2));
  const displayWeighted =
    weightedScore !== null
      ? Number(weightedScore)
      : parseFloat((displayRaw * effectiveWeight).toFixed(3));

  return (
    <div className="space-y-0.5">
      <p className="text-[#3D5347] text-sm font-semibold tabular-nums">
        {displayRaw.toFixed(1)}/{effectiveMax}
      </p>
      <p className="text-[#6B8479] text-sm tabular-nums">
        ×{effectiveWeight.toFixed(3)} ={" "}
        <span className="text-[#6B8479]">{displayWeighted.toFixed(2)} pts</span>
      </p>
    </div>
  );
}

function SessionTermLabel({
  session,
  term,
}: {
  session: string | null | undefined;
  term: number | null | undefined;
}): React.JSX.Element {
  if (!session) {
    return <span className="text-[#6B8479] text-sm">—</span>;
  }
  const termStr =
    term !== null && term !== undefined
      ? (TERM_OPTIONS.find((t) => t.value === String(term))?.label ??
        `Term ${term}`)
      : null;

  return (
    <div className="space-y-0.5">
      <p className="text-[#3D5347] text-sm font-semibold">{session}</p>
      {termStr !== null && <p className="text-[#6B8479] text-sm">{termStr}</p>}
    </div>
  );
}

function SummaryBar({
  results,
}: {
  results: ScoreboardRowExtended[];
}): React.JSX.Element | null {
  if (results.length === 0) return null;

  const scores = results.map((r) => toNumericScore(r.score_percentage));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  const passCount = scores.filter((s) => s >= SCORE_THRESHOLDS.pass).length;
  const passRate = (passCount / scores.length) * 100;

  const cards = [
    {
      label: "Average Score",
      value: formatScorePercentage(avg),
      icon: <BarChart3 size={20} />,
      iconBg:
        avg >= 50
          ? "bg-[#EFF6FF] border-[#BAE6FD]"
          : "bg-[#FFFBEB] border-[#FCD34D]",
      iconText: avg >= 50 ? "text-[#0369A1]" : "text-[#92400E]",
      valCls: avg >= 50 ? "text-[#0369A1]" : "text-[#92400E]",
    },
    {
      label: "Highest Score",
      value: formatScorePercentage(highest),
      icon: <TrendingUp size={20} />,
      iconBg: "bg-[#E7FBEE] border-[#86EFAC]",
      iconText: "text-[#15803D]",
      valCls: "text-[#15803D]",
    },
    {
      label: "Lowest Score",
      value: formatScorePercentage(lowest),
      icon: <TrendingDown size={20} />,
      iconBg:
        lowest >= 40
          ? "bg-[#FFFBEB] border-[#FCD34D]"
          : "bg-[#FEF2F2] border-[#FCA5A5]",
      iconText: lowest >= 40 ? "text-[#92400E]" : "text-[#991B1B]",
      valCls: lowest >= 40 ? "text-[#92400E]" : "text-[#991B1B]",
    },
    {
      label: "Pass Rate",
      value: formatScorePercentage(passRate),
      icon: <Trophy size={20} />,
      iconBg:
        passRate >= 60
          ? "bg-[#E7FBEE] border-[#86EFAC]"
          : "bg-[#FFFBEB] border-[#FCD34D]",
      iconText: passRate >= 60 ? "text-[#15803D]" : "text-[#92400E]",
      valCls: passRate >= 60 ? "text-[#15803D]" : "text-[#92400E]",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white border border-[#D7F2E0] rounded-2xl p-5"
        >
          <div
            className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-4 ${card.iconBg} ${card.iconText}`}
          >
            {card.icon}
          </div>
          <p
            className={`text-3xl font-bold tabular-nums leading-none ${card.valCls}`}
          >
            {card.value}
          </p>
          <p className="text-[#3D5347] text-sm font-semibold mt-2">
            {card.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}): React.JSX.Element {
  const { current_page, total_pages, total_records, per_page } = meta;
  const start = (current_page - 1) * per_page + 1;
  const end = Math.min(current_page * per_page, total_records);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-[#D7F2E0] bg-[#F4FBF6]">
      <p className="text-[#6B8479] text-sm">
        Showing{" "}
        <span className="text-[#0B1F14] font-bold">
          {start}–{end}
        </span>{" "}
        of{" "}
        <span className="text-[#0B1F14] font-bold">
          {total_records.toLocaleString()}
        </span>{" "}
        results
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(current_page - 1)}
          disabled={current_page <= 1}
          className="p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft size={17} />
        </button>

        {Array.from({ length: total_pages }, (_, i) => i + 1)
          .filter(
            (p) =>
              p === 1 || p === total_pages || Math.abs(p - current_page) <= 1,
          )
          .reduce<(number | "gap")[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("gap");
            acc.push(p);
            return acc;
          }, [])
          .map((item, i) =>
            item === "gap" ? (
              <span key={`gap-${i}`} className="px-2 text-[#6B8479] text-sm">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item as number)}
                className={[
                  "w-8 h-8 rounded-lg text-sm font-semibold transition-colors",
                  item === current_page
                    ? "bg-[#4AE17A] text-[#0B1F14]"
                    : "text-[#3D5347] hover:text-[#0B1F14] hover:bg-[#F4FBF6]",
                ].join(" ")}
              >
                {item}
              </button>
            ),
          )}

        <button
          type="button"
          onClick={() => onPageChange(current_page + 1)}
          disabled={current_page >= total_pages}
          className="p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

const selCls = [
  "appearance-none bg-white border border-[#D7F2E0] rounded-xl",
  "pl-3.5 pr-9 py-2.5 text-sm font-medium text-[#3D5347]",
  "focus:outline-none focus:border-[#4AE17A] cursor-pointer transition-all w-full",
].join(" ");

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selCls}
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none"
      />
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex-1 min-w-[150px]">
      <label className="block text-[#6B8479] text-sm font-semibold uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function ManualScoreModal({
  student,
  exam,
  cbtScore,
  onClose,
  onSaved,
}: ManualScoreModalProps): React.JSX.Element {
  // Fixed, not selectable — Component and Absence Replacement are now
  // handled by the dedicated "Enter Grades" screen (Test/Other manual
  // entry). This modal's only remaining legitimate purpose is
  // correcting a CBT score after a technical failure, so there's
  // nothing left to choose.
  const entryType: ManualEntryType = "bonus";
  const [rawScore, setRawScore] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Out of (Max) is no longer editable — it's locked to the exam's
  // actual max_raw_mark. Letting a teacher change it per-entry would
  // mean this one student's score is computed against a different
  // denominator than every other student on the same exam, silently
  // distorting rankings and comparisons.
  const maxRaw = parseFloat(String(exam.max_raw_mark ?? 100));
  const cbtRaw = (cbtScore / 100) * maxRaw;
  const parsedScore = parseFloat(rawScore);

  const wouldExceed = !isNaN(parsedScore) && cbtRaw + parsedScore > maxRaw;

  useEffect((): (() => void) => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return (): void => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    if (isNaN(parsedScore) || parsedScore <= 0) {
      setError("Score must be a positive number.");
      return;
    }
    if (parsedScore > maxRaw) {
      setError(
        `Score (${parsedScore}) cannot exceed the exam maximum (${maxRaw}).`,
      );
      return;
    }
    if (note.trim() === "") {
      setError(
        "A reason is required to adjust a CBT score — describe the technical failure " +
          '(e.g. "Terminal crashed mid-exam, recovery lost the last 3 answers").',
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: CreateManualScorePayload = {
        student_id: student.id,
        exam_id: exam.id,
        entry_type: entryType,
        raw_score: parsedScore,
        component_max: maxRaw,
        note: note.trim(),
      };
      const res = await axiosInstance.post<{
        success: boolean;
        entry: ManualScoreEntry;
      }>("/api/teacher/manual-scores", payload);
      if (res.data.success) {
        onSaved(res.data.entry);
        onClose();
      }
    } catch (thrown: unknown) {
      if (
        thrown !== null &&
        typeof thrown === "object" &&
        "response" in thrown
      ) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? "Failed to submit entry.");
      } else {
        setError("Failed to submit entry. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldCls = (hasError = false): string =>
    [
      "w-full bg-white border-2 rounded-xl px-4 py-3 text-[#0B1F14] text-base",
      "placeholder:text-[#6B8479] focus:outline-none transition-all",
      hasError
        ? "border-[#FCA5A5] focus:border-[#991B1B]"
        : "border-[#D7F2E0] focus:border-[#4AE17A]",
    ].join(" ");

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#0B1F14]/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-md bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl my-4">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E7FBEE] border border-[#86EFAC] flex items-center justify-center">
                <PenLine size={17} className="text-[#15803D]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[#0B1F14] text-base font-bold">
                  Add Manual Score
                </h2>
                <p className="text-[#6B8479] text-sm truncate max-w-[220px]">
                  {student.name} · {exam.title}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-6 pt-5 pb-0">
            <div className="flex items-center gap-4 bg-[#F4FBF6] border border-[#D7F2E0] rounded-xl px-4 py-3">
              <div className="flex-1">
                <p className="text-[#6B8479] text-xs font-semibold uppercase tracking-wide">
                  Current CBT Score
                </p>
                <p className="text-[#0B1F14] text-lg font-bold mt-0.5">
                  <span className="text-[#6B8479] text-sm font-normal ml-2"></span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[#6B8479] text-xs font-semibold uppercase tracking-wide">
                  Exam Max
                </p>
                <p className="text-[#0B1F14] text-lg font-bold mt-0.5">
                  {maxRaw} marks
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error !== null && (
              <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <AlertCircle
                  size={16}
                  className="text-[#991B1B] flex-shrink-0 mt-0.5"
                />
                <p className="text-[#991B1B] text-base">{error}</p>
              </div>
            )}

            <div className="flex items-start gap-3 bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl px-4 py-3.5">
              <PenLine
                size={16}
                className="text-[#7C3AED] flex-shrink-0 mt-0.5"
              />
              <div>
                <p className="text-[#7C3AED] text-base font-bold">
                  Technical Failure Remediation
                </p>
                <p className="text-[#6B8479] text-sm mt-0.5 leading-relaxed">
                  For technical failures only — a terminal crash, power loss, or
                  recovery issue that cost the student marks they otherwise
                  earned. Requires a stated reason below. Every other kind of
                  manual entry is now handled on the{" "}
                  <span className="font-semibold text-[#3D5347]">
                    Enter Grades
                  </span>{" "}
                  page instead.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#3D5347] text-base font-semibold mb-2">
                  Score Awarded
                </label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={rawScore}
                  onChange={(e) => {
                    setRawScore(e.target.value);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  placeholder="e.g. 18"
                  className={fieldCls(wouldExceed)}
                />
              </div>
              <div>
                <label className="block text-[#3D5347] text-base font-semibold mb-2">
                  Out of (Max)
                </label>
                <div className="flex items-center gap-1.5 px-4 py-3.5 bg-[#F4FBF6] border-2 border-[#D7F2E0] rounded-xl">
                  <Lock size={13} className="text-[#6B8479] flex-shrink-0" />
                  <span className="text-[#3D5347] text-base font-semibold tabular-nums">
                    {maxRaw}
                  </span>
                  <span className="text-[#6B8479] text-sm ml-auto">
                    exam maximum
                  </span>
                </div>
              </div>
            </div>

            {wouldExceed && (
              <div className="flex items-start gap-2 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-4 py-3">
                <AlertCircle
                  size={15}
                  className="text-[#92400E] flex-shrink-0 mt-0.5"
                />
                <p className="text-[#92400E] text-sm leading-relaxed">
                  Adding {parsedScore} marks to the existing CBT raw score of{" "}
                  {cbtRaw.toFixed(1)} would give{" "}
                  {(cbtRaw + parsedScore).toFixed(1)}/{maxRaw} — above the exam
                  maximum. Reduce the amount.
                </p>
              </div>
            )}

            <div>
              <label className="block text-[#3D5347] text-base font-semibold mb-2">
                {entryType === "bonus" ? (
                  <>
                    Reason{" "}
                    <span className="text-[#991B1B] font-normal">
                      (required)
                    </span>
                  </>
                ) : (
                  <>
                    Note{" "}
                    <span className="text-[#6B8479] font-normal">
                      (optional)
                    </span>
                  </>
                )}
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setError(null);
                }}
                disabled={isSubmitting}
                placeholder={
                  entryType === "bonus"
                    ? "e.g. Terminal crashed mid-exam, recovery lost the last 3 answers"
                    : "e.g. Biology practical, Oral French exam…"
                }
                maxLength={500}
                className={fieldCls(
                  entryType === "bonus" && error !== null && note.trim() === "",
                )}
              />
            </div>

            <div className="flex items-start gap-2 bg-[#EFF6FF] border border-[#BAE6FD] rounded-xl px-4 py-3">
              <ClockIcon
                size={15}
                className="text-[#0369A1] flex-shrink-0 mt-0.5"
              />
              <p className="text-[#0369A1] text-sm leading-relaxed">
                This entry will be submitted as <strong>pending</strong>. Your
                branch admin must approve it before it affects the student's
                final score.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-base font-semibold text-[#3D5347] bg-[#F4FBF6] border border-[#D7F2E0] hover:bg-[#E7FBEE] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || wouldExceed}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Submitting…
                  </>
                ) : (
                  <>
                    <PenLine size={15} /> Submit for Approval
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function ScoreboardPage(): React.JSX.Element {
  const activeBranch = useBranchContext();
  const { role } = useAuth();
  const isRestrictedTeacher = role === "teacher";

  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);
  const [results, setResults] = useState<ScoreboardRowExtended[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    classId: "",
    deptId: "",
    examId: "",
    search: "",
    evaluationType: "",
    session: "",
    term: "",
    page: 1,
  });

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [manualScoreTarget, setManualScoreTarget] = useState<{
    student: { id: number; name: string; pin: string };
    exam: {
      id: number;
      title: string;
      max_raw_mark: number | null;
      evaluation_type: string | null;
    };
    cbtScore: number;
  } | null>(null);

  const [pendingPins, setPendingPins] = useState<Set<number>>(
    new Set<number>(),
  );

  const buildParams = useCallback(
    (f: FilterState, branchId: number | null): URLSearchParams => {
      const qp = new URLSearchParams();
      if (f.classId) qp.set("class_id", f.classId);
      if (f.deptId) qp.set("department_id", f.deptId);
      if (f.examId) qp.set("exam_id", f.examId);
      if (f.search) qp.set("search", f.search);
      if (f.evaluationType) qp.set("evaluation_type", f.evaluationType);
      if (f.session) qp.set("academic_session", f.session);
      if (f.term) qp.set("term", f.term);
      if (branchId !== null) qp.set("branch_id", String(branchId));
      qp.set("page", String(f.page));
      qp.set("limit", String(PAGE_SIZE));
      return qp;
    },
    [],
  );

  const fetchResults = useCallback(
    async (f: FilterState): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const params = buildParams(f, activeBranch?.id ?? null);
        const res = await axiosInstance.get<ResultsResponse>(
          `/api/teacher/results?${params.toString()}`,
        );
        if (res.data.success) {
          setResults(res.data.results);
          setPagination(res.data.pagination);
        }
      } catch {
        setError("Failed to load results. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [buildParams, activeBranch],
  );

  // ── FETCH LOOKUPS ─────────────────────────────────────────────
  // For a restricted teacher, Class/Department options come from
  // /api/teacher/my-visible-classes — the exact union of subject
  // assignments and homeroom already enforced server-side, instead
  // of the full unfiltered system-wide lists. Admin/Super Admin
  // keep the full lists, unchanged.

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        if (isRestrictedTeacher) {
          const [comboRes, examRes] = await Promise.all([
            axiosInstance.get<MyVisibleClassesResponse>(
              "/api/teacher/my-visible-classes",
            ),
            axiosInstance.get<ExamListResponse>("/api/teacher/analytics/exams"),
          ]);
          if (comboRes.data.success) {
            const uniqueClasses = new Map<number, ClassLevel>();
            const uniqueDepts = new Map<number, Department>();
            comboRes.data.combos.forEach((c) => {
              if (!uniqueClasses.has(c.class_id)) {
                uniqueClasses.set(c.class_id, {
                  id: c.class_id,
                  name: c.class_name as ClassLevel['name'],
                });
              }
              if (!uniqueDepts.has(c.department_id)) {
                uniqueDepts.set(c.department_id, {
                  id: c.department_id,
                  name: c.department_name as Department['name'], 
                });
              }
            });
            setClasses(
              [...uniqueClasses.values()].sort((a, b) =>
                a.name.localeCompare(b.name),
              ),
            );
            setDepartments(
              [...uniqueDepts.values()].sort((a, b) =>
                a.name.localeCompare(b.name),
              ),
            );
          }
          if (examRes.data.success) setExamOptions(examRes.data.exams);
        } else {
          const [clsRes, deptRes, examRes] = await Promise.all([
            axiosInstance.get<ClassListResponse>("/api/shared/classes"),
            axiosInstance.get<DeptListResponse>("/api/shared/departments"),
            axiosInstance.get<ExamListResponse>("/api/teacher/analytics/exams"),
          ]);
          if (clsRes.data.success) setClasses(clsRes.data.classes);
          if (deptRes.data.success) setDepartments(deptRes.data.departments);
          if (examRes.data.success) setExamOptions(examRes.data.exams);
        }
      } catch {
        /* non-fatal */
      }
    };
    void load();
  }, [isRestrictedTeacher]);

  useEffect((): void => {
    void fetchResults(filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect((): void => {
    void fetchResults(filters);
  }, [
    // eslint-disable-line react-hooks/exhaustive-deps
    filters.classId,
    filters.deptId,
    filters.examId,
    filters.evaluationType,
    filters.session,
    filters.term,
    filters.page,
    activeBranch,
  ]);

  const setFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ): void => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout((): void => {
      void fetchResults({ ...filters, search: value.trim(), page: 1 });
    }, 350);
  };

  const activeFilterCount = [
    filters.classId,
    filters.deptId,
    filters.examId,
    filters.search,
    filters.evaluationType,
    filters.session,
    filters.term,
  ].filter((v) => v !== "").length;

  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = (): void => {
    const cleared: FilterState = {
      classId: "",
      deptId: "",
      examId: "",
      search: "",
      evaluationType: "",
      session: "",
      term: "",
      page: 1,
    };
    setFilters(cleared);
    void fetchResults(cleared);
  };

  const examsByClass = examOptions.reduce<Record<string, ExamOption[]>>(
    (acc, exam) => {
      const key = exam.class_name;
      if (!acc[key]) acc[key] = [];
      acc[key].push(exam);
      return acc;
    },
    {},
  );
  const sortedExamClasses = CLASS_ORDER.filter(
    (c) => examsByClass[c] !== undefined,
  );

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    setExportError(null);
    const exportParams = buildParams(
      { ...filters, page: 1 },
      activeBranch?.id ?? null,
    );
    exportParams.delete("page");
    exportParams.delete("limit");
    try {
      const response = await axiosInstance.get(
        `/api/teacher/results/export?${exportParams.toString()}`,
        { responseType: "blob" },
      );
      const disposition =
        (response.headers["content-disposition"] as string | undefined) ?? "";
      const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
      const filename =
        filenameMatch?.[1] ??
        `CBT_Marks_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const blob = new Blob([response.data as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setExportError(
        "Export failed. Ensure results match your current filters and try again.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">
            Scoreboard & Reports
          </h1>
          <p className="text-[#6B8479] text-base mt-1">
            Review student performance across exams, classes, and terms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchResults(filters)}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#3D5347] bg-white border border-[#D7F2E0] hover:border-[#22B85C] transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting || results.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Exporting…
              </>
            ) : (
              <>
                <FileDown size={15} /> Export Excel
              </>
            )}
          </button>
        </div>
      </div>

      {exportError !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle
            size={18}
            className="text-[#991B1B] flex-shrink-0 mt-0.5"
          />
          <p className="text-[#991B1B] text-base font-semibold">
            {exportError}
          </p>
        </div>
      )}

      <div className="bg-white border border-[#D7F2E0] rounded-2xl px-5 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-[#6B8479]" />
            <p className="text-[#3D5347] text-sm font-bold uppercase tracking-wide">
              Filters
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-sm font-semibold hover:bg-[#FEE2E2] transition-colors"
            >
              <X size={12} />
              Clear {activeFilterCount} filter
              {activeFilterCount === 1 ? "" : "s"}
            </button>
          )}
        </div>

        <div className="flex items-end gap-3 flex-wrap mb-3">
          <div className="flex-[2] min-w-[200px]">
            <label className="block text-[#6B8479] text-sm font-semibold uppercase tracking-wide mb-1.5">
              Student
            </label>
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none"
              />
              <input
                type="text"
                value={filters.search}
                onChange={handleSearchChange}
                placeholder="Search student name…"
                className="w-full bg-white border border-[#D7F2E0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0B1F14] placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A] transition-all"
              />
            </div>
          </div>

          <FilterField label="Class">
            <FilterSelect
              value={filters.classId}
              onChange={(v) => setFilter("classId", v)}
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
          </FilterField>

          <FilterField label="Department">
            <FilterSelect
              value={filters.deptId}
              onChange={(v) => setFilter("deptId", v)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </FilterSelect>
          </FilterField>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-[2] min-w-[220px]">
            <label className="block text-[#6B8479] text-sm font-semibold uppercase tracking-wide mb-1.5">
              Subject / Exam
            </label>
            <div className="relative">
              <select
                value={filters.examId}
                onChange={(e) => setFilter("examId", e.target.value)}
                className={selCls}
              >
                <option value="">All Subjects & Exams</option>
                {sortedExamClasses.map((className) => (
                  <optgroup key={className} label={`── ${className} ──`}>
                    {examsByClass[className].map((exam) => (
                      <option key={exam.exam_id} value={String(exam.exam_id)}>
                        {exam.subject_name} — {exam.exam_title} · by{" "}
                        {exam.created_by_username}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B8479] pointer-events-none"
              />
            </div>
          </div>

          <FilterField label="Exam Type">
            <FilterSelect
              value={filters.evaluationType}
              onChange={(v) => setFilter("evaluationType", v)}
            >
              <option value="">All Types</option>
              <option value="midterm">CA / Midterm</option>
              <option value="terminal">Terminal Exam</option>
            </FilterSelect>
          </FilterField>

          <FilterField label="Session">
            <FilterSelect
              value={filters.session}
              onChange={(v) => setFilter("session", v)}
            >
              <option value="">All Sessions</option>
              {SESSION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value}
                </option>
              ))}
            </FilterSelect>
          </FilterField>

          <FilterField label="Term">
            <FilterSelect
              value={filters.term}
              onChange={(v) => setFilter("term", v)}
            >
              <option value="">All Terms</option>
              {TERM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FilterSelect>
          </FilterField>
        </div>

        {(filters.evaluationType !== "" ||
          filters.session !== "" ||
          filters.term !== "" ||
          filters.examId !== "") && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#F4FBF6] flex-wrap">
            <span className="text-[#6B8479] text-sm font-medium">Active:</span>
            {filters.examId !== "" &&
              (() => {
                const selected = examOptions.find(
                  (e) => String(e.exam_id) === filters.examId,
                );
                if (!selected) return null;
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-[#E7FBEE] text-[#15803D] border border-[#86EFAC]">
                    {selected.subject_name}
                  </span>
                );
              })()}
            {filters.evaluationType !== "" && (
              <span
                className={[
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold border",
                  filters.evaluationType === "midterm"
                    ? "bg-[#EFF6FF] text-[#0369A1] border-[#BAE6FD]"
                    : "bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]",
                ].join(" ")}
              >
                <Award size={11} />
                {filters.evaluationType === "midterm"
                  ? "CA / Midterm"
                  : "Terminal Exam"}
              </span>
            )}
            {filters.session !== "" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-[#F4FBF6] text-[#3D5347] border border-[#D7F2E0]">
                <Calendar size={11} />
                {filters.session}
              </span>
            )}
            {filters.term !== "" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-[#F4FBF6] text-[#3D5347] border border-[#D7F2E0]">
                {TERM_OPTIONS.find((t) => t.value === filters.term)?.label ??
                  `Term ${filters.term}`}
              </span>
            )}
          </div>
        )}
      </div>

      {!isLoading && results.length > 0 && <SummaryBar results={results} />}

      {error !== null && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-5 py-4">
          <AlertCircle
            size={18}
            className="text-[#991B1B] flex-shrink-0 mt-0.5"
          />
          <div>
            <p className="text-[#991B1B] text-base font-semibold">{error}</p>
            <button
              type="button"
              onClick={() => void fetchResults(filters)}
              className="text-[#991B1B] text-sm underline mt-1 hover:opacity-80"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
          <div className="flex items-center gap-3">
            <BarChart3 size={18} className="text-[#3D5347]" />
            <h2 className="text-[#0B1F14] text-base font-bold">Results</h2>
            {pagination !== null && !isLoading && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D] text-sm font-semibold">
                {pagination.total_records.toLocaleString()} total
              </span>
            )}
          </div>
          {pagination !== null && !isLoading && (
            <p className="text-[#6B8479] text-sm">
              Page {pagination.current_page} of {pagination.total_pages}
            </p>
          )}
        </div>

        {isLoading && (
          <div className="divide-y divide-[#F4FBF6]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="px-6 py-4 flex items-center gap-4 animate-pulse"
              >
                <div className="w-10 h-10 rounded-full bg-[#F4FBF6] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F4FBF6] rounded w-1/4" />
                  <div className="h-3 bg-[#F4FBF6] rounded w-1/3" />
                </div>
                <div className="h-7 w-20 bg-[#F4FBF6] rounded-full" />
                <div className="h-9 w-16 bg-[#F4FBF6] rounded" />
                <div className="h-4 w-24 bg-[#F4FBF6] rounded" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && results.length === 0 && error === null && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#F4FBF6] border border-[#D7F2E0] flex items-center justify-center mb-5">
              <BarChart3 size={28} className="text-[#6B8479]" />
            </div>
            <p className="text-[#0B1F14] text-lg font-bold">No results found</p>
            <p className="text-[#6B8479] text-base mt-1.5 max-w-xs leading-relaxed">
              {hasActiveFilters
                ? "No results match your current filters. Try adjusting or clearing them."
                : "Student results will appear here after exams are submitted."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-5 text-[#15803D] text-base font-semibold underline hover:text-[#22B85C] transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D7F2E0]">
                  {[
                    "Student",
                    "Branch",
                    "Class",
                    "Department",
                    "Exam",
                    "Type",
                    "Period",
                    "Score",
                    "Raw / Weighted",
                    "Correct / Total",
                    "Submitted",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3.5 text-[#3D5347] font-semibold text-sm uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, rowIdx) => {
                  const colour = getScoreColour(row.score_percentage);
                  const isEven = rowIdx % 2 === 0;
                  return (
                    <tr
                      key={row.result_id}
                      className={`border-b border-[#F4FBF6] hover:bg-[#E7FBEE] transition-colors ${isEven ? "bg-white" : "bg-[#F4FBF6]"}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={[
                              "w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                              colour.borderClass,
                              colour.bgClass,
                            ].join(" ")}
                          >
                            <span
                              className={`text-sm font-bold ${colour.textClass}`}
                            >
                              {row.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[#0B1F14] text-base font-semibold truncate max-w-[120px]">
                              {row.full_name}
                            </p>
                            <p className="text-[#6B8479] text-sm font-mono">
                              {row.login_pin}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-[#3D5347] text-sm whitespace-nowrap">
                          {row.branch_name}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-[#3D5347] text-sm">
                          {row.class_name}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-[#3D5347] text-sm whitespace-nowrap">
                          {row.department_name}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className="text-[#3D5347] text-sm max-w-[160px] truncate block"
                          title={row.exam_title}
                        >
                          {row.exam_title}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <EvalTypeBadge type={row.evaluation_type} />
                      </td>

                      <td className="px-5 py-4">
                        <SessionTermLabel
                          session={row.academic_session}
                          term={row.term}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-base font-bold tabular-nums ${colour.textClass}`}
                          >
                            {formatScorePercentage(row.score_percentage)}
                          </span>
                          <span
                            className={`hidden sm:inline px-2 py-0.5 rounded-lg text-sm font-semibold ${colour.badgeClass}`}
                          >
                            {colour.bandLabel}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <WeightedScoreCell
                          scorePercentage={row.score_percentage}
                          maxRawMark={row.max_raw_mark}
                          scoreWeight={row.score_weight}
                          rawScore={row.raw_score}
                          weightedScore={row.weighted_score}
                        />
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-[#3D5347] text-sm tabular-nums">
                          <span className={colour.textClass + " font-bold"}>
                            {row.correct_answers}
                          </span>
                          <span className="text-[#6B8479]">
                            {" "}
                            / {row.total_questions}
                          </span>
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-[#6B8479] text-sm">
                          {formatSubmittedAt(row.submitted_at)}
                        </span>
                        {row.submitted_late === true && (
                          <span
                            title="Time ran out before this exam was submitted. Only the answers saved before time ended were graded."
                            className="ml-2 inline-flex items-center rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#92400E]"
                          >
                            Late
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Add manual score"
                            onClick={() =>
                              setManualScoreTarget({
                                student: {
                                  id: row.student_id,
                                  name: row.full_name,
                                  pin: row.login_pin,
                                },
                                exam: {
                                  id: row.exam_id,
                                  title: row.exam_title,
                                  max_raw_mark: row.max_raw_mark,
                                  evaluation_type: row.evaluation_type,
                                },
                                cbtScore: row.score_percentage,
                              })
                            }
                            className="p-2 rounded-lg text-[#6B8479] hover:text-[#15803D] hover:bg-[#E7FBEE] transition-colors"
                          >
                            <PenLine size={15} />
                          </button>
                          {pendingPins.has(row.student_id) && (
                            <span
                              title="Pending manual score awaiting admin approval"
                              className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination !== null && !isLoading && results.length > 0 && (
          <Pagination
            meta={pagination}
            onPageChange={(p) => setFilter("page", p)}
          />
        )}
      </div>

      <p className="text-[#6B8479] text-sm text-center">
        Export applies all active filters · Includes every page · Colour-coded
        in Excel
      </p>

      {manualScoreTarget !== null && (
        <ManualScoreModal
          student={manualScoreTarget.student}
          exam={manualScoreTarget.exam}
          cbtScore={manualScoreTarget.cbtScore}
          onClose={() => setManualScoreTarget(null)}
          onSaved={(entry) => {
            setPendingPins((prev) => new Set([...prev, entry.student_id]));
            setManualScoreTarget(null);
          }}
        />
      )}
    </div>
  );
}
