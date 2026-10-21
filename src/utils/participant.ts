// ================================================================
//  CBT SYSTEM — PARTICIPANT HELPERS
//  File : src/utils/participant.ts
//
//  Training-course candidates (outsiders, not school students)
//  share the student session slot so the exam room works for both.
//  These helpers decide which lobby / login page each one uses.
// ================================================================

import type { Student } from '../types/auth';

export const TRAINING_LOBBY_PATH = '/training/lobby' as const;
export const TRAINING_LOGIN_PATH = '/login/training' as const;
export const STUDENT_LOBBY_PATH  = '/student/lobby'  as const;
export const STUDENT_LOGIN_PATH  = '/login/student'  as const;

export function isCandidate(student: Student | null | undefined): boolean {
  return student?.participant_type === 'candidate';
}

export function lobbyPathFor(student: Student | null | undefined): string {
  return isCandidate(student) ? TRAINING_LOBBY_PATH : STUDENT_LOBBY_PATH;
}

export function loginPathFor(student: Student | null | undefined): string {
  return isCandidate(student) ? TRAINING_LOGIN_PATH : STUDENT_LOGIN_PATH;
}

/**
 * For code that runs outside React (e.g. the axios 401 handler):
 * reads the saved session to tell whether it belongs to a candidate.
 */
export function storedSessionIsCandidate(): boolean {
  try {
    const raw = localStorage.getItem('cbt_student_user');
    if (raw === null) return false;
    const parsed: unknown = JSON.parse(raw);
    return (
      parsed !== null &&
      typeof parsed === 'object' &&
      (parsed as { participant_type?: unknown }).participant_type === 'candidate'
    );
  } catch {
    return false;
  }
}


/**
 * A short tag naming whoever is logged in on this PC, e.g. "s42" for
 * student 42 or "c7" for training candidate 7. Read from the session
 * token itself, so it is right even after a page refresh.
 * Returns "" if nobody is logged in.
 */
export function participantStorageTag(): string {
  try {
    const token = localStorage.getItem('cbt_student_token');
    if (token === null) return '';
    for (const part of token.split('.')) {
      try {
        const json: unknown = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
        if (json !== null && typeof json === 'object') {
          const p = json as { type?: unknown; student_id?: unknown; candidate_id?: unknown };
          if (p.type === 'candidate' && p.candidate_id !== undefined) return `c${String(p.candidate_id)}`;
          if (p.student_id !== undefined) return `s${String(p.student_id)}`;
        }
      } catch { /* not the payload part */ }
    }
  } catch { /* storage unavailable */ }
  return '';
}
