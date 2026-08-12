// ================================================================
//  CBT SYSTEM — TIME FORMATTING UTILITY
//  File    : src/utils/timeFormatter.ts
//  Purpose : All time and duration string formatting for the
//            application. Centralising here means the countdown
//            clock display, exam duration labels, scoreboard
//            timestamps, and result submission times all share
//            one consistent formatting rule set.
//
//  Consumers:
//    — useCountdown / ExamRoomPage   : formatCountdown()
//    — StudentLobbyPage exam cards   : formatDuration()
//    — ExamManagementPage            : formatDuration()
//    — ScoreboardPage submitted_at   : formatSubmittedAt()
//    — ResultPage submitted_at       : formatSubmittedAt()
//    — TeacherHomePage recent exams  : formatDuration()
//
//  Design rules:
//    — All functions are pure — no side effects, no Date mutations.
//    — Input values outside expected ranges are clamped or guarded
//      rather than throwing, since display formatting should never
//      crash the UI.
//    — Offline context: no Intl.DateTimeFormat locale assumptions
//      beyond 'en-NG' (Nigerian English) for timestamp display,
//      matching the school's locale. Falls back to ISO string if
//      the Intl API is unavailable (extremely unlikely in modern
//      Chromium-based lab browsers).
// ================================================================


// ── ZERO-PAD HELPER ──────────────────────────────────────────────

/**
 * Pads a non-negative integer to a minimum of two digits.
 * Used by every formatted time string in this module.
 *
 * Examples:
 *   pad(0)  → '00'
 *   pad(5)  → '05'
 *   pad(59) → '59'
 *   pad(60) → '60'   (no truncation — caller handles range)
 */
function pad(value: number): string {
  return Math.floor(Math.abs(value)).toString().padStart(2, '0');
}


// ── COUNTDOWN FORMATTER ───────────────────────────────────────────

/**
 * formatCountdown
 *
 * Converts a raw seconds count into the HH:MM:SS digital clock
 * string displayed in the ExamRoomPage top header timer.
 *
 * Behaviour:
 *   — Values ≤ 0 return '00:00:00' (never shows negative time).
 *   — Hours segment is always shown (even if 0) for visual
 *     consistency — the clock width never changes during the exam.
 *   — Maximum representable value is 99:59:59 (359,999 seconds).
 *     No CBT exam approaches this duration, but the output is
 *     still well-formed for any input.
 *
 * Examples:
 *   formatCountdown(3600)  → '01:00:00'
 *   formatCountdown(3661)  → '01:01:01'
 *   formatCountdown(59)    → '00:00:59'
 *   formatCountdown(0)     → '00:00:00'
 *   formatCountdown(-5)    → '00:00:00'
 *   formatCountdown(7199)  → '01:59:59'
 *
 * @param totalSeconds - Remaining seconds as a non-negative integer.
 * @returns            - Zero-padded HH:MM:SS string.
 */
export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));

  const hours   = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}


// ── DURATION LABEL FORMATTER ──────────────────────────────────────

/**
 * formatDuration
 *
 * Converts a duration in minutes into a human-readable label
 * for display on exam cards and exam management tables.
 * Shows hours and minutes when applicable, minutes-only otherwise.
 *
 * Examples:
 *   formatDuration(30)   → '30 mins'
 *   formatDuration(60)   → '1 hr'
 *   formatDuration(90)   → '1 hr 30 mins'
 *   formatDuration(120)  → '2 hrs'
 *   formatDuration(75)   → '1 hr 15 mins'
 *   formatDuration(0)    → '0 mins'
 *   formatDuration(1)    → '1 min'
 *   formatDuration(61)   → '1 hr 1 min'
 *
 * @param totalMinutes - Duration in minutes (non-negative integer).
 * @returns            - Human-readable duration label string.
 */
export function formatDuration(totalMinutes: number): string {
  const clamped = Math.max(0, Math.floor(totalMinutes));

  if (clamped === 0) return '0 mins';

  const hours   = Math.floor(clamped / 60);
  const minutes = clamped % 60;

  const hourPart  : string =
    hours   > 0 ? `${hours} ${hours   === 1 ? 'hr'  : 'hrs'}`  : '';
  const minutePart: string =
    minutes > 0 ? `${minutes} ${minutes === 1 ? 'min' : 'mins'}` : '';

  if (hourPart && minutePart) return `${hourPart} ${minutePart}`;
  if (hourPart)               return hourPart;
  return minutePart;
}


// ── TIMESTAMP FORMATTER ───────────────────────────────────────────

/**
 * formatSubmittedAt
 *
 * Formats an ISO 8601 UTC timestamp string (as returned by the
 * backend submitted_at field) into a human-readable local date
 * and time string appropriate for the Nigerian school context.
 *
 * Target locale: 'en-NG' (Nigerian English, WAT = UTC+1).
 * Output format: 'DD/MM/YYYY, HH:MM:SS AM/PM'
 * Example: '23/06/2026, 02:45:30 PM'
 *
 * Behaviour:
 *   — Invalid or empty strings return 'N/A' rather than throwing.
 *   — If Intl.DateTimeFormat is unavailable (no-op fallback for
 *     very old browsers), returns the raw ISO string trimmed of
 *     the 'T' separator for basic readability.
 *   — All formatting is locale-aware via the Intl API — no manual
 *     string slicing of the ISO timestamp, which would produce
 *     incorrect results when the UTC offset crosses a date boundary.
 *
 * @param isoString - ISO 8601 timestamp e.g. '2026-06-23T13:45:30.000Z'
 * @returns         - Localised display string or 'N/A' on failure.
 */
export function formatSubmittedAt(isoString: string): string {
  if (!isoString || isoString.trim().length === 0) return 'N/A';

  try {
    const date = new Date(isoString);

    // Guard against unparseable strings that produce Invalid Date.
    if (!Number.isFinite(date.getTime())) return 'N/A';

    // Use the Intl.DateTimeFormat API for locale-correct formatting.
    // timeZone: 'Africa/Lagos' is West Africa Time (WAT, UTC+1),
    // the timezone for all Nigerian school locations this system serves.
    const formatter = new Intl.DateTimeFormat('en-NG', {
      timeZone  : 'Africa/Lagos',
      day       : '2-digit',
      month     : '2-digit',
      year      : 'numeric',
      hour      : '2-digit',
      minute    : '2-digit',
      second    : '2-digit',
      hour12    : true,
    });

    return formatter.format(date);

  } catch {
    // Intl API unavailable or threw — return a minimal fallback
    // that at least shows the raw string in a readable form.
    return isoString.replace('T', ' ').replace('Z', ' UTC').trim();
  }
}


// ── UNIT CONVERSION HELPERS ───────────────────────────────────────

/**
 * secondsToMinutes
 *
 * Converts a seconds value to minutes, rounded down to the
 * nearest whole minute. Used when displaying "X mins remaining"
 * fallback text alongside the HH:MM:SS clock.
 *
 * Examples:
 *   secondsToMinutes(3600) → 60
 *   secondsToMinutes(90)   → 1
 *   secondsToMinutes(59)   → 0
 *   secondsToMinutes(0)    → 0
 *
 * @param seconds - Non-negative seconds value.
 * @returns       - Whole minutes (floor division).
 */
export function secondsToMinutes(seconds: number): number {
  return Math.floor(Math.max(0, seconds) / 60);
}

/**
 * minutesToSeconds
 *
 * Converts a duration in minutes to the equivalent seconds value.
 * Used by ExamRoomPage to initialise the useCountdown hook from
 * the exam's duration_minutes field.
 *
 * Examples:
 *   minutesToSeconds(60) → 3600
 *   minutesToSeconds(45) → 2700
 *   minutesToSeconds(0)  → 0
 *
 * @param minutes - Non-negative minutes value.
 * @returns       - Equivalent seconds as a non-negative integer.
 */
export function minutesToSeconds(minutes: number): number {
  return Math.max(0, Math.floor(minutes)) * 60;
}


// ── RELATIVE TIME HELPER ──────────────────────────────────────────

/**
 * formatRelativeTime
 *
 * Returns a human-readable relative time string for recently
 * created records on dashboard home pages.
 * Examples: 'just now', '5 mins ago', '2 hrs ago', '3 days ago'.
 *
 * Uses wall-clock difference only — does not account for timezone
 * offsets since dashboard display is always on the local server
 * machine in WAT.
 *
 * @param isoString - ISO 8601 timestamp of the record's created_at.
 * @returns         - Relative time string, or 'N/A' on parse failure.
 */
export function formatRelativeTime(isoString: string): string {
  if (!isoString || isoString.trim().length === 0) return 'N/A';

  try {
    const then = new Date(isoString);
    if (!Number.isFinite(then.getTime())) return 'N/A';

    const nowMs   = Date.now();
    const thenMs  = then.getTime();
    const diffMs  = Math.max(0, nowMs - thenMs);
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60)                       return 'just now';
    if (diffSec < 3600)  {
      const mins = Math.floor(diffSec / 60);
      return `${mins} ${mins === 1 ? 'min' : 'mins'} ago`;
    }
    if (diffSec < 86400) {
      const hrs = Math.floor(diffSec / 3600);
      return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'} ago`;
    }

    const days = Math.floor(diffSec / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;

  } catch {
    return 'N/A';
  }
}


// ── ISO DATE PARSER ───────────────────────────────────────────────

/**
 * parseIsoToLocal
 *
 * Parses an ISO 8601 string and returns a plain Date object in
 * the local timezone. Returns null if the string is unparseable.
 * Used when a component needs to perform date arithmetic (e.g.,
 * checking if a result was submitted today) rather than just
 * formatting for display.
 *
 * @param isoString - ISO 8601 timestamp string.
 * @returns         - Date object or null on failure.
 */
export function parseIsoToLocal(isoString: string): Date | null {
  if (!isoString || isoString.trim().length === 0) return null;

  try {
    const date = new Date(isoString);
    return Number.isFinite(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}