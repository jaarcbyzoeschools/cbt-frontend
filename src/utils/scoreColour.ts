// ================================================================
//  CBT SYSTEM — SCORE COLOUR & BAND CLASSIFICATION UTILITY
//  File    : src/utils/scoreColour.ts
//
//  Fix applied in this version:
//    PostgreSQL NUMERIC columns are serialised as strings by the
//    node-postgres (pg) driver — e.g. score_percentage arrives as
//    "60.00" not 60. Number.isFinite("60.00") === false, causing
//    formatScorePercentage to return "0.00%" for every value and
//    SummaryBar to produce NaN averages via string concatenation.
//
//    Solution: toNumericScore() coerces any incoming value to a
//    finite number. getScoreColour, getScoreBand, and
//    formatScorePercentage now accept number | string | null |
//    undefined and coerce internally, so every call site is safe
//    regardless of whether the pg driver sends a string or a
//    future change sends a number.
// ================================================================


// ── TYPES ────────────────────────────────────────────────────────

export type ScoreBand =
  | 'distinction'
  | 'credit'
  | 'pass'
  | 'fail';

export interface ScoreColour {
  textClass    : string;
  bgClass      : string;
  borderClass  : string;
  badgeClass   : string;
  heroTextClass: string;
  bandLabel    : string;
  resultMessage: string;
  band         : ScoreBand;
}


// ── THRESHOLDS ───────────────────────────────────────────────────

export const SCORE_THRESHOLDS = {
  distinction : 70,
  credit      : 50,
  pass        : 40,
  fail        : 0,
} as const satisfies Record<ScoreBand, number>;


// ── SAFE COERCION ─────────────────────────────────────────────────

/**
 * toNumericScore
 *
 * PostgreSQL NUMERIC columns arrive from the pg driver as strings
 * (e.g. "60.00") rather than JavaScript numbers. Any arithmetic or
 * formatting on a raw string silently produces wrong results:
 *   "60.00" + "40.00"  === "60.0040.00"  (string concatenation)
 *   Number.isFinite("60.00") === false    (causes 0.00% display)
 *
 * This function coerces any incoming value safely to a finite
 * number clamped to [0, 100], returning 0 on any failure.
 */
export function toNumericScore(
  raw: number | string | null | undefined,
): number {
  if (raw === null || raw === undefined) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}


// ── BAND CLASSIFICATION ───────────────────────────────────────────

/**
 * getScoreBand
 * Accepts number | string | null | undefined — coerces via
 * toNumericScore before classification so string values from
 * the pg driver are handled transparently.
 */
export function getScoreBand(
  score: number | string | null | undefined,
): ScoreBand {
  const n = toNumericScore(score);
  if (n >= SCORE_THRESHOLDS.distinction) return 'distinction';
  if (n >= SCORE_THRESHOLDS.credit)      return 'credit';
  if (n >= SCORE_THRESHOLDS.pass)        return 'pass';
  return 'fail';
}


// ── COLOUR MAP ────────────────────────────────────────────────────

const BAND_COLOUR_MAP = {
  distinction: {
    textClass    : 'text-[#166534]',
    bgClass      : 'bg-[#F0FDF4]',
    borderClass  : 'border-[#86EFAC]',
    badgeClass   : 'bg-[#F0FDF4] text-[#166534] border border-[#86EFAC]',
    heroTextClass: 'text-[#166534]',
    bandLabel    : 'Distinction',
    resultMessage: 'Excellent performance! An outstanding result.',
    band         : 'distinction' as ScoreBand,
  },
  credit: {
    textClass    : 'text-[#1D4ED8]',
    bgClass      : 'bg-[#EFF6FF]',
    borderClass  : 'border-[#BFDBFE]',
    badgeClass   : 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]',
    heroTextClass: 'text-[#1D4ED8]',
    bandLabel    : 'Credit',
    resultMessage: 'Good performance. A solid result.',
    band         : 'credit' as ScoreBand,
  },
  pass: {
    textClass    : 'text-[#92400E]',
    bgClass      : 'bg-[#FFFBEB]',
    borderClass  : 'border-[#FCD34D]',
    badgeClass   : 'bg-[#FFFBEB] text-[#92400E] border border-[#FCD34D]',
    heroTextClass: 'text-[#92400E]',
    bandLabel    : 'Pass',
    resultMessage: 'You passed. Keep practising to improve further.',
    band         : 'pass' as ScoreBand,
  },
  fail: {
    textClass    : 'text-[#991B1B]',
    bgClass      : 'bg-[#FEF2F2]',
    borderClass  : 'border-[#FCA5A5]',
    badgeClass   : 'bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]',
    heroTextClass: 'text-[#991B1B]',
    bandLabel    : 'Fail',
    resultMessage: 'Below the pass mark. See your teacher for guidance.',
    band         : 'fail' as ScoreBand,
  },
} as const satisfies Record<ScoreBand, ScoreColour>;


// ── PRIMARY EXPORT ────────────────────────────────────────────────

/**
 * getScoreColour
 * Accepts number | string | null | undefined — coerces internally.
 */
export function getScoreColour(
  score: number | string | null | undefined,
): ScoreColour {
  return BAND_COLOUR_MAP[getScoreBand(score)];
}


// ── FORMATTING ────────────────────────────────────────────────────

/**
 * formatScorePercentage
 * Accepts number | string | null | undefined — coerces internally.
 * Returns exactly two decimal places with a trailing % symbol.
 *
 * Examples:
 *   formatScorePercentage("60.00") → "60.00%"   ← fixed (was "0.00%")
 *   formatScorePercentage(87.5)    → "87.50%"
 *   formatScorePercentage(null)    → "0.00%"
 */
export function formatScorePercentage(
  score: number | string | null | undefined,
): string {
  return `${toNumericScore(score).toFixed(2)}%`;
}


// ── COMPARISON ────────────────────────────────────────────────────

/**
 * compareScores
 * Coerces both values so string scores sort correctly.
 */
export function compareScores(
  a  : number | string | null | undefined,
  b  : number | string | null | undefined,
  asc: boolean = false,
): number {
  const delta = toNumericScore(a) - toNumericScore(b);
  return asc ? delta : -delta;
}