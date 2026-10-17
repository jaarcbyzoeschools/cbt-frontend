// ================================================================
//  CBT SYSTEM — AUTHENTICATION CONTEXT (UPDATED)
//  File    : src/context/AuthContext.tsx
//
//  Change: Added updateUser action.
//  Allows components to patch fields on staffUser in-place
//  without a full re-login. Used by MyAccountPage after a
//  successful username change so the header reflects the new
//  name immediately without a page refresh.
// ================================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import axiosInstance from '../api/axiosInstance';
import { isCandidate, TRAINING_LOGIN_PATH } from '../utils/participant';
import type {
  AuthContextType,
  StaffMeResponse,
  StudentMeResponse,
  User,
  Student,
  UserRole,
} from '../types/auth';


const STAFF_TOKEN_KEY   = 'cbt_staff_token'   as const;
const STUDENT_TOKEN_KEY = 'cbt_student_token' as const;
const STAFF_USER_KEY    = 'cbt_staff_user'    as const;
const STUDENT_USER_KEY  = 'cbt_student_user'  as const;

const AuthContext = createContext<AuthContextType | undefined>(undefined);


interface AuthProviderProps { children: React.ReactNode }

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [staffUser,    setStaffUser]    = useState<User    | null>(null);
  const [student,      setStudent]      = useState<Student | null>(null);
  const [staffToken,   setStaffToken]   = useState<string  | null>(null);
  const [studentToken, setStudentToken] = useState<string  | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  const navigate = useNavigate();


  // ── Silent rehydration (unchanged) ───────────────────────────

  useEffect((): void => {
    const rehydrate = async (): Promise<void> => {
      const savedStaffToken   = localStorage.getItem(STAFF_TOKEN_KEY);
      const savedStudentToken = localStorage.getItem(STUDENT_TOKEN_KEY);

      if (savedStaffToken !== null) {
        try {
          const response = await axiosInstance.get<StaffMeResponse>('/api/auth/staff/me');
          if (response.data.success) {
            setStaffToken(savedStaffToken);
            setStaffUser(response.data.user);
          }
        } catch {
          // Interceptor handles redirect
        } finally {
          setIsLoadingSession(false);
        }
        return;
      }

      if (savedStudentToken !== null) {
        try {
          const response = await axiosInstance.get<StudentMeResponse>('/api/auth/student/me');
          if (response.data.success) {
            setStudentToken(savedStudentToken);
            setStudent(response.data.student);
          }
        } catch {
          // Interceptor handles redirect
        } finally {
          setIsLoadingSession(false);
        }
        return;
      }

      setIsLoadingSession(false);
    };

    void rehydrate();
  }, []);


  // ── Login actions (unchanged) ─────────────────────────────────

  const loginStaff = useCallback((token: string, user: User): void => {
    localStorage.setItem(STAFF_TOKEN_KEY, token);
    localStorage.setItem(STAFF_USER_KEY, JSON.stringify(user));
    setStaffToken(token);
    setStaffUser(user);
    setStudent(null);
    setStudentToken(null);
  }, []);

  const loginStudent = useCallback((token: string, studentData: Student): void => {
    localStorage.setItem(STUDENT_TOKEN_KEY, token);
    localStorage.setItem(STUDENT_USER_KEY, JSON.stringify(studentData));
    setStudentToken(token);
    setStudent(studentData);
    setStaffUser(null);
    setStaffToken(null);
  }, []);


  // ── NEW: updateUser ───────────────────────────────────────────
  // Merges a partial User object into the current staffUser state
  // and persists the updated object to localStorage.
  // Used by MyAccountPage after a successful username/profile save
  // so the header avatar and name update without a full re-login.

  const updateUser = useCallback((partial: Partial<User>): void => {
    setStaffUser((prev: User | null): User | null => {
      if (prev === null) return null;
      const updated: User = { ...prev, ...partial };
      // Keep localStorage in sync so a page refresh still shows
      // the updated name
      localStorage.setItem(STAFF_USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);


  // ── Logout (unchanged) ────────────────────────────────────────

  const logout = useCallback((redirectPath?: string): void => {
    const wasStudentSession: boolean = studentToken !== null;
    const wasCandidateSession: boolean = isCandidate(student);

    const allKeys      = Object.keys(localStorage);
    const keysToRemove = allKeys.filter(
      (key) => key.startsWith('cbt_') || key.startsWith('exam_')
    );
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    setStaffUser(null);
    setStudent(null);
    setStaffToken(null);
    setStudentToken(null);

    const destination = redirectPath !== undefined
      ? redirectPath
      : wasStudentSession
        ? (wasCandidateSession ? TRAINING_LOGIN_PATH : '/login/student')
        : '/login/staff';

    navigate(destination, { replace: true });
  }, [navigate, studentToken, student]);


  // ── Derived state (unchanged) ─────────────────────────────────

  const isAuthenticated: boolean = staffUser !== null || student !== null;

  const role: UserRole | null = useMemo((): UserRole | null => {
    if (staffUser !== null) return staffUser.role;
    if (student   !== null) return 'student';
    return null;
  }, [staffUser, student]);


  // ── Context value ─────────────────────────────────────────────

  const contextValue: AuthContextType = useMemo(
    (): AuthContextType => ({
      staffUser,
      student,
      staffToken,
      studentToken,
      role,
      isAuthenticated,
      isLoadingSession,
      loginStaff,
      loginStudent,
      logout,
      updateUser,    // ← NEW
    }),
    [
      staffUser,
      student,
      staffToken,
      studentToken,
      role,
      isAuthenticated,
      isLoadingSession,
      loginStaff,
      loginStudent,
      logout,
      updateUser,   // ← NEW
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error(
      '[useAuth] must be called inside an <AuthProvider> component. ' +
      'Ensure AuthProvider wraps your application in main.tsx.'
    );
  }
  return context;
}

export default AuthProvider;