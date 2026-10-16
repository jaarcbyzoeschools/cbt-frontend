// ================================================================
//  CBT SYSTEM — STUDENT SIDEBAR
//  File    : components/layout/StudentSidebar.tsx
//
//  THIS REVISION — fixes a real defect: the sidebar was previously
//  `hidden lg:flex` with no mobile alternative at all. Below 1024px
//  it simply vanished, leaving a student on a phone with no way to
//  reach Profile/Results/Report Card whatsoever. Now takes isOpen/
//  onClose props and renders the exact same desktop-static +
//  mobile-slide-in-drawer pattern already used by StaffSidebar.tsx,
//  so mobile behaves the same way it already does for staff.
//
//  Confirmed decisions (unchanged from before):
//    — No "Change Password" — students log in with a PIN, not a
//      username/password, so there's no password to change.
//    — Only wraps the PORTAL pages (Dashboard, Profile, Results,
//      Report Card). The exam room and result-submission screens
//      stay full-screen with no sidebar at all — deliberate,
//      unrelated to this change.
// ================================================================

import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCircle,
  History,
  Award,
  BookOpen,
  LogOut,
  X,
} from 'lucide-react';

import { useAuth } from '../../src/context/AuthContext';
import axiosInstance from '../../src/api/axiosInstance';


interface MyProfileResponse { success: boolean; student: { photo_path: string | null } }

interface StudentSidebarProps {
  isOpen : boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { label: 'Dashboard',    path: '/student/lobby',       icon: <LayoutDashboard size={18} /> },
  { label: 'My Profile',   path: '/student/profile',     icon: <UserCircle      size={18} /> },
  { label: 'My Results',   path: '/student/results',     icon: <History         size={18} /> },
  { label: 'Report Card',  path: '/student/report-card', icon: <Award           size={18} /> },
];

export function StudentSidebar({ isOpen, onClose }: StudentSidebarProps): React.JSX.Element {
  const { student, logout } = useAuth();
  const [photoPath, setPhotoPath] = useState<string | null>(null);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<MyProfileResponse>('/api/student/me');
        if (res.data.success) setPhotoPath(res.data.student.photo_path);
      } catch { /* non-fatal — falls back to the letter avatar */ }
    };
    void load();
  }, []);

  const navLinkClass = (isActive: boolean): string => [
    'flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left',
    'text-base font-medium transition-all duration-100 border-l-4',
    isActive
      ? 'bg-[#E7FBEE] text-[#15803D] border-[#4AE17A] font-semibold'
      : 'text-[#3D5347] hover:text-[#0B1F14] hover:bg-[#F4FBF6] border-transparent',
  ].join(' ');

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#D7F2E0]">

      <div className="flex items-center justify-between px-5 py-5 border-b border-[#D7F2E0]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4AE17A] flex items-center justify-center flex-shrink-0">
            <BookOpen size={18} className="text-[#0B1F14]" />
          </div>
          <div>
            <p className="text-[#0B1F14] text-base font-bold leading-tight">CBT System</p>
            <p className="text-[#6B8479] text-sm leading-tight">Student Portal</p>
          </div>
        </div>
        <button
          type      = "button"
          onClick   = {onClose}
          className = "lg:hidden p-1.5 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors"
          aria-label= "Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      {student !== null && (
        <div className="px-5 py-4 border-b border-[#D7F2E0]">
          <div className="flex items-center gap-3">
            {photoPath !== null ? (
              <img
                src       = {`${axiosInstance.defaults.baseURL ?? ''}${photoPath}`}
                alt       = {student.full_name}
                className = "w-11 h-11 rounded-full object-cover flex-shrink-0 border border-[#D7F2E0]"
                onError   = {() => setPhotoPath(null)}
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#4AE17A] flex items-center justify-center flex-shrink-0">
                <span className="text-[#0B1F14] text-base font-bold">
                  {student.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[#0B1F14] text-base font-bold truncate leading-tight">{student.full_name}</p>
              {/* <p className="text-[#6B8479] text-sm truncate mt-0.5">{student.class_name}</p> */}
              <p>DLB</p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key       = {item.path}
            to        = {item.path}
            className = {({ isActive }) => navLinkClass(isActive)}
            onClick   = {onClose}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-[#D7F2E0]">
        <button
          type      = "button"
          onClick   = {() => logout('/login/student')}
          className = {[
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl',
            'text-base font-semibold text-[#3D5347]',
            'hover:text-[#991B1B] hover:bg-[#FEF2F2]',
            'transition-all duration-100 border-l-4 border-transparent',
          ].join(' ')}
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop — static, always visible at lg+ */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:flex-shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile — backdrop + slide-in drawer, same pattern as StaffSidebar */}
      {isOpen && (
        <div
          className  = "fixed inset-0 z-40 bg-[#0B1F14]/50 lg:hidden"
          onClick    = {onClose}
          aria-hidden= "true"
        />
      )}

      <aside
        className = {[
          'fixed inset-y-0 left-0 z-50 w-72 flex flex-col',
          'transform transition-transform duration-300 ease-in-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-label= "Navigation menu"
      >
        {sidebarContent}
      </aside>
    </>
  );
}

export default StudentSidebar;