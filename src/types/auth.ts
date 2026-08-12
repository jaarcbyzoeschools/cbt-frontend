// ================================================================
//  CBT SYSTEM — AUTHENTICATION & USER TYPE DEFINITIONS
//  File    : src/types/auth.ts
//  Purpose : Central type registry for all authentication
//            entities, user role hierarchies, decoded token
//            shapes, login payloads, API response envelopes,
//            and the AuthContext contract consumed by every
//            component that reads or mutates session state.
//
//  Rules enforced in this file:
//    — No 'any' types under any circumstances.
//    — Every optional field is explicitly marked with '?'.
//    — Type guards are co-located with the types they narrow.
// ================================================================


// ── ROLE HIERARCHY ───────────────────────────────────────────────
// Strict union covering every possible principal role.
// The 'student' literal is included so token discrimination
// logic has a single source-of-truth type rather than raw
// string comparisons scattered across the codebase.

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'teacher'
  | 'student';

// Staff-only subset. Used in RoleRoute, StaffRoute, and any
// guard that must reject student tokens at the component level.
export type StaffRole = Exclude<UserRole, 'student'>;

// Ordered role weight map — used when a component must determine
// whether one role has equal or higher authority than another
// (e.g., Super Admin editing any branch Admin's record).
export const ROLE_WEIGHT: Record<StaffRole, number> = {
  super_admin : 3,
  admin       : 2,
  teacher     : 1,
} as const;


// ── STAFF USER ───────────────────────────────────────────────────
// Mirrors the safe profile object returned by the backend in:
//   POST /api/auth/staff/login  → response.user
//   GET  /api/auth/staff/me     → response.user
//
// password_hash is never present — the API deliberately omits it
// from every response. Do not add it here.

export interface User {
  readonly id         : number;
  readonly username   : string;
  readonly email      : string;
  readonly role       : StaffRole;
  readonly branch_id  : number | null;   // null only for super_admin
  readonly created_at?: string;          // ISO 8601 — absent on /me
}


// ── STUDENT ──────────────────────────────────────────────────────
// Mirrors the profile object returned by:
//   POST /api/auth/student/login → response.student
//   GET  /api/auth/student/me   → response.student
//
// Human-readable join fields (class_name, branch_name, etc.) are
// pre-resolved by the backend JOIN query so the lobby screen can
// render identity metadata without a second API round-trip.

export interface Student {
  readonly id              : number;
  readonly full_name       : string;
  readonly class_id        : number;
  readonly class_name      : string;
  readonly department_id   : number;
  readonly department_name : string;
  readonly branch_id       : number;
  readonly branch_name     : string;
}


// ── DECODED JWT PAYLOAD SHAPES ───────────────────────────────────
// These shapes mirror what jwt.sign() embeds on the backend.
// They are NOT produced by frontend JWT decoding — they arrive
// as profile data from the /me endpoint and are stored in context.
// Two separate interfaces exist because staff and student tokens
// have structurally different payloads.

export interface DecodedStaffToken {
  readonly id        : number;
  readonly username  : string;
  readonly email     : string;
  readonly role      : StaffRole;
  readonly branch_id : number | null;
}

export interface DecodedStudentToken {
  readonly type          : 'student';   // Backend discriminator literal
  readonly student_id    : number;
  readonly full_name     : string;
  readonly class_id      : number;
  readonly department_id : number;
  readonly branch_id     : number;
}

// Union for contexts that need to handle either token type.
export type DecodedToken = DecodedStaffToken | DecodedStudentToken;

// ── Type guard: narrows DecodedToken to DecodedStudentToken ──────
// Usage:
//   if (isStudentToken(decoded)) {
//     console.log(decoded.student_id);   // ✅ TypeScript knows this exists
//   }
export function isStudentToken(
  token: DecodedToken
): token is DecodedStudentToken {
  return (token as DecodedStudentToken).type === 'student';
}

// ── Type guard: narrows DecodedToken to DecodedStaffToken ────────
export function isStaffToken(
  token: DecodedToken
): token is DecodedStaffToken {
  return (token as DecodedStudentToken).type !== 'student';
}


// ── LOGIN REQUEST PAYLOADS ───────────────────────────────────────
// Shapes sent as the request body to the auth endpoints.
// Used to type Axios POST call arguments at the call site.

export interface StaffLoginPayload {
  email    : string;
  password : string;
}

export interface StudentLoginPayload {
  login_pin: string;
}


// ── LOGIN API RESPONSE SHAPES ────────────────────────────────────
// Full response envelopes returned by the backend on successful
// authentication. These type the Axios response.data object.

export interface StaffLoginResponse {
  success : boolean;
  message : string;
  token   : string;
  user    : User;
}

export interface StudentLoginResponse {
  success : boolean;
  message : string;
  token   : string;
  student : Student;
}

// /me endpoint response shapes — lighter than login responses
// since the profile data is embedded in the token itself.
export interface StaffProfileExtended extends User {
  readonly branch_name: string | null;
  readonly is_active  : boolean;
}

// ── /me endpoint response shapes (UPDATED) ───────────────────────
export interface StaffMeResponse {
  success : boolean;
  message : string;
  user    : StaffProfileExtended;   
}

export interface StudentMeResponse {
  success : boolean;
  message : string;
  student : Student;
}


// ── AUTH CONTEXT STATE CONTRACT ──────────────────────────────────
// The complete interface for the value object exposed by
// AuthContext. Every field and method is explicitly typed so
// components calling useAuth() receive full IntelliSense and
// compile-time safety.

export interface AuthContextType {
  // ── Session state ─────────────────────────────────────────────
  // Exactly one of staffUser / student is non-null when
  // authenticated. Both are null during initial load and after
  // logout. They are never both non-null simultaneously.
  staffUser        : User    | null;
  student          : Student | null;

  // Raw JWT strings held in context for components that need to
  // manually attach a token (e.g., blob download links).
  staffToken       : string  | null;
  studentToken     : string  | null;

  // Derived convenience fields — computed from the above.
  role             : UserRole | null;
  isAuthenticated  : boolean;

  // TRUE only during the silent /me rehydration on first app load.
  // Components should render a full-screen loader while this is true
  // to prevent a flash of the login page before the session resolves.
  isLoadingSession : boolean;

  // ── Action methods ────────────────────────────────────────────
  // Called by StaffLoginPage after a successful POST /api/auth/staff/login.
  loginStaff   : (token: string, user: User) => void;

  // Called by StudentLoginPage after a successful POST /api/auth/student/login.
  loginStudent : (token: string, student: Student) => void;

  // Clears all context state and localStorage session keys.
  // redirectPath: optional override for where to navigate post-logout.
  // If omitted, logout redirects to the role-appropriate login portal.
  logout       : (redirectPath?: string) => void;
  updateUser: (partial: Partial<User>) => void;
}


// ── GENERIC API RESPONSE ENVELOPE ───────────────────────────────
// Every backend endpoint follows the { success, message, ...data }
// pattern. This generic interface types the Axios response.data
// for any endpoint that conforms to that envelope.
//
// Usage at a call site:
//   const res = await axiosInstance.get<ApiEnvelope<{ branches: Branch[] }>>(
//     '/api/superadmin/branches'
//   );
//   const branches = res.data.branches;   // ✅ typed as Branch[]

export interface ApiEnvelope<T extends object> {
  success : boolean;
  message : string;
  count?  : number;     // Present on list endpoints
  data?   : T;          // Present when the envelope wraps a named payload
}

// ── KNOWN ERROR RESPONSE SHAPE ───────────────────────────────────
// Typed shape of the error body returned by our Express backend.
// Used to safely extract structured error messages from AxiosError
// inside catch blocks without casting to unknown.

export interface ApiErrorResponse {
  success : boolean;
  message : string;
  field?  : string;         // Present on unique-constraint (23505) errors
}