// ================================================================
//  CBT SYSTEM — ROLE-BASED ROUTE GUARD COMPONENT
//  File    : src/components/auth/RoleRoute.tsx
//  Purpose : Fine-grained permission guard used INSIDE the staff
//            route tree (after StaffRoute has already confirmed
//            authentication). Restricts specific dashboard sections
//            to only the roles that are permitted to access them.
//
//  StaffRoute vs RoleRoute — responsibility split:
//    StaffRoute  → "Are you logged in as any staff member?"
//    RoleRoute   → "Are you logged in as THIS specific role?"
//
//  Guard logic (evaluated in order):
//    1. isLoadingSession === true
//       → Render loader. RoleRoute can appear in deeply nested
//         route trees where the parent StaffRoute loader may have
//         already resolved, but we guard defensively here too.
//
//    2. role === null || !isAuthenticated
//       → Session somehow lost between StaffRoute and RoleRoute.
//         Redirect to /login/staff. Should not occur in normal
//         flow but handled for defensive completeness.
//
//    3. !allowedRoles.includes(role)
//       → The authenticated user's role is not in the allowed
//         list for this route. Redirect to their own dashboard
//         home rather than to the login page — they ARE logged
//         in, just in the wrong section.
//         Example: a Teacher navigating to /dashboard/superadmin
//         is redirected to /dashboard/teacher, not to /login/staff.
//
//    4. All checks pass → render <Outlet />.
//
//  Usage in App.tsx:
//    // Super Admin only section:
//    <Route element={<RoleRoute allowedRoles={['super_admin']} />}>
//      <Route path="/dashboard/superadmin" element={<SuperAdminHomePage />} />
//    </Route>
//
//    // Admin and Super Admin shared section:
//    <Route element={<RoleRoute allowedRoles={['admin', 'super_admin']} />}>
//      <Route path="/dashboard/admin" element={<AdminHomePage />} />
//    </Route>
//
//    // Teacher, Admin, and Super Admin:
//    <Route element={<RoleRoute allowedRoles={['teacher', 'admin', 'super_admin']} />}>
//      <Route path="/dashboard/teacher" element={<TeacherHomePage />} />
//    </Route>
// ================================================================

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../src/context/AuthContext';
import type { StaffRole } from '../../src/types/auth';


// ── ROLE → DEFAULT DASHBOARD MAP ─────────────────────────────────
// Maps each staff role to its home dashboard path.
// Used in Guard 3 to redirect an authenticated user who is in
// the wrong section back to their own dashboard home.

const ROLE_DASHBOARD_MAP: Record<StaffRole, string> = {
  super_admin : '/dashboard/superadmin',
  admin       : '/dashboard/admin',
  teacher     : '/dashboard/teacher',
} as const;


// ── PROPS ─────────────────────────────────────────────────────────

interface RoleRouteProps {
  /**
   * The staff roles permitted to access the wrapped routes.
   * At least one role must be provided — an empty array would
   * block all users which is never the intended behaviour.
   * The type is ReadonlyArray so callers can pass `as const`
   * tuples without a widening cast.
   */
  allowedRoles: ReadonlyArray<StaffRole>;
}


// ── MINIMAL INLINE LOADER ─────────────────────────────────────────
// Lightweight — by the time RoleRoute renders, StaffRoute's loader
// has usually already resolved. This is purely a safety net.

function RoleCheckLoader(): React.JSX.Element {
  return (
    <div
      className="min-h-screen bg-slate-900 flex items-center justify-center"
      role="status"
      aria-label="Checking permissions"
    >
      <div className="w-10 h-10 rounded-full border-4 border-slate-700 border-t-teal-500 animate-spin" />
    </div>
  );
}


// ── ROLE ROUTE GUARD ──────────────────────────────────────────────

export function RoleRoute({ allowedRoles }: RoleRouteProps): React.JSX.Element {
  const { isAuthenticated, isLoadingSession, role } = useAuth();
  const location = useLocation();

  // ── Guard 1: Session still loading ────────────────────────────
  if (isLoadingSession) {
    return <RoleCheckLoader />;
  }

  // ── Guard 2: No session (defensive — StaffRoute should catch) ──
  if (!isAuthenticated || role === null) {
    return (
      <Navigate
        to="/login/staff"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // ── Guard 3: Session exists but role not in allowed list ───────
  // Students are typed as UserRole not StaffRole, so we must
  // narrow before the ROLE_DASHBOARD_MAP lookup.
  if (role === 'student') {
    // A student who somehow reaches a RoleRoute goes to student login.
    return <Navigate to="/login/student" replace />;
  }

  // role is narrowed to StaffRole here
  const staffRole = role as StaffRole;

  if (staffRole === 'super_admin') {
  return <Outlet />;
}

// ── Guard 5: Standard role check for admin and teacher ─────────────
if (!allowedRoles.includes(staffRole)) {
  const ownDashboard: string = ROLE_DASHBOARD_MAP[staffRole];
  return (
    <Navigate
      to    = {ownDashboard}
      replace
      state = {{ unauthorisedFrom: location.pathname }}
    />
  );
}

  // ── All guards passed: render the nested route ─────────────────
  return <Outlet />;
}

export default RoleRoute;