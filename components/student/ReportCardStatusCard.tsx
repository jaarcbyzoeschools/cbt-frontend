// ================================================================
//  CBT SYSTEM — STUDENT REPORT CARD CARD
//  File    : src/components/student/ReportCardStatusCard.tsx
//  Phase 4: Student-facing self-service report card download.
//  Phase 4b: Extended to show full history — past terms, not just
//            the currently active one.
//
//  Self-contained: fetches its own history, shows every term the
//  student has report card data for (approved or still pending),
//  and lets them download any approved one. Drop this into
//  StudentLobbyPage.tsx (or wherever the student dashboard lives)
//  — it has no external state dependencies beyond axiosInstance.
//
//  Design: Vibrant Institutional Light Mode tokens, matching the
//  rest of the app's card styling (rounded-2xl, #D7F2E0 borders).
// ================================================================

import React, { useEffect, useState } from 'react';
import { Award, Download, Loader2, Clock, CheckCircle2 } from 'lucide-react';

import axiosInstance from '../../src/api/axiosInstance';
import type { ReportCardHistoryPeriod, StudentReportCardHistoryResponse } from '../../src/types/exam';

export default function ReportCardStatusCard(): React.JSX.Element | null {
  const [periods, setPeriods] = useState<ReportCardHistoryPeriod[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect((): void => {
    const load = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<StudentReportCardHistoryResponse>(
          '/api/exams/report-card/history'
        );
        if (res.data.success) setPeriods(res.data.periods);
      } catch {
        // Non-fatal — card just doesn't render if history can't be fetched
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const periodKey = (p: ReportCardHistoryPeriod): string => `${p.academic_session}-${p.term}`;

  const handleDownload = async (period: ReportCardHistoryPeriod): Promise<void> => {
    setDownloadingKey(periodKey(period));
    setError(null);
    try {
      const res = await axiosInstance.get('/api/exams/report-card/pdf', {
        params: { academic_session: period.academic_session, term: period.term },
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ReportCard_${period.academic_session.replace('/', '-')}_T${period.term}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setError('Could not download that report card. Please try again or contact your teacher.');
    } finally {
      setDownloadingKey(null);
    }
  };

  // Nothing to show while loading or if no periods exist yet at all —
  // avoids flashing an empty/broken card on the student lobby.
  if (isLoading || periods.length === 0) return null;

  return (
    <div className="bg-white border border-[#D7F2E0] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
        <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center flex-shrink-0">
          <Award size={17} className="text-[#0369A1]" />
        </div>
        <div>
          <p className="text-[#0B1F14] text-base font-bold">Report Cards</p>
          <p className="text-[#6B8479] text-sm">All terms</p>
        </div>
      </div>

      {error !== null && (
        <p className="text-[#991B1B] text-sm px-5 pt-3">{error}</p>
      )}

      <div>
        {periods.map((p, i) => {
          const key = periodKey(p);
          const isDownloading = downloadingKey === key;
          return (
            <div
              key={key}
              className={[
                'flex items-center gap-3 px-5 py-3 border-b border-[#F4FBF6] last:border-0',
                i % 2 === 0 ? 'bg-white' : 'bg-[#F4FBF6]',
              ].join(' ')}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[#0B1F14] text-sm font-semibold">
                  {p.academic_session} — {p.term_label}
                </p>
                <p className="text-[#6B8479] text-xs flex items-center gap-1 mt-0.5">
                  {p.approved ? (
                    <>
                      <CheckCircle2 size={11} className="text-[#15803D]" />
                      Available
                    </>
                  ) : (
                    <>
                      <Clock size={11} />
                      Not yet published
                    </>
                  )}
                </p>
              </div>
              {p.approved && (
                <button
                  type="button"
                  onClick={() => void handleDownload(p)}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#0B1F14] bg-[#4AE17A] hover:bg-[#22B85C] transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  Download
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}