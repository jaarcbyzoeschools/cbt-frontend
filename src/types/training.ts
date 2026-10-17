// ================================================================
//  CBT SYSTEM — TRAINING COURSE TYPES
//  File : src/types/training.ts
//  Mirrors the shapes returned by /api/training/* (backend
//  controllers/trainingController.js).
// ================================================================

export interface TrainingCourse {
  readonly id             : number;
  readonly name           : string;
  readonly description    : string | null;
  readonly branch_id      : number | null;
  readonly branch_name    : string | null;
  readonly is_active      : boolean;
  readonly created_at     : string;
  readonly batch_count    : number;
  readonly candidate_count: number;
}

export interface TrainingBatch {
  readonly id                 : number;
  readonly course_id          : number;
  readonly course_name        : string;
  readonly name               : string;
  readonly start_date         : string | null;   // YYYY-MM-DD
  readonly end_date           : string | null;   // YYYY-MM-DD
  readonly papers_in_order    : boolean;
  readonly results_released   : boolean;
  readonly results_released_at: string | null;
  readonly created_at         : string;
  readonly candidate_count    : number;
  readonly paper_count        : number;
  readonly active_paper_count : number;
}

export interface TrainingCandidate {
  readonly id              : number;
  readonly batch_id        : number;
  readonly full_name       : string;
  readonly login_pin       : string;
  readonly phone           : string | null;
  readonly email           : string | null;
  readonly gender          : 'Male' | 'Female' | null;
  readonly is_active       : boolean;
  readonly created_at      : string;
  readonly papers_submitted: number;
}

export interface TrainingPaper {
  readonly id                     : number;
  readonly title                  : string;
  readonly duration_minutes       : number;
  readonly total_questions_to_show: number;
  readonly is_active              : boolean;
  readonly paper_order            : number | null;
  readonly training_batch_id      : number;
  readonly created_at             : string;
  readonly question_count         : number;
  readonly submitted_count        : number;
  readonly in_progress_count      : number;
}

export interface PaperQuestion {
  readonly id            : number;
  readonly question_text : string;
  readonly option_a      : string;
  readonly option_b      : string;
  readonly option_c      : string;
  readonly option_d      : string;
  readonly correct_option: 'A' | 'B' | 'C' | 'D';
}

// ── Results ──────────────────────────────────────────────────────

export interface ResultCell {
  readonly exam_id          : number;
  readonly taken            : boolean;
  readonly score_percentage?: number;
  readonly correct_answers? : number;
  readonly total_questions? : number;
  readonly grade?           : string;
  readonly remark?          : string;
  readonly submitted_late?  : boolean;
  readonly submitted_at?    : string;
}

export interface ResultRow {
  readonly candidate: {
    readonly id       : number;
    readonly full_name: string;
    readonly login_pin: string;
    readonly gender   : string | null;
    readonly is_active: boolean;
  };
  readonly papers      : ResultCell[];
  readonly papers_taken: number;
  readonly papers_total: number;
  readonly complete    : boolean;
  readonly average     : number;
  readonly grade       : string | null;
  readonly remark      : string;
  readonly position    : number | null;
}

export interface ResultPaperHeader {
  readonly id                     : number;
  readonly title                  : string;
  readonly paper_order            : number | null;
  readonly total_questions_to_show: number;
  readonly duration_minutes       : number;
  readonly is_active              : boolean;
}

export interface BatchResultsSummary {
  readonly candidates   : number;
  readonly sat_any      : number;
  readonly completed_all: number;
  readonly batch_average: number | null;
  readonly passed       : number;
}

export interface BatchResultsResponse {
  readonly success     : boolean;
  readonly batch       : TrainingBatch;
  readonly summary     : BatchResultsSummary;
  readonly papers      : ResultPaperHeader[];
  readonly rows        : ResultRow[];
  readonly ranked_count: number;
}

// ── Candidate lobby (/api/training/me) ──────────────────────────

export type CandidatePaperStatus = 'completed' | 'available' | 'in_progress' | 'locked' | 'closed';

export interface CandidatePaper {
  readonly exam_id                : number;
  readonly title                  : string;
  readonly paper_order            : number | null;
  readonly duration_minutes       : number;
  readonly total_questions_to_show: number;
  readonly status                 : CandidatePaperStatus;
  readonly note                   : string | null;
  readonly submitted_at           : string | null;
  // Present only once results are released
  readonly score_percentage?      : number;
  readonly correct_answers?       : number;
  readonly total_questions?       : number;
  readonly grade?                 : string;
  readonly remark?                : string;
}

export interface CandidateSummary {
  readonly papers_taken: number;
  readonly papers_total: number;
  readonly average     : number;
  readonly grade       : string | null;
  readonly remark      : string;
  readonly position    : number | null;
  readonly ranked_count: number;
}

export interface MyTrainingResponse {
  readonly success: boolean;
  readonly candidate: {
    readonly id                : number;
    readonly full_name         : string;
    readonly login_pin         : string;
    readonly course_name       : string;
    readonly course_description: string | null;
    readonly batch_name        : string;
    readonly start_date        : string | null;
    readonly end_date          : string | null;
  };
  readonly papers_in_order : boolean;
  readonly results_released: boolean;
  readonly papers          : CandidatePaper[];
  readonly summary         : CandidateSummary | null;
}
