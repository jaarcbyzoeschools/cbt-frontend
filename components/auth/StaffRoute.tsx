// ================================================================
//  CBT SYSTEM — STAFF ROUTE GUARD COMPONENT
//  File    : src/components/auth/StaffRoute.tsx
//  Purpose : Protects every staff-facing page (Super Admin, Admin,
//            Teacher dashboards) from unauthenticated access and
//            from access by student session tokens.
//
//  Guard logic (evaluated in order):
//    1. isLoadingSession === true
//       → Render a full-screen loader while AuthContext silently
//         calls /api/auth/staff/me to rehydrate a stored session.
//         Without this, the guard would redirect a logged-in teacher
//         to the login page on every page refresh before the /me
//         call completes.
//
//    2. !isAuthenticated
//       → No valid session of any kind. Redirect to /login/staff.
//         The `replace` prop replaces the history entry so pressing
//         the browser back button from the login page does not
//         attempt to re-enter the protected route.
//
//    3. role === 'student'
//       → A student session token is present. Students must not
//         access staff dashboards. Redirect to /login/staff so
//         they can authenticate with proper staff credentials.
//         (In practice, students on exam terminals will never
//         navigate to a staff URL, but the guard prevents it.)
//
//    4. All checks pass → render the protected child route via
//       <Outlet /> so nested route trees work correctly.
//
//  Usage in App.tsx:
//    <Route element={<StaffRoute />}>
//      <Route path="/dashboard/teacher" element={<TeacherHomePage />} />
//      <Route path="/dashboard/admin"   element={<AdminHomePage />} />
//    </Route>
// ================================================================

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {useAuth} from "../../src/context/AuthContext"


// ── FULL-SCREEN LOADER ───────────────────────────────────────────
// Shown only during the silent /me session rehydration on first
// app load. Styled to match the slate-900 background so there is
// no white flash before the correct page renders.

function SessionLoader(): React.JSX.Element {
  return (
    <div
      className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4"
      role="status"
      aria-label="Loading session"
    >
      {/* Animated teal spinner ring */}
      <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-teal-500 animate-spin" />
      <p className="text-slate-400 text-sm tracking-wide">
        Verifying session…
      </p>
    </div>
  );
}


// ── STAFF ROUTE GUARD ─────────────────────────────────────────────

export function StaffRoute(): React.JSX.Element {
  const { isAuthenticated, isLoadingSession, role } = useAuth();
  const location = useLocation();

  // ── Guard 1: Session still loading ────────────────────────────
  // Block render until the silent /me rehydration resolves.
  if (isLoadingSession) {
    return <SessionLoader />;
  }

  // ── Guard 2: No authenticated session at all ──────────────────
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login/staff"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // ── Guard 3: Authenticated but as a student ───────────────────
  // A student token must not grant access to staff routes.
  if (role === 'student') {
    return (
      <Navigate
        to="/login/staff"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // ── All guards passed: render the nested staff route ──────────
  return <Outlet />;
}

export default StaffRoute;