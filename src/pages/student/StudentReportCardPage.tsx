// ================================================================
//  CBT SYSTEM — STUDENT REPORT CARD PAGE
//  File    : src/pages/student/StudentReportCardPage.tsx
//
//  NEW — thin page shell around the existing ReportCardStatusCard
//  component, which already handles its own status/history/
//  download logic. Previously buried inside the lobby page;
//  now has its own place in the sidebar.
// ================================================================

import React from 'react';
import ReportCardStatusCard from '../../../components/student/ReportCardStatusCard';

export default function StudentReportCardPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="text-[#0B1F14] text-2xl font-bold tracking-tight">Report Card</h1>
      <ReportCardStatusCard />
    </div>
  );
}