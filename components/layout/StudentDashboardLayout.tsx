// ================================================================
//  CBT SYSTEM — STUDENT DASHBOARD LAYOUT
//  File    : components/layout/StudentDashboardLayout.tsx


import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { GraduationCap, CalendarDays, BookOpenCheck, Menu } from 'lucide-react';

import axiosInstance from '../../src/api/axiosInstance';
import StudentSidebar from './StudentSidebar';


interface MyProfileResponse {
  success: boolean;
  student: { class_name: string; arm_name: string | null };
}
interface ActivePeriodResponse {
  success: boolean;
  display: string;
  active_session: string;
  active_term: number;
  term_label: string;
}

const TERM_WORDS: Record<number, string> = { 1: 'FIRST TERM', 2: 'SECOND TERM', 3: 'THIRD TERM' };

export default function StudentDashboardLayout(): React.JSX.Element {
  const [classArm, setClassArm]   = useState<string>('');
  const [term, setTerm]           = useState<string>('');
  const [session, setSession]     = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  useEffect((): void => {
    const loadProfile = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<MyProfileResponse>('/api/student/me');
        if (res.data.success) {
          setClassArm(`${res.data.student.class_name}${res.data.student.arm_name ?? ''}`);
        }
      } catch (err) {
        console.error('[StudentDashboardLayout] Failed to load profile for top bar:', err);
      }
    };
    const loadPeriod = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<ActivePeriodResponse>('/api/student/active-period');
        if (res.data.success) {
          setTerm(TERM_WORDS[res.data.active_term] ?? res.data.term_label);
          setSession(res.data.active_session);
        }
      } catch (err) {
        console.error('[StudentDashboardLayout] Failed to load active period for top bar:', err);
      }
    };
    void loadProfile();
    void loadPeriod();
  }, []);

  return (
    <div className="min-h-screen bg-[#F4FBF6] flex">
      <StudentSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">

        {/* Top info bar — hamburger toggle (mobile only) + Class+Arm /
            Term / Session, matching the reference layout's header row. */}
        <div className="bg-white border-b border-[#D7F2E0] px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <button
            type      = "button"
            onClick   = {() => setIsSidebarOpen(true)}
            className = "lg:hidden p-2 rounded-lg text-[#3D5347] hover:bg-[#F4FBF6] transition-colors flex-shrink-0"
            aria-label= "Open navigation"
          >
            <Menu size={20} />
          </button>

          {/* <div className="flex items-center gap-6 flex-wrap ml-auto">
            <div className="flex items-center gap-2">
              <GraduationCap size={15} className="text-[#6B8479]" />
              <div>
                <p className="text-[#0B1F14] text-sm font-bold leading-tight">{classArm || '—'}</p>
                <p className="text-[#6B8479] text-xs leading-tight">Class</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BookOpenCheck size={15} className="text-[#6B8479]" />
              <div>
                <p className="text-[#0B1F14] text-sm font-bold leading-tight">{term || '—'}</p>
                <p className="text-[#6B8479] text-xs leading-tight">Current Term</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays size={15} className="text-[#6B8479]" />
              <div>
                <p className="text-[#0B1F14] text-sm font-bold leading-tight">{session || '—'}</p>
                <p className="text-[#6B8479] text-xs leading-tight">Current Session</p>
              </div>
            </div>
          </div> */}
        </div>

        <div className="flex-1 px-6 py-6 max-w-5xl w-full mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}