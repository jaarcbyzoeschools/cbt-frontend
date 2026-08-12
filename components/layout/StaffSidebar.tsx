// ================================================================
//  CBT SYSTEM — STAFF SIDEBAR
//  File    : components/layout/StaffSidebar.tsx
//
//  Design system: Vibrant Institutional Light Mode
//  Background  #F4FBF6   app background (shown through gaps)
//  Surface     #FFFFFF   sidebar background
//  Border      #D7F2E0   all edges and dividers
//  Ink-1       #0B1F14   active nav text
//  Ink-2       #3D5347   inactive nav text
//  Ink-3       #6B8479   labels, metadata
//  Accent      #4AE17A   active nav indicator + fill
//  Accent-Hov  #22B85C   hover/pressed states
//  Accent-L    #E7FBEE   active nav background
//
//  Addition: "Class Arms" nav entry under Branch Administration,
//  linking to the new src/pages/admin/ClassArmsPage.tsx.
// ================================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
}                              from 'react';
import { NavLink} from 'react-router-dom';
import {
  LayoutDashboard,
  GitBranch,
  ShieldCheck,
  UserCheck,
  BookOpen,
  ClipboardList,
  BarChart3,
  GraduationCap,
  X,
  Building2,
  ChevronDown,
  Globe,
  Users,
  CheckCircle2,
  Calendar,
  LogOut,
  Target,
  Layers,
  PenLine,
  ClipboardCheck,
}                              from 'lucide-react';

import { useAuth }             from '../../src/context/AuthContext';
import axiosInstance           from '../../src/api/axiosInstance';
import type { StaffRole }      from '../../src/types/auth';
import type { Branch }         from '../../src/types/exam';


// ================================================================
//  MODULE-SCOPED BRANCH CONTEXT SYSTEM (unchanged logic)
// ================================================================

type BranchListener = (branch: Branch | null) => void;

let   _activeBranch : Branch | null       = null;
const _listeners    : Set<BranchListener> = new Set();

export function getActiveBranchContext(): Branch | null {
  return _activeBranch;
}

function setActiveBranchContext(branch: Branch | null): void {
  _activeBranch = branch;
  _listeners.forEach((fn) => fn(branch));
}

export function useBranchContext(): Branch | null {
  const [branch, setBranch] = useState<Branch | null>(_activeBranch);

  useEffect((): (() => void) => {
    _listeners.add(setBranch);
    return (): void => { _listeners.delete(setBranch); };
  }, []);

  return branch;
}


// ================================================================
//  NAV STRUCTURE
// ================================================================

interface NavItem    { label: string; path: string; icon: React.ReactNode }
interface NavSection { heading: string; roles: ReadonlyArray<StaffRole>; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'System Management',
    roles  : ['super_admin'],
    items  : [
      { label: 'Dashboard',               path: '/dashboard/superadmin',          icon: <LayoutDashboard size={18} /> },
      { label: 'Branch Campuses',         path: '/dashboard/superadmin/branches', icon: <GitBranch       size={18} /> },
      { label: 'Administrator Accounts',  path: '/dashboard/superadmin/admins',   icon: <ShieldCheck     size={18} /> },
      { label: 'Academic Period',         path: '/dashboard/superadmin/academic-period', icon: <Calendar size={18} /> },
      { label: 'School Settings',         path: '/dashboard/superadmin/school-settings', icon: <Building2 size={18} /> },
      { label: 'Institution Overview',    path: '/dashboard/superadmin/overview', icon: <BarChart3       size={18} /> },
    ],
  },
  {
    heading: 'Branch Administration',
    roles  : ['admin', 'super_admin'],
    items  : [
      { label: 'Admin Dashboard',         path: '/dashboard/admin',               icon: <LayoutDashboard size={18} /> },
      { label: 'Teacher Accounts',        path: '/dashboard/admin/teachers',      icon: <UserCheck       size={18} /> },
      { label: 'Classes & Departments',   path: '/dashboard/admin/classes',       icon: <BookOpen        size={18} /> },
      { label: 'Class Arms',              path: '/dashboard/admin/arms',          icon: <Layers          size={18} /> },
      { label: 'Data Completeness',       path: '/dashboard/admin/completeness', icon: <ClipboardCheck  size={18} /> },
    ],
  },
  {
    heading: 'Teaching Tools',
    roles  : ['teacher', 'admin', 'super_admin'],
    items  : [
      { label: 'Teacher Dashboard',       path: '/dashboard/teacher',             icon: <LayoutDashboard size={18} /> },
      { label: 'Student Enrolment',       path: '/dashboard/teacher/students',    icon: <GraduationCap   size={18} /> },
      { label: 'Exams & Questions',       path: '/dashboard/teacher/exams',       icon: <ClipboardList   size={18} /> },
      { label: 'Scoreboard & Reports',    path: '/dashboard/teacher/results',     icon: <BarChart3       size={18} /> },
      { label: 'Question Analytics',    path: '/dashboard/teacher/analytics',     icon: <Target       size={18} /> },
      { label: 'Enter Grades',          path: '/dashboard/teacher/grades',        icon: <PenLine      size={18} /> },

    ],
  },

];


// ================================================================
//  ROLE DISPLAY MAPS
// ================================================================

const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super Administrator',
  admin      : 'Branch Administrator',
  teacher    : 'Teacher',
} as const;

const ROLE_BADGE: Record<StaffRole, string> = {
  super_admin: 'bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]',
  admin      : 'bg-[#F1F5F9] text-[#3D5347] border border-[#D7F2E0]',
  teacher    : 'bg-[#E7FBEE] text-[#15803D] border border-[#86EFAC]',
} as const;


// ================================================================
//  BRANCH SWITCHER
// ================================================================

function BranchSwitcher(): React.JSX.Element {
  const [branches,  setBranches]  = useState<Branch[]>([]);
  const [isOpen,    setIsOpen]    = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const activeBranch = useBranchContext();
  const panelRef     = useRef<HTMLDivElement>(null);

  const loadBranches = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const res = await axiosInstance.get<{
        success : boolean;
        branches: Branch[];
      }>('/api/superadmin/branches');
      if (res.data.success) setBranches(res.data.branches);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect((): void => { void loadBranches(); }, [loadBranches]);

  useEffect((): (() => void) => {
    if (!isOpen) return (): void => undefined;
    const h = (e: MouseEvent): void => {
      if (panelRef.current !== null && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return (): void => document.removeEventListener('mousedown', h);
  }, [isOpen]);

  const handleSelect = (branch: Branch | null): void => {
    setActiveBranchContext(branch);
    setIsOpen(false);
  };

  return (
    <div ref={panelRef} className="px-4 py-3 border-b border-[#D7F2E0]">

      <p className="text-[#6B8479] text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Globe size={11} />
        Branch Context
      </p>

      <div className="relative">
        <button
          type      = "button"
          onClick   = {() => setIsOpen((p) => !p)}
          className = {[
            'w-full flex items-center justify-between gap-2 px-3 py-2.5',
            'rounded-xl text-left transition-all duration-100 border-2',
            isOpen
              ? 'bg-[#E7FBEE] border-[#4AE17A]'
              : 'bg-[#F4FBF6] border-[#D7F2E0] hover:border-[#22B85C]',
          ].join(' ')}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2
              size      = {14}
              className = {activeBranch !== null ? 'text-[#22B85C] flex-shrink-0' : 'text-[#6B8479] flex-shrink-0'}
            />
            <span className={[
              'text-sm font-semibold truncate',
              activeBranch !== null ? 'text-[#15803D]' : 'text-[#3D5347]',
            ].join(' ')}>
              {activeBranch !== null ? activeBranch.name : 'All Branches'}
            </span>
          </div>
          <ChevronDown
            size      = {14}
            className = {`text-[#6B8479] flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-[#D7F2E0] rounded-xl shadow-lg overflow-hidden">

            <button
              type      = "button"
              onClick   = {() => handleSelect(null)}
              className = {[
                'w-full flex items-center gap-2.5 px-4 py-3 text-sm',
                'transition-colors border-b border-[#F4FBF6]',
                activeBranch === null
                  ? 'bg-[#E7FBEE] text-[#15803D] font-semibold'
                  : 'text-[#3D5347] hover:bg-[#F4FBF6] font-medium',
              ].join(' ')}
            >
              <Globe size={15} className="flex-shrink-0" />
              <span className="flex-1 text-left">All Branches — Global View</span>
              {activeBranch === null && (
                <CheckCircle2 size={15} className="text-[#22B85C] flex-shrink-0" />
              )}
            </button>

            <div className="max-h-56 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center py-6 gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-[#D7F2E0] border-t-[#4AE17A] animate-spin" />
                  <span className="text-[#6B8479] text-sm">Loading…</span>
                </div>
              )}
              {loadError && !isLoading && (
                <div className="px-4 py-5 text-center">
                  <p className="text-[#991B1B] text-sm mb-2">Failed to load branches.</p>
                  <button
                    type      = "button"
                    onClick   = {() => void loadBranches()}
                    className = "text-[#15803D] text-sm font-semibold underline hover:text-[#22B85C]"
                  >
                    Retry
                  </button>
                </div>
              )}
              {!isLoading && !loadError && branches.length === 0 && (
                <p className="text-[#6B8479] text-sm px-4 py-5 text-center">
                  No branches configured yet.
                </p>
              )}
              {!isLoading && !loadError && branches.map((branch) => (
                <button
                  key       = {branch.id}
                  type      = "button"
                  onClick   = {() => handleSelect(branch)}
                  className = {[
                    'w-full flex items-center gap-2.5 px-4 py-3 text-sm',
                    'transition-colors border-b border-[#F4FBF6] last:border-0',
                    activeBranch?.id === branch.id
                      ? 'bg-[#E7FBEE] text-[#15803D] font-semibold'
                      : 'text-[#3D5347] hover:bg-[#F4FBF6] font-medium',
                  ].join(' ')}
                >
                  <Building2 size={14} className="flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{branch.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[#6B8479] text-xs">
                      {Number(branch.student_count).toLocaleString()} students
                    </span>
                    {activeBranch?.id === branch.id && (
                      <CheckCircle2 size={14} className="text-[#22B85C]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeBranch !== null && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#4AE17A] flex-shrink-0" />
          <p className="text-[#15803D] text-sm font-medium truncate flex-1">
            {activeBranch.name}
          </p>
          <button
            type      = "button"
            onClick   = {() => setActiveBranchContext(null)}
            className = "text-[#6B8479] hover:text-[#3D5347] transition-colors flex-shrink-0"
            title     = "Return to global view"
            aria-label= "Clear branch scope"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}


// ================================================================
//  MAIN SIDEBAR COMPONENT
// ================================================================

interface StaffSidebarProps {
  isOpen : boolean;
  onClose: () => void;
}

export function StaffSidebar({
  isOpen,
  onClose,
}: StaffSidebarProps): React.JSX.Element {
  const { staffUser, role, logout } = useAuth();

  const staffRole                  = role as StaffRole | null;

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
            <p className="text-[#0B1F14] text-base font-bold leading-tight">
              CBT System
            </p>
            <p className="text-[#6B8479] text-sm leading-tight">
              Examination Portal
            </p>
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

      {staffUser !== null && staffRole !== null && (
        <div className="px-5 py-4 border-b border-[#D7F2E0]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#4AE17A] flex items-center justify-center flex-shrink-0">
              <span className="text-[#0B1F14] text-base font-bold">
                {staffUser.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[#0B1F14] text-base font-bold truncate leading-tight">
                {staffUser.username}
              </p>
              <p className="text-[#6B8479] text-sm truncate mt-0.5">
                {staffUser.email}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${ROLE_BADGE[staffRole]}`}>
              <Users size={12} />
              {ROLE_LABELS[staffRole]}
            </span>
          </div>
        </div>
      )}

      {staffRole === 'super_admin' && <BranchSwitcher />}

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV_SECTIONS.map((section) => {
          if (staffRole === null) return null;

          const canSee =
            staffRole === 'super_admin' ||
            section.roles.includes(staffRole);

          if (!canSee) return null;

          return (
            <div key={section.heading}>
              <p className="px-3 mb-2 text-xs font-bold text-[#6B8479] uppercase tracking-widest">
                {section.heading}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to        = {item.path}
                      end       = {item.path.split('/').length <= 3}
                      className = {({ isActive }) => navLinkClass(isActive)}
                      onClick   = {onClose}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-[#D7F2E0]">
        <button
          type      = "button"
          onClick   = {() => logout()}
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
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:flex-shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

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

export default StaffSidebar;