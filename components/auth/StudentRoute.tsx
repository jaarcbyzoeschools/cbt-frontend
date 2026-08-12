// ================================================================
//  CBT SYSTEM — STUDENT ROUTE GUARD COMPONENT
//  File    : src/components/auth/StudentRoute.tsx
//  Purpose : Protects all student-facing exam terminal pages
//            (StudentLobbyPage, ExamRoomPage, ResultPage) from
//            unauthenticated access and from access by staff
//            session tokens.
//
//  Guard logic (evaluated in order):
//    1. isLoadingSession === true
//       → Render a full-screen loader while AuthContext silently
//         calls /api/auth/student/me to rehydrate a stored session.
//         Without this, a student who refreshes mid-exam would be
//         kicked to the login page before their session resolves.
//
//    2. !isAuthenticated
//       → No valid session of any kind. Redirect to /login/student.
//         The `replace` prop prevents a back-button redirect loop.
//
//    3. role !== 'student'
//       → A staff token is present. A teacher or admin navigating
//         to /student/lobby must not access the student terminal.
//         Redirect to /login/student so they realise they are on
//         the wrong portal. In practice staff members never
//         navigate to student URLs, but the guard is explicit.
//
//    4. All checks pass → render the protected child route via
//       <Outlet />.
//
//  Usage in App.tsx:
//    <Route element={<StudentRoute />}>
//      <Route path="/student/lobby"        element={<StudentLobbyPage />} />
//      <Route path="/student/exam/:examId" element={<ExamRoomPage />} />
//      <Route path="/student/result"       element={<ResultPage />} />
//    </Route>
//
//  Exam crash-recovery note:
//    When a terminal loses power mid-exam and the student moves
//    to a backup machine, they re-enter their PIN on
//    /login/student. A successful login sets the student token
//    in AuthContext and localStorage. When the browser then
//    navigates to /student/exam/:examId, this guard passes,
//    and ExamRoomPage's mount effect reads the answer cache
//    from localStorage to restore the session.
// ================================================================

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../src/context/AuthContext';


// ── FULL-SCREEN LOADER ───────────────────────────────────────────
// Student terminals use a darker, more minimal loader to avoid
// visual distraction during the session verification phase.
// The teal spinner matches the exam terminal colour scheme.

function StudentSessionLoader(): React.JSX.Element {
  return (
    <div
      className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6"
      role="status"
      aria-label="Verifying student session"
    >
      {/* Outer ring — static slate */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
        {/* Inner ring — animated teal */}
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 animate-spin" />
      </div>

      <div className="text-center space-y-1">
        <p className="text-slate-200 text-base font-medium">
          Please wait
        </p>
        <p className="text-slate-500 text-sm">
          Verifying your exam session…
        </p>
      </div>
    </div>
  );
}


// ── STUDENT ROUTE GUARD ───────────────────────────────────────────

export function StudentRoute(): React.JSX.Element {
  const { isAuthenticated, isLoadingSession, role } = useAuth();
  const location = useLocation();

  // ── Guard 1: Session still loading ────────────────────────────
  // Hold render until the silent /api/auth/student/me call in
  // AuthContext resolves. This prevents a returning student
  // (navigating back to /student/exam/:id after a refresh)
  // from being bounced to /login/student prematurely.
  if (isLoadingSession) {
    return <StudentSessionLoader />;
  }

  // ── Guard 2: No authenticated session ─────────────────────────
  // No token of any kind — must authenticate first.
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login/student"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // ── Guard 3: Authenticated but as staff ───────────────────────
  // Staff tokens must not grant access to the exam terminal.
  // This covers super_admin, admin, and teacher roles.
  if (role !== 'student') {
    return (
      <Navigate
        to="/login/student"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // ── All guards passed: render the nested student route ────────
  return <Outlet />;
}

export default StudentRoute;