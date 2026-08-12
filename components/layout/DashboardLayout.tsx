// ================================================================
//  CBT SYSTEM — STAFF DASHBOARD LAYOUT WRAPPER
//  File    : src/components/layout/DashboardLayout.tsx
//
//  Design system: Vibrant Institutional Light Mode
//  Canvas  #F4FBF6 · Surface #FFFFFF · Border #D7F2E0
// ================================================================

import React, { useState } from 'react';
import { Outlet }          from 'react-router-dom';

import { StaffSidebar }    from './StaffSidebar';
import { TopHeader }       from './TopHeader';

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export function DashboardLayout({
  children,
}: DashboardLayoutProps): React.JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  return (
    // ── Outer shell: full viewport, no overflow, flex row ────────
    // bg-[#F4FBF6] is the app canvas — a faint green-tinted
    // off-white so white cards visibly sit on top of it.
    <div className="flex h-screen overflow-hidden bg-[#F4FBF6]">

      {/* ── Left column: sidebar ─────────────────────────────── */}
      <StaffSidebar
        isOpen  = {sidebarOpen}
        onClose = {() => setSidebarOpen(false)}
      />

      {/* ── Right column: header + scrollable content ─────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Sticky top header */}
        <TopHeader onMenuClick={() => setSidebarOpen(true)} />

        {/* ── Scrollable page content area ─────────────────────── */}
        <main
          className = "flex-1 overflow-y-auto min-h-0"
          id        = "main-content"
        >
          <div className="p-5 lg:p-7 max-w-screen-2xl mx-auto">
            {children !== undefined ? children : <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;