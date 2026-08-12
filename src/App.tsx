// ================================================================
//  CBT SYSTEM — ROOT APPLICATION ROUTER
//  File    : src/App.tsx
//
//  Addition: GradeEntryPage lazy import + route at
//  /dashboard/teacher/grades -- the new "Enter Grades" screen for
//  Test (fallback) and Other component score entry.
// ================================================================

import React, { Suspense } from 'react';
import {
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { StaffRoute }      from '../components/auth/StaffRoute';
import { StudentRoute }    from '../components/auth/StudentRoute';
import { RoleRoute }       from '../components/auth/RoleRoute';
import { DashboardLayout } from '../components/layout/DashboardLayout';


// ================================================================
//  LAZY PAGE IMPORTS
// ================================================================

// -- Auth pages ----------------------------------------------------
const StaffLoginPage   = React.lazy(
  () => import('./pages/auth/StaffLoginPage')
);
const StudentLoginPage = React.lazy(
  () => import('./pages/auth/StudentLoginPage')
);

// -- Super Admin pages ----------------------------------------------
const SuperAdminHomePage   = React.lazy(
  () => import('./pages/superadmin/SuperAdminHomePage')
);
const BranchManagementPage = React.lazy(
  () => import('./pages/superadmin/BranchManagementPage')
);
const AdminAccountsPage    = React.lazy(
  () => import('./pages/superadmin/AdminAccountsPage')
);
const AcademicPeriodPage   = React.lazy(
  () => import('./pages/superadmin/AcademicPeriodPage')
);
const SchoolSettingsPage   = React.lazy(
  () => import('./pages/superadmin/SchoolSettingsPage')
);

// -- Admin pages ------------------------------------------------------
const AdminHomePage       = React.lazy(
  () => import('./pages/admin/AdminHomePage')
);
const TeacherAccountsPage = React.lazy(
  () => import('./pages/admin/TeacherAccountsPage')
);
const ClassDeptViewPage   = React.lazy(
  () => import('./pages/admin/ClassDeptViewPage')
);

const  ClassArmsPage = React.lazy(
  () =>import('./pages/admin/ClassArmsPage')
)

const DataCompletenessPage = React.lazy(
  () => import('./pages/admin/DataCompletenessPage')
)

// -- Teacher pages -----------------------------------------------------
const TeacherHomePage      = React.lazy(
  () => import('./pages/teacher/TeacherHomePage')
);
const StudentEnrolmentPage = React.lazy(
  () => import('./pages/teacher/StudentEnrolmentPage')
);
const ExamManagementPage   = React.lazy(
  () => import('./pages/teacher/ExamManagementPage')
);
const ScoreboardPage       = React.lazy(
  () => import('./pages/teacher/ScoreBoardPage')
);

const QuestionAnalyticsPage = React.lazy(
  () => import('./pages/teacher/QuestionAnalyticsPage')
);

const GradeEntryPage = React.lazy(
  () => import('./pages/teacher/GradeEntryPage')
);

const MyAccountPage = React.lazy(
  () => import('./pages/shared/MyAccountPage')
);
// -- Student pages ------------------------------------------------------
const StudentDashboardLayout = React.lazy(
  () => import('../components/layout/StudentDashboardLayout')
);
const StudentDashboardPage = React.lazy(
  () => import('./pages/student/StudentDashboardPage')
);
const StudentProfilePage = React.lazy(
  () => import('./pages/student/StudentProfilePage')
);
const StudentResultsPage = React.lazy(
  () => import('./pages/student/StudentResultsPage')
);
const StudentReportCardPage = React.lazy(
  () => import('./pages/student/StudentReportCardPage')
);
const ExamRoomPage     = React.lazy(
  () => import('./pages/student/ExamRoomPage')
);
const ResultPage       = React.lazy(
  () => import('./pages/student/ResultPage')
);
const InstitutionOverviewPage = React.lazy(
  () => import('./pages/superadmin/InstitutionOverviewPage')
);




// ================================================================
//  GLOBAL SUSPENSE FALLBACK
// ================================================================

function PageLoader(): React.JSX.Element {
  return (
    <div
      className  = "min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4"
      role       = "status"
      aria-label = "Loading page"
    >
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 animate-spin" />
      </div>
      <p className="text-slate-400 text-sm tracking-wide">Loading…</p>
    </div>
  );
}


// ================================================================
//  404 PAGE
// ================================================================

function NotFoundPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-slate-500 text-8xl font-bold">404</p>
      <h1 className="text-slate-100 text-2xl font-semibold">Page Not Found</h1>
      <p className="text-slate-400 text-sm max-w-xs">
        The page you are looking for does not exist or has been moved.
      </p>
      <Navigate to="/login/staff" replace />
    </div>
  );
}


// ================================================================
//  ROOT APP COMPONENT
// ================================================================

export default function App(): React.JSX.Element {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>

        {/* -- Root redirect --------------------------------- */}
        <Route
          index
          element={<Navigate to="/login/staff" replace />}
        />

        {/* -- PUBLIC ROUTES ---------------------------------- */}
        <Route
          path    = "/login/staff"
          element = {<StaffLoginPage />}
        />
        <Route
          path    = "/login/student"
          element = {<StudentLoginPage />}
        />

        {/* -- STAFF PROTECTED ROUTES ---------------------------- */}

        <Route element={<StaffRoute />}>

          {/* -- Super Admin only --------------------------- */}
          <Route element={<RoleRoute allowedRoles={['super_admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route
                path    = "/dashboard/superadmin"
                element = {<SuperAdminHomePage />}
              />
              <Route
                path    = "/dashboard/superadmin/branches"
                element = {<BranchManagementPage />}
              />
              <Route
                path    = "/dashboard/superadmin/admins"
                element = {<AdminAccountsPage />}
              />
              <Route
                path    = "/dashboard/superadmin/academic-period"
                element = {<AcademicPeriodPage />}
              />
              <Route
                path    = "/dashboard/superadmin/school-settings"
                element = {<SchoolSettingsPage />}
              />
              <Route                                                    
                path    = "/dashboard/superadmin/overview"             
                element = {<InstitutionOverviewPage />}               
              /> 
            </Route>
          </Route>

          {/* -- Admin + Super Admin ------------------------- */}
          <Route element={<RoleRoute allowedRoles={['admin', 'super_admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route
                path    = "/dashboard/admin"
                element = {<AdminHomePage />}
              />
              <Route
                path    = "/dashboard/admin/teachers"
                element = {<TeacherAccountsPage />}
              />
              <Route
                path    = "/dashboard/admin/classes"
                element = {<ClassDeptViewPage />}
              />
               <Route
                path    = "/dashboard/admin/arms"
                element = {<ClassArmsPage />}
              />
               <Route
                path    = "/dashboard/admin/completeness"
                element = {<DataCompletenessPage />}
              />
            </Route>
          </Route>

          {/* -- Teacher + Admin + Super Admin ---------------- */}
          <Route element={<RoleRoute allowedRoles={['teacher', 'admin', 'super_admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route
                path    = "/dashboard/teacher"
                element = {<TeacherHomePage />}
              />
              <Route
                path    = "/dashboard/teacher/students"
                element = {<StudentEnrolmentPage />}
              />
              <Route
                path    = "/dashboard/teacher/exams"
                element = {<ExamManagementPage />}
              />
              <Route
                path    = "/dashboard/teacher/results"
                element = {<ScoreboardPage />}
              />

               <Route
                path    = "/dashboard/teacher/analytics"
                element = {<QuestionAnalyticsPage />}
              />
              <Route
                path    = "/dashboard/teacher/grades"
                element = {<GradeEntryPage />}
              />
            <Route
            path    = "/dashboard/account"
            element = {<MyAccountPage />}
          />
              
            </Route>
          </Route>

        </Route>
        {/* End StaffRoute */}

        {/* -- STUDENT PROTECTED ROUTES -------------------------- */}

        <Route element={<StudentRoute />}>

          {/* -- Portal pages — wrapped in the sidebar layout ---- */}
          <Route element={<StudentDashboardLayout />}>
            <Route
              path    = "/student/lobby"
              element = {<StudentDashboardPage />}
            />
            <Route
              path    = "/student/profile"
              element = {<StudentProfilePage />}
            />
            <Route
              path    = "/student/results"
              element = {<StudentResultsPage />}
            />
            <Route
              path    = "/student/report-card"
              element = {<StudentReportCardPage />}
            />
          </Route>

          {/* -- Exam-taking — full-screen, no sidebar, unchanged -
              Deliberately outside the layout above: the
              distraction-free exam terminal design predates this
              portal restructure and shouldn't change because of it. */}
          <Route
            path    = "/student/exam/:examId"
            element = {<ExamRoomPage />}
          />
          <Route
            path    = "/student/result"
            element = {<ResultPage />}
          />
        </Route>

        {/* -- 404 CATCH-ALL -------------------------------------- */}
        <Route path="*" element={<NotFoundPage />} />

      </Routes>
    </Suspense>
  );
}