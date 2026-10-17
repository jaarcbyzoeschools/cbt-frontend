// ================================================================
//  CBT SYSTEM — EXAM DOMAIN TYPE DEFINITIONS
//  File    : src/types/exam.ts
//  Purpose : Central type registry for all exam-related entities:
//            exam shells, answer-key-stripped questions, student
//            answer tracking, active session state, scoreboard
//            results, and all shared curriculum lookup shapes.
//
//  Phase 1 additions:
//    — ManualScoreEntry          new type for manual score workflow
//    — ManualEntryType           strict union for entry_type values
//    — ManualEntryStatus         strict union for status values
//    — ScoreboardRow             extended with final_score_percentage
//    — ExamResult                extended with result_visible flag
//
//  Phase 3 additions:
//    — ActivePeriod              GET /api/settings/active-period
//    — ReportCardStatus          GET /api/admin/report-cards/status
//    — GenerateReportCardsPayload / Response
//    — ApproveReportCardsPayload / Response
//    — StudentReportCardStatus   GET /api/exams/report-card/status
//
//  Consumers of this file:
//    — useExamSession.ts        (live exam orchestration hook)
//    — ExamRoomPage.tsx         (split-screen exam terminal)
//    — StudentLobbyPage.tsx     (available exam allocation grid)
//    — ExamManagementPage.tsx   (teacher exam CRUD panel)
//    — ScoreboardPage.tsx       (analytics and export)
//    — ResultPage.tsx           (post-submission summary)
//    — All /api/shared/* calls  (dropdown population)
//    — ReportCardPanel.tsx      (Phase 3 admin generation/approval)
// ================================================================


// ── ANSWER OPTION ────────────────────────────────────────────────
// The four valid answer key letters as a strict literal union.
// Using this type instead of 'string' makes it impossible to
// store an invalid choice (e.g., 'E', 'X') in any answer map.
export type AnswerOption = 'A' | 'B' | 'C' | 'D';


// ── EXAM SHELL ───────────────────────────────────────────────────
// Returned by:
//   GET /api/exams               → response.exams[]   (student lobby)
//   GET /api/teacher/exams       → response.exams[]   (teacher panel)
//   POST /api/teacher/exams      → response.exam      (creation result)
//
// Optional fields are present only in teacher-facing responses.
// The student lobby receives a subset without management metadata.

export interface Exam {
  readonly exam_id                 : number;
  readonly exam_title              : string;
  readonly duration_minutes        : number;
  readonly total_questions_to_show : number;
  readonly subject_name            : string;
  readonly class_name              : string;
  evaluation_type  : 'midterm' | 'terminal' | null;
  max_raw_mark     : number | null;
  score_weight     : number | null;
  academic_session : string | null;
  term             : number | null;
  readonly department_name         : string;
  readonly is_active?              : boolean;   // Teacher view only
  readonly question_count?         : number;    // Teacher list view only
  readonly created_by_username?    : string;    // Teacher list view only
  readonly created_at?             : string;    // ISO 8601 — teacher view only
}


// ── QUESTION ─────────────────────────────────────────────────────
// Returned by:
//   GET /api/exams/:id/questions → response.questions[]
//
// SECURITY CONTRACT: correct_option is intentionally and
// permanently ABSENT from this interface. The backend strips
// it at the SQL SELECT layer — it never travels over the wire
// to the browser. Defining it here would misrepresent the API
// contract and create a false expectation in consuming code.

export interface Question {
  readonly question_id   : number;
  readonly question_text : string;
  readonly option_a      : string;
  readonly option_b      : string;
  readonly option_c      : string;
  readonly option_d      : string;
}

// Convenience tuple — used when iterating option labels in
// the ExamRoomPage choice renderer to avoid hard-coding the
// four option keys in multiple places.
export type OptionKey = 'option_a' | 'option_b' | 'option_c' | 'option_d';

export const OPTION_KEYS: ReadonlyArray<{ key: OptionKey; label: AnswerOption }> = [
  { key: 'option_a', label: 'A' },
  { key: 'option_b', label: 'B' },
  { key: 'option_c', label: 'C' },
  { key: 'option_d', label: 'D' },
] as const;


// ── STUDENT ANSWER TRACKING ──────────────────────────────────────
// Represents a single answered item in the answer map maintained
// by useExamSession and persisted to localStorage during the
// active exam session.

export interface StudentAnswer {
  question_id   : number;
  chosen_option : AnswerOption;
}

// Map of question_id → chosen_option for O(1) lookup during
// rendering (highlighting the selected option) and for building
// the final submission payload array.
//
// Keys are typed as string (not number) because JSON.stringify /
// JSON.parse — used in localStorage serialisation — converts
// numeric object keys to strings. The type mirrors that reality
// to prevent silent key-mismatch bugs.
export type AnswerMap = Record<string, AnswerOption>;


// ── EXAM SUBMISSION PAYLOAD ──────────────────────────────────────
// Request body sent to:
//   POST /api/exams/:id/submit

export interface ExamSubmitPayload {
  answers: StudentAnswer[];
}


// ── EXAM RESULT ──────────────────────────────────────────────────
// The result object nested inside the submit response.
// Also stored in ActiveExamState after a successful submission
// so ResultPage can read it without a second API call.
//
// Phase 1 additions:
//   results_visible — when false, score fields should be hidden
//                     on ResultPage and the student sees only
//                     the "submission confirmed" state.
//   questions_answered — always present; shown even when hidden.
//   total_questions    — always present; shown even when hidden.

export interface ExamResult {
  result_id?          : number;    // Absent when already_submitted is true
  total_questions     : number;
  correct_answers     : number;
  score_percentage    : number;
  submitted_at        : string;    // ISO 8601 UTC timestamp
  tab_switches?       : number;    // Present from Phase 1 onwards
  // ── Result visibility gate (Phase 1) ─────────────────────────
  // When false: ResultPage renders "Submission Confirmed" state only.
  // When true or undefined (legacy): full score displayed.
  results_visible?    : boolean;
  // These two fields are always returned regardless of visibility,
  // so the student knows how many questions they answered even
  // when the score itself is hidden.
  questions_answered? : number;
  // TRUE when time ran out before the final submit arrived and the
  // server graded the answers it had autosaved instead.
  submitted_late?     : boolean;
}

// Full response envelope from POST /api/exams/:id/submit
export interface ExamSubmitResponse {
  success           : boolean;
  already_submitted : boolean;
  message           : string;
  result            : ExamResult;
}


// ── ACTIVE EXAM SESSION STATE ────────────────────────────────────
// The complete runtime state managed by useExamSession.
// This interface is the single source of truth for everything
// ExamRoomPage renders: current question, answer grid, timer
// status, flag set, submission state, and crash recovery flag.

export interface ActiveExamState {
  // ── Loaded data ───────────────────────────────────────────────
  examId           : number;
  examTitle        : string;
  subjectName      : string;
  durationSeconds  : number;      // duration_minutes * 60
  questions        : Question[];  // Loaded once from API, never mutated
  totalQuestions   : number;      // questions.length — derived convenience

  // ── Navigation ────────────────────────────────────────────────
  currentIndex     : number;      // 0-based index of the visible question

  // ── Answers ───────────────────────────────────────────────────
  // { "42": "B", "17": "A", ... } — string keys per AnswerMap typedef
  answers          : AnswerMap;
  answeredCount    : number;      // Derived: Object.keys(answers).length

  // ── Review flags ─────────────────────────────────────────────
  // Flagged question_ids highlighted orange in the grid.
  // Flags are local UX only — never submitted to the backend.
  flaggedIds       : Set<number>;

  // ── Timer ─────────────────────────────────────────────────────
  secondsRemaining : number;
  isTimerRunning   : boolean;

  // ── Submission lifecycle ──────────────────────────────────────
  isSubmitting     : boolean;
  isSubmitted      : boolean;
  submitError      : string | null;
  result           : ExamResult | null;

  // ── Crash recovery ────────────────────────────────────────────
  // Set to true when the component mount check finds and restores
  // a previous session from localStorage. Triggers a recovery
  // banner: "Your previous session was restored. Answers saved."
  wasRestored      : boolean;
}

// localStorage key generators for exam session persistence.
// Co-locating these here prevents key string drift between
// useExamSession (writer) and ExamRoomPage (reader).
export const examStorageKeys = {
  answers      : (examId: number): string => `exam_${examId}_answers`,
  timeRemaining: (examId: number): string => `exam_${examId}_timeRemaining`,
  questionIndex: (examId: number): string => `exam_${examId}_questionIndex`,
} as const;


// ── SCOREBOARD RESULT ROW ────────────────────────────────────────
// One row returned by:
//   GET /api/teacher/results → response.results[]
//
// Phase 1 addition: final_score_percentage
//   NULL  → no manual component, display score_percentage as-is
//   value → display this instead of score_percentage

export interface ScoreboardRow {
  readonly result_id       : number;
  readonly submitted_at    : string;
  readonly total_questions : number;
  readonly correct_answers : number;
  readonly score_percentage: number;
  // TRUE when the student's time ran out before the final submit
  // arrived, so only their autosaved answers were graded.
  readonly submitted_late? : boolean;
  // ── Phase 1: manual score composite ──────────────────────────
  // When non-null, this is the authoritative display score.
  // score_percentage remains the raw CBT-only value for audit.
  readonly final_score_percentage: number | null;
  readonly student_id      : number;
  readonly full_name       : string;
  readonly login_pin       : string;
  readonly class_id        : number;
  readonly class_name      : string;
  readonly department_id   : number;
  readonly department_name : string;
  readonly branch_id       : number;
  readonly branch_name     : string;
  readonly exam_id         : number;
  readonly exam_title      : string;

  // ── Fields from updated query ─────────────────────────────────
  readonly evaluation_type  : 'midterm' | 'terminal' | null;
  readonly max_raw_mark     : number | null;
  readonly score_weight     : number | null;
  readonly academic_session : string | null;
  readonly term             : number | null;

  // Computed by SQL — raw_score = (score_percentage/100) × max_raw_mark
  readonly raw_score        : number | null;
  readonly weighted_score   : number | null;
}

// Pagination metadata returned alongside scoreboard data.
export interface PaginationMeta {
  total_records : number;
  total_pages   : number;
  current_page  : number;
  per_page      : number;
}


// ── SHARED CURRICULUM LOOKUP TYPES ──────────────────────────────
// Returned by the /api/shared/* endpoints.
// Used throughout all staff dashboards for dropdown population.

export interface ClassLevel {
  readonly id   : number;
  readonly name : 'JSS1' | 'JSS2' | 'JSS3' | 'SS1' | 'SS2' | 'SS3';
}

export interface Department {
  readonly id   : number;
  readonly name : 'General' | 'Science' | 'Art' | 'Commercial';
}

export interface Branch {
  readonly id            : number;
  readonly name          : string;
  readonly admin_count   : number;
  readonly teacher_count : number;
  readonly student_count : number;
}

export interface Subject {
  readonly subject_id      : number;
  readonly subject_name    : string;
  readonly class_id        : number;
  readonly class_name      : string;
  readonly department_id   : number;
  readonly department_name : string;
}


// ── TEACHER EXAM PAYLOADS ────────────────────────────────────────
// Request bodies for exam CRUD endpoints.

export interface CreateExamPayload {
  title                   : string;
  subject_id              : number;
  duration_minutes        : number;
  total_questions_to_show : number;
}

// All fields optional — only supplied fields are updated.
export interface UpdateExamPayload {
  title?                   : string;
  subject_id?              : number;
  duration_minutes?        : number;
  total_questions_to_show? : number;
}


// ── UPLOAD STAGING PREVIEW ROWS ──────────────────────────────────
// Used in the client-side staging tables that preview parsed
// Excel rows before they are POSTed to the upload endpoints.

export interface QuestionPreviewRow {
  rowNumber      : number;
  question_text  : string;
  option_a       : string;
  option_b       : string;
  option_c       : string;
  option_d       : string;
  correct_option : AnswerOption | '';   // Empty string = not yet parsed/invalid
  hasError       : boolean;
  errorMessage?  : string;
}

export interface StudentPreviewRow {
  rowNumber    : number;
  full_name    : string;
  class_name   : string;
  department   : string;
  branch       : string;
  hasError     : boolean;
  errorMessage?: string;
}


// ── STUDENT MANAGEMENT ───────────────────────────────────────────
// Student record as returned by teacher/admin management endpoints.
// Different from the Student auth type — includes management fields.

export interface StudentRecord {
  readonly id              : number;
  readonly full_name       : string;
  readonly login_pin       : string;
  readonly is_active       : boolean;
  readonly created_at      : string;
  readonly class_id        : number;
  readonly class_name      : string;
  readonly department_id   : number;
  readonly department_name : string;
  readonly branch_id       : number;
  readonly branch_name     : string;
  readonly arm_name        : string;
}

// Manual student creation request body.
export interface CreateStudentPayload {
  full_name     : string;
  class_id      : number;
  department_id : number;
  branch_id?    : number;   // Required only for super_admin callers
}


// ── MANUAL SCORE ENTRY (Phase 1) ────────────────────────────────
// Represents a teacher-submitted manual score adjustment record
// returned by:
//   GET /api/teacher/manual-scores  → response.entries[]
//   GET /api/admin/manual-scores    → response.entries[]
//   POST /api/teacher/manual-scores → response.entry

// Strict type for the entry_type field.
// bonus                → adds marks on top of existing CBT score
// component            → separate non-CBT component (practical, oral, etc.)
// absence_replacement  → student missed CBT; this is their entire score
export type ManualEntryType =
  | 'bonus'
  | 'component'
  | 'absence_replacement';

// Strict type for the workflow status field.
export type ManualEntryStatus = 'pending' | 'approved' | 'rejected';

export interface ManualScoreEntry {
  readonly id                    : number;
  readonly student_id            : number;
  readonly student_name          : string;
  readonly login_pin             : string;
  readonly exam_id               : number;
  readonly exam_title            : string;
  readonly max_raw_mark          : number | null;
  readonly evaluation_type       : 'midterm' | 'terminal' | null;
  readonly entry_type            : ManualEntryType;
  readonly raw_score             : number;
  readonly component_max         : number;
  readonly note                  : string | null;
  readonly status                : ManualEntryStatus;
  readonly review_note           : string | null;
  readonly created_by_username   : string;
  readonly reviewed_by_username  : string | null;
  // Current CBT score for context (null if student has no CBT result yet)
  readonly cbt_score_percentage  : number | null;
  // Updated composite score after approval (null until approved)
  readonly final_score_percentage: number | null;
  readonly created_at            : string;
  readonly reviewed_at           : string | null;
  // Admin-only fields (present in listPendingManualScores)
  readonly branch_name?          : string;
  readonly class_name?           : string;
  readonly department_name?      : string;
  readonly academic_session?     : string;
  readonly term?                 : number;
}

// Request body for POST /api/teacher/manual-scores
export interface CreateManualScorePayload {
  student_id    : number;
  exam_id       : number;
  entry_type    : ManualEntryType;
  raw_score     : number;
  component_max : number;
  note?         : string;
}

// Request body for PUT /api/admin/manual-scores/:id/review
export interface ReviewManualScorePayload {
  action      : 'approve' | 'reject';
  review_note?: string;
}

// Response from GET /api/admin/manual-scores/count
export interface PendingCountResponse {
  success       : boolean;
  pending_count : number;
}


// ── TOGGLE ACTION TYPES ──────────────────────────────────────────

export type StudentToggleAction = 'suspend' | 'reactivate';
export type AdminToggleAction   = 'suspend' | 'reactivate' | 'delete';


// ── ACTIVE ACADEMIC PERIOD (Phase 3) ─────────────────────────────
// Returned by GET /api/settings/active-period

export interface ActivePeriod {
  success       : boolean;
  active_session: string;
  active_term   : number;
  term_label    : string;
  display       : string;
  updated_at    : string;
  updated_by_id : number | null;
}


// ── REPORT CARDS (Phase 3) ───────────────────────────────────────
// Returned by GET /api/admin/report-cards/status

export interface ReportCardStatus {
  success      : boolean;
  generated    : boolean;
  approved     : boolean;
  generated_at : string | null;
  approved_by  : string | null;
  approved_at  : string | null;
}

// Request body for POST /api/admin/report-cards/generate
export interface GenerateReportCardsPayload {
  academic_session: string;
  term            : number;
  class_id        : number;
  branch_id       : number;
}

// Response from POST /api/admin/report-cards/generate
export interface GenerateReportCardsResponse {
  success            : boolean;
  students_processed?: number;
  subjects_found?    : number;
  errors?            : string[];
  message?           : string;
}

// Request body for POST /api/admin/report-cards/approve
export interface ApproveReportCardsPayload {
  academic_session: string;
  term            : number;
  class_id        : number;
  branch_id       : number;
  signature_name? : string;
}

// Response from POST /api/admin/report-cards/approve
export interface ApproveReportCardsResponse {
  success     : boolean;
  message     : string;
  approved_at?: string;
}

// Student-facing status from GET /api/exams/report-card/status
export interface StudentReportCardStatus {
  success   : boolean;
  approved  : boolean;
  term_label: string | null;
  session   : string | null;
}

// One entry in the student's report card history
export interface ReportCardHistoryPeriod {
  academic_session: string;
  term            : number;
  term_label      : string;
  approved        : boolean;
  approved_at     : string | null;
}

// Response from GET /api/exams/report-card/history
export interface StudentReportCardHistoryResponse {
  success: boolean;
  count  : number;
  periods: ReportCardHistoryPeriod[];
}


// ── REPORT CARD SUMMARIES (Phase 4) ──────────────────────────────
// Attendance, comments, and behavioral ratings — one row per
// student per term. Ratings are freeform trait:rating(1-5) maps
// rather than a fixed column set, so trait lists can vary by school.

export type RatingsMap = Record<string, number>;

export interface ReportCardSummaryListItem {
  student_id            : number;
  full_name             : string;
  login_pin             : string;
  days_present          : number | null;
  days_absent           : number | null;
  total_school_days     : number | null;
  class_teacher_comment : string | null;
  principal_comment     : string | null;
  psychomotor_ratings   : RatingsMap;
  affective_ratings     : RatingsMap;
  next_term_begins      : string | null;
  updated_at            : string | null;
}

// Response from GET /api/admin/report-cards/summaries
export interface ListReportCardSummariesResponse {
  success  : boolean;
  count    : number;
  summaries: ReportCardSummaryListItem[];
}

// Request body for PUT /api/admin/report-cards/summary
export interface UpsertReportCardSummaryPayload {
  student_id            : number;
  academic_session      : string;
  term                  : number;
  days_present?         : number | null;
  days_absent?          : number | null;
  total_school_days?    : number | null;
  class_teacher_comment?: string | null;
  principal_comment?    : string | null;
  psychomotor_ratings?  : RatingsMap;
  affective_ratings?    : RatingsMap;
  next_term_begins?     : string | null;
}

// Response from PUT /api/admin/report-cards/summary
export interface UpsertReportCardSummaryResponse {
  success: boolean;
  message: string;
}


// ── STUDENT PROMOTION ─────────────────────────────────────────

// One student in a promotable class listing
export interface PromotableStudent {
  student_id      : number;
  full_name       : string;
  login_pin       : string;
  class_id        : number;
  class_name      : string;
  department_id   : number;
  department_name : string;
}

// Response from GET /api/admin/students/promotable
export interface ListPromotableStudentsResponse {
  success : boolean;
  count   : number;
  students: PromotableStudent[];
}

// One student's destination in a promotion batch
export interface PromotionEntry {
  student_id       : number;
  to_class_id      : number;
  to_department_id?: number;
}

// Request body for POST /api/admin/students/promote
// One destination PER STUDENT — a class legitimately splits across
// multiple tracks (Science/Art/Commercial) and some students repeat
// (to_class_id equal to their current class) rather than moving.
export interface PromoteStudentsPayload {
  branch_id  : number;
  promotions : PromotionEntry[];
}

// Response from POST /api/admin/students/promote
export interface PromoteStudentsResponse {
  success          : boolean;
  message          : string;
  promoted_count?  : number;
  archived_session?: string;
  errors?          : string[];  // present on 400 validation failure
}

// One row in a past-session class roster
export interface ClassHistoryRosterRow {
  student_id           : number;
  full_name            : string;
  login_pin            : string;
  class_id             : number;
  class_name           : string;
  department_id        : number;
  department_name      : string;
  promoted_to_class_id : number | null;
  promoted_at          : string | null;
}

// Response from GET /api/admin/students/class-history
export interface ClassHistoryRosterResponse {
  success: boolean;
  count  : number;
  roster : ClassHistoryRosterRow[];
}


// ── CLASS ARMS ────────────────────────────────────────────────

export interface ClassArm {
  id             : number;
  name           : string;
  class_id       : number;
  class_name     : string;
  department_id  : number;
  department_name: string;
  branch_id      : number;
  branch_name    : string;
  student_count  : number;
}

export interface ListArmsResponse {
  success: boolean;
  count  : number;
  arms   : ClassArm[];
}

export interface CreateArmPayload {
  class_id     : number;
  department_id: number;
  branch_id?   : number;
  name         : string;
}


// ── TEACHER SUBJECT ASSIGNMENTS ──────────────────────────────

export interface TeacherSubjectAssignment {
  assignment_id  : number;
  subject_id     : number;
  subject_name   : string;
  class_id       : number;
  class_name     : string;
  department_id  : number;
  department_name: string;
  assigned_at    : string;
}

export interface ListTeacherSubjectsResponse {
  success : boolean;
  count   : number;
  subjects: TeacherSubjectAssignment[];
}


// ── CLASS TEACHER ASSIGNMENTS ─────────────────────────────────

export interface ClassTeacherAssignment {
  assignment_id  : number;
  teacher_id     : number;
  teacher_username?: string;
  class_id       : number;
  class_name     : string;
  department_id  : number;
  department_name: string;
  arm_id         : number;
  arm_name       : string;
  branch_id      : number;
  branch_name    : string;
  assigned_at    : string;
}

export interface ListClassTeacherAssignmentsResponse {
  success    : boolean;
  count      : number;
  assignments: ClassTeacherAssignment[];
}

export interface MyClassTeacherAssignmentResponse {
  success         : boolean;
  is_class_teacher: boolean;
  assignment      : ClassTeacherAssignment | null;
}


// ── TEACHER SELF-SERVICE (subject/class roster views) ────────

export interface SubjectStudent {
  student_id     : number;
  full_name      : string;
  login_pin      : string;
  is_active      : boolean;
  class_id       : number;
  class_name     : string;
  department_id  : number;
  department_name: string;
  arm_id         : number | null;
  arm_name       : string | null;
  branch_id      : number;
  branch_name    : string;
}

export interface StudentsForSubjectResponse {
  success : boolean;
  subject : { id: number; name: string };
  count   : number;
  students: SubjectStudent[];
}

export interface MyClassRosterStudent {
  student_id: number;
  full_name : string;
  login_pin : string;
  is_active : boolean;
  created_at: string;
}

export interface MyClassRosterResponse {
  success : boolean;
  count   : number;
  students: MyClassRosterStudent[];
}