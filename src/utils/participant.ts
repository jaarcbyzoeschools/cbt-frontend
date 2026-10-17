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
