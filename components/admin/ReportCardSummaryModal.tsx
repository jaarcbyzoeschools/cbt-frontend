// ================================================================
//  CBT SYSTEM — REPORT CARD SUMMARY EDITOR
//  File    : src/components/admin/ReportCardSummaryModal.tsx
//  Phase 4: Attendance, comments, and behavioral ratings for one
//            student. Opened from ReportCardPanel's student list.
//  Design  : Vibrant Institutional Light Mode — same modal chrome
//            as ManualApprovalModal / ReportCardPanel.
// ================================================================

import React, { useState } from "react";
import { X, AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";

import axiosInstance from "../../src/api/axiosInstance";
import type {
  ReportCardSummaryListItem,
  UpsertReportCardSummaryPayload,
  UpsertReportCardSummaryResponse,
  RatingsMap,
} from "../../src/types/exam";

// Suggested starting traits — not enforced, just quick-add buttons.
// Schools can add/remove any trait name freely.
const SUGGESTED_PSYCHOMOTOR = [
  "Handwriting",
  "Sports/Games",
  "Handling of Tools",
  "Musical Skills",
];
const SUGGESTED_AFFECTIVE = [
  "Punctuality",
  "Neatness",
  "Politeness",
  "Honesty",
  "Leadership",
  "Relationship with Others",
];

interface ReportCardSummaryModalProps {
  student: ReportCardSummaryListItem;
  academicSession: string;
  term: number;
  onClose: () => void;
  onSaved: () => void;
}

function RatingEditor({
  title,
  ratings,
  suggested,
  onChange,
}: {
  title: string;
  ratings: RatingsMap;
  suggested: string[];
  onChange: (next: RatingsMap) => void;
}): React.JSX.Element {
  const [newTrait, setNewTrait] = useState<string>("");

  const setRating = (trait: string, value: number): void => {
    onChange({ ...ratings, [trait]: value });
  };

  const removeTrait = (trait: string): void => {
    const next = { ...ratings };
    delete next[trait];
    onChange(next);
  };

  const addTrait = (trait: string): void => {
    const trimmed = trait.trim();
    if (trimmed.length === 0 || ratings[trimmed] !== undefined) return;
    onChange({ ...ratings, [trimmed]: 3 });
    setNewTrait("");
  };

  const unusedSuggestions = suggested.filter((t) => ratings[t] === undefined);

  return (
    <div>
      <p className="text-[#3D5347] text-sm font-semibold mb-2">{title}</p>
      <div className="space-y-2">
        {Object.entries(ratings).map(([trait, value]) => (
          <div key={trait} className="flex items-center gap-2">
            <span className="text-[#0B1F14] text-sm flex-1 truncate">
              {trait}
            </span>
            <select
              value={value}
              onChange={(e) => setRating(trait, Number(e.target.value))}
              className="bg-white border border-[#D7F2E0] rounded-lg px-2 py-1 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A]"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeTrait(trait)}
              className="p-1 text-[#6B8479] hover:text-[#991B1B] transition-colors"
              aria-label={`Remove ${trait}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {unusedSuggestions.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addTrait(t)}
              className="text-xs px-2 py-1 rounded-full bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] hover:border-[#4AE17A] transition-colors"
            >
              + {t}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={newTrait}
          onChange={(e) => setNewTrait(e.target.value)}
          placeholder="Custom trait name…"
          className="flex-1 bg-white border border-[#D7F2E0] rounded-lg px-3 py-1.5 text-sm text-[#0B1F14] placeholder:text-[#6B8479] focus:outline-none focus:border-[#4AE17A]"
        />
        <button
          type="button"
          onClick={() => addTrait(newTrait)}
          className="p-1.5 rounded-lg bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347] hover:border-[#4AE17A] transition-colors"
          aria-label="Add trait"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export default function ReportCardSummaryModal({
  student,
  academicSession,
  term,
  onClose,
  onSaved,
}: ReportCardSummaryModalProps): React.JSX.Element {
  const [daysPresent, setDaysPresent] = useState<string>(
    student.days_present?.toString() ?? "",
  );
  const [daysAbsent, setDaysAbsent] = useState<string>(
    student.days_absent?.toString() ?? "",
  );
  const [totalDays, setTotalDays] = useState<string>(
    student.total_school_days?.toString() ?? "",
  );
  const [teacherComment, setTeacherComment] = useState<string>(
    student.class_teacher_comment ?? "",
  );
  const [principalComment, setPrincipalComment] = useState<string>(
    student.principal_comment ?? "",
  );
  const [nextTermBegins, setNextTermBegins] = useState<string>(
    student.next_term_begins !== null
      ? student.next_term_begins.slice(0, 10)
      : "",
  );
  const [psychomotor, setPsychomotor] = useState<RatingsMap>(
    student.psychomotor_ratings ?? {},
  );
  const [affective, setAffective] = useState<RatingsMap>(
    student.affective_ratings ?? {},
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const toIntOrNull = (val: string): number | null => {
    if (val.trim() === "") return null;
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  };

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setError(null);
    try {
      const payload: UpsertReportCardSummaryPayload = {
        student_id: student.student_id,
        academic_session: academicSession,
        term,
        days_present: toIntOrNull(daysPresent),
        days_absent: toIntOrNull(daysAbsent),
        total_school_days: toIntOrNull(totalDays),
        class_teacher_comment: teacherComment.trim() || null,
        principal_comment: principalComment.trim() || null,
        psychomotor_ratings: psychomotor,
        affective_ratings: affective,
        next_term_begins: nextTermBegins || null,
      };
      const res = await axiosInstance.put<UpsertReportCardSummaryResponse>(
        "/api/admin/report-cards/summary",
        payload,
      );
      if (res.data.success) {
        onSaved();
        onClose();
      }
    } catch (thrown: unknown) {
      if (
        thrown !== null &&
        typeof thrown === "object" &&
        "response" in thrown
      ) {
        const err = thrown as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? "Failed to save.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-[#0B1F14]/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-[51] flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-xl bg-white border border-[#D7F2E0] rounded-2xl shadow-2xl my-4">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#D7F2E0] bg-[#F4FBF6] rounded-t-2xl">
            <div>
              <h2 className="text-[#0B1F14] text-lg font-bold">
                {student.full_name}
              </h2>
              <p className="text-[#6B8479] text-sm">
                {student.login_pin} — Report card data
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-5">
            {error !== null && (
              <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-[#991B1B]" />
                <p className="text-[#991B1B] text-base">{error}</p>
              </div>
            )}

            {/* Attendance */}
            <div>
              <p className="text-[#3D5347] text-sm font-semibold mb-2">
                Attendance
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[#6B8479] text-xs block mb-1">
                    Days Present
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={daysPresent}
                    onChange={(e) => setDaysPresent(e.target.value)}
                    className="w-full bg-white border border-[#D7F2E0] rounded-lg px-3 py-1.5 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A]"
                  />
                </div>
                <div>
                  <label className="text-[#6B8479] text-xs block mb-1">
                    Days Absent
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={daysAbsent}
                    onChange={(e) => setDaysAbsent(e.target.value)}
                    className="w-full bg-white border border-[#D7F2E0] rounded-lg px-3 py-1.5 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A]"
                  />
                </div>
                <div>
                  <label className="text-[#6B8479] text-xs block mb-1">
                    Total School Days
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={totalDays}
                    onChange={(e) => setTotalDays(e.target.value)}
                    className="w-full bg-white border border-[#D7F2E0] rounded-lg px-3 py-1.5 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A]"
                  />
                </div>
              </div>
            </div>

            <RatingEditor
              title="Psychomotor Domain"
              ratings={psychomotor}
              suggested={SUGGESTED_PSYCHOMOTOR}
              onChange={setPsychomotor}
            />

            <RatingEditor
              title="Affective Domain"
              ratings={affective}
              suggested={SUGGESTED_AFFECTIVE}
              onChange={setAffective}
            />

            {/* Comments */}
            <div>
              <label className="text-[#3D5347] text-sm font-semibold block mb-1.5">
                Class Teacher's Comment
              </label>
              <textarea
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                rows={2}
                className="w-full bg-white border border-[#D7F2E0] rounded-xl px-4 py-2.5 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A] transition-all resize-none"
              />
            </div>
            <div>
              <label className="text-[#3D5347] text-sm font-semibold block mb-1.5">
                Principal's Comment
              </label>
              <textarea
                value={principalComment}
                onChange={(e) => setPrincipalComment(e.target.value)}
                rows={2}
                className="w-full bg-white border border-[#D7F2E0] rounded-xl px-4 py-2.5 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A] transition-all resize-none"
              />
            </div>

            <div>
              <label className="text-[#3D5347] text-sm font-semibold block mb-1.5">
                Next Term Begins
              </label>
              <input
                type="date"
                value={nextTermBegins}
                onChange={(e) => setNextTermBegins(e.target.value)}
                className="w-full bg-white border border-[#D7F2E0] rounded-xl px-4 py-2.5 text-sm text-[#0B1F14] focus:outline-none focus:border-[#4AE17A] transition-all"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-[#3D5347] bg-[#F4FBF6] border border-[#D7F2E0] hover:bg-[#E7FBEE] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50"
              >
                {isSaving && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
