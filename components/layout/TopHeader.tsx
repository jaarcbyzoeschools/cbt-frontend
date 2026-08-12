// ================================================================
//  CBT SYSTEM — STAFF DASHBOARD TOP HEADER
//  File    : src/components/layout/TopHeader.tsx
//
//  Design system: Vibrant Institutional Light Mode
//  Surface     #FFFFFF   header background
//  Border      #D7F2E0   bottom edge, dividers
//  Ink-1       #0B1F14   page title
//  Ink-2       #3D5347   secondary text
//  Ink-3       #6B8479   metadata
//  Accent      #4AE17A   active states, avatar fill
//  Accent-Hov  #22B85C   hover states
//  Accent-L    #E7FBEE   accent light fill
//
//  Active period pill stays amber — it's informational/neutral,
//  deliberately distinct from the brand green so it doesn't read
//  as an action or status indicator.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
}                          from 'react';
import {
  Menu,
  ChevronDown,
  LogOut,
  User,
  Wifi,
  WifiOff,
  Building2,
  BookOpen,
}                          from 'lucide-react';

import type { StaffRole, StaffProfileExtended } from '../../src/types/auth';
import { useAuth } from '../../src/context/AuthContext';
import axiosInstance       from '../../src/api/axiosInstance';
import { useLocation, useNavigate } from 'react-router-dom';


// ── PAGE TITLE MAP ────────────────────────────────────────────────

interface TitleEntry { match: string; title: string }

const PAGE_TITLES: TitleEntry[] = [
  { match: '/dashboard/superadmin/branches',         title: 'Branch Management'         },
  { match: '/dashboard/superadmin/admins',           title: 'Administrator Accounts'    },
  { match: '/dashboard/superadmin/academic-period',  title: 'Academic Period'           },
  { match: '/dashboard/superadmin/overview',         title: 'Institution Overview'      },
  { match: '/dashboard/superadmin',                  title: 'Super Admin Dashboard'     },
  { match: '/dashboard/admin/teachers',              title: 'Teacher Accounts'          },
  { match: '/dashboard/admin/classes',               title: 'Classes & Departments'     },
  { match: '/dashboard/admin',                       title: 'Branch Admin Dashboard'    },
  { match: '/dashboard/teacher/students',            title: 'Student Enrolment'         },
  { match: '/dashboard/teacher/exams',               title: 'Exams & Question Banks'    },
  { match: '/dashboard/teacher/results',             title: 'Scoreboard & Reports'      },
  { match: '/dashboard/teacher/analytics',           title: 'Question Analytics'        },
  { match: '/dashboard/teacher',                     title: 'Teacher Dashboard'         },
  { match: '/dashboard/account',                     title: 'My Account'                },
  { match: '/dashboard/settings',                    title: 'Account Settings'          },
];

function resolvePageTitle(pathname: string): string {
  return PAGE_TITLES.find((e) => pathname.startsWith(e.match))?.title ?? 'Dashboard';
}


// ── ROLE LABELS ───────────────────────────────────────────────────

const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin : 'Super Administrator',
  admin       : 'Branch Administrator',
  teacher     : 'Teacher',
} as const;

const ROLE_BADGE: Record<StaffRole, string> = {
  super_admin: 'bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]',
  admin      : 'bg-[#F1F5F9] text-[#3D5347] border border-[#D7F2E0]',
  teacher    : 'bg-[#E7FBEE] text-[#15803D] border border-[#86EFAC]',
} as const;


// ── SERVER STATUS HOOK ────────────────────────────────────────────

type ServerStatus = 'online' | 'offline' | 'checking';

function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>('checking');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async (): Promise<void> => {
    try {
      await axiosInstance.get('/api/auth/staff/me');
      setStatus('online');
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect((): (() => void) => {
    void check();
    intervalRef.current = setInterval(() => { void check(); }, 30_000);
    return (): void => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [check]);

  return status;
}


// ── ACTIVE PERIOD HOOK ────────────────────────────────────────────

interface ActivePeriod {
  display       : string;
  active_session: string;
  active_term   : number;
  term_label    : string;
}

interface ActivePeriodResponse {
  success       : boolean;
  display       : string;
  active_session: string;
  active_term   : number;
  term_label    : string;
}

function useActivePeriod(): ActivePeriod | null {
  const [period, setPeriod] = useState<ActivePeriod | null>(null);

  useEffect((): void => {
    const fetch = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<ActivePeriodResponse>(
          '/api/settings/active-period'
        );
        if (res.data.success) {
          setPeriod({
            display       : res.data.display,
            active_session: res.data.active_session,
            active_term   : res.data.active_term,
            term_label    : res.data.term_label,
          });
        }
      } catch {
        // Silent — period indicator is informational, never blocks UI
      }
    };
    void fetch();
  }, []);

  return period;
}


// Fetches the staff member's full profile (including branch_name)
function useStaffBranchName(staffUser: { branch_id: number | null } | null): string | null {
  const [branchName, setBranchName] = useState<string | null>(null);

  useEffect((): void => {
    if (staffUser === null || staffUser.branch_id === null) {
      setBranchName(null);
      return;
    }

    const fetch = async (): Promise<void> => {
      try {
        const res = await axiosInstance.get<{
          success: boolean;
          message: string;
          user: StaffProfileExtended;
        }>('/api/auth/staff/me');
        if (res.data.success) {
          setBranchName(res.data.user.branch_name);
        }
      } catch {
        // Silent — branch name is informational, never blocks the header
      }
    };
    void fetch();
  }, [staffUser?.branch_id]); // eslint-disable-line react-hooks/exhaustive-deps

  return branchName;
}

// ── PROPS ─────────────────────────────────────────────────────────

interface TopHeaderProps { onMenuClick: () => void }


// ================================================================
//  COMPONENT
// ================================================================

export function TopHeader({ onMenuClick }: TopHeaderProps): React.JSX.Element {
  const { staffUser, role, logout } = useAuth();
  const location     = useLocation();
  const serverStatus = useServerStatus();
  const activePeriod = useActivePeriod();
  const branchName   = useStaffBranchName(staffUser); 
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const staffRole = role as StaffRole | null;
  const pageTitle = resolvePageTitle(location.pathname);
  const navigate = useNavigate();

  useEffect((): (() => void) => {
    const h = (e: MouseEvent): void => {
      if (dropdownRef.current !== null &&
          !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    console.log(staffUser)
    console.log("we are live")

    document.addEventListener('mousedown', h);
    return (): void => document.removeEventListener('mousedown', h);
  }, []);

  // Server status config — green now means "online" AND is the
  // brand accent, so we keep it visually consistent: the same
  // green family used everywhere else for positive/active states.
  const statusConfig = serverStatus === 'online'
    ? {
        icon   : <Wifi size={14} />,
        label  : 'Server Online',
        dotCls : 'bg-[#22B85C]',
        pillCls: 'bg-[#E7FBEE] border border-[#86EFAC] text-[#15803D]',
      }
    : serverStatus === 'offline'
    ? {
        icon   : <WifiOff size={14} />,
        label  : 'Server Offline',
        dotCls : 'bg-[#991B1B]',
        pillCls: 'bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]',
      }
    : {
        icon   : <Wifi size={14} className="animate-pulse" />,
        label  : 'Checking…',
        dotCls : 'bg-[#6B8479]',
        pillCls: 'bg-[#F4FBF6] border border-[#D7F2E0] text-[#3D5347]',
      };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-5 lg:px-7 bg-white border-b border-[#D7F2E0] flex-shrink-0">

      {/* ── Left: hamburger + page title ─────────────────────────── */}
      <div className="flex items-center gap-4 min-w-0">

        <button
          type      = "button"
          onClick   = {onMenuClick}
          className = "lg:hidden p-2 rounded-lg text-[#6B8479] hover:text-[#0B1F14] hover:bg-[#F4FBF6] transition-colors"
          aria-label= "Open navigation menu"
        >
          <Menu size={22} />
        </button>

        <div className="hidden lg:block w-px h-6 bg-[#D7F2E0]" />

        <div className="min-w-0">
          <h1 className="text-[#0B1F14] text-lg font-bold truncate leading-tight">
            {pageTitle}
          </h1>
          {staffUser !== null &&
           staffRole !== null &&
           staffRole !== 'super_admin' &&
           staffUser.branch_id !== null && (
          
            <p className="text-[#6B8479] text-sm flex items-center gap-1.5 mt-0.5">
              <Building2 size={12} />
             <span>
                Branch ID {staffUser.branch_id}
                {branchName !== null && (
                  <span className="text-[#3D5347] font-medium"> — {branchName} Campus</span>
                )}
    </span>
            </p>
            
          )}
        </div>
      </div>


      {/* ── Right: period + status + user menu ───────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">

        {/* Active academic period pill — stays amber, deliberately
            distinct from the brand green so it reads as neutral
            information, not an action or status indicator.      */}
        {activePeriod !== null ? (
          <div
            className = "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E]"
            title     = {`Active academic period: ${activePeriod.display}`}
          >
            <BookOpen size={14} className="flex-shrink-0" />
            <span className="hidden lg:inline">
              {activePeriod.active_session}
            </span>
            <span className="hidden lg:inline text-[#FCD34D]">·</span>
            <span>
              {activePeriod.term_label}
            </span>
          </div>
        ) : (
          <div className="hidden sm:block h-8 w-36 bg-[#F4FBF6] rounded-lg animate-pulse" />
        )}

        <div className="hidden sm:block w-px h-6 bg-[#D7F2E0]" />

        {/* Server status pill */}
        <div
          className = {`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${statusConfig.pillCls}`}
          title     = {statusConfig.label}
        >
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusConfig.dotCls}`} />
          {statusConfig.icon}
          <span className="hidden md:inline">{statusConfig.label}</span>
        </div>

        <div className="hidden sm:block w-px h-6 bg-[#D7F2E0]" />

        {/* User avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type         = "button"
            onClick      = {() => setDropdownOpen((p) => !p)}
            className    = "flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#F4FBF6] border border-transparent hover:border-[#D7F2E0] transition-all"
            aria-haspopup= "true"
            aria-expanded= {dropdownOpen}
          >
            <div className="w-8 h-8 rounded-full bg-[#4AE17A] flex items-center justify-center flex-shrink-0">
              <span className="text-[#0B1F14] text-sm font-bold">
                {staffUser?.username.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>

            <div className="hidden sm:block text-left min-w-0">
              <p className="text-[#0B1F14] text-sm font-bold leading-tight truncate max-w-[130px]">
                {staffUser?.username ?? 'User'}
              </p>
              <p className="text-[#6B8479] text-xs leading-tight">
                {staffRole !== null ? ROLE_LABELS[staffRole] : ''}
              </p>
            </div>

            <ChevronDown
              size      = {15}
              className = {`text-[#6B8479] transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white border border-[#D7F2E0] shadow-lg overflow-hidden z-50">

              <div className="px-5 py-4 border-b border-[#D7F2E0] bg-[#F4FBF6]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#4AE17A] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#0B1F14] text-base font-bold">
                      {staffUser?.username.charAt(0).toUpperCase() ?? 'U'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#0B1F14] text-base font-bold truncate">
                      {staffUser?.username ?? 'User'}
                    </p>
                    <p className="text-[#6B8479] text-sm truncate">
                      {staffUser?.email ?? ''}
                    </p>
                  </div>
                </div>
                {staffRole !== null && (
                  <div className="mt-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${ROLE_BADGE[staffRole]}`}>
                      {ROLE_LABELS[staffRole]}
                    </span>
                  </div>
                )}

                {activePeriod !== null && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FFFBEB] border border-[#FCD34D]">
                    <BookOpen size={13} className="text-[#92400E] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[#92400E] text-sm font-bold leading-tight">
                        {activePeriod.term_label}
                      </p>
                      <p className="text-[#92400E] text-xs leading-tight opacity-80">
                        {activePeriod.active_session}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="py-2">
                <button
                  type      = "button"
                  onClick   = {() => {
                    setDropdownOpen(false);
                    navigate('/dashboard/account');
                  }}
                  className = "flex items-center gap-3 w-full px-5 py-3 text-base text-[#3D5347] hover:bg-[#F4FBF6] hover:text-[#0B1F14] transition-colors font-medium"
                >
                  <User size={16} className="text-[#6B8479]" />
                  My Account
                </button>

                <div className="my-1 mx-3 border-t border-[#D7F2E0]" />

                <button
                  type      = "button"
                  onClick   = {() => { setDropdownOpen(false); logout(); }}
                  className = "flex items-center gap-3 w-full px-5 py-3 text-base text-[#991B1B] hover:bg-[#FEF2F2] transition-colors font-semibold"
                >
                  <LogOut size={16} />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopHeader;