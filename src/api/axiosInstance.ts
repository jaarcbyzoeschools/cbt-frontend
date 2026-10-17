// ================================================================
//  CBT SYSTEM — AXIOS INSTANCE (UPDATED)
//  File    : src/api/axiosInstance.ts
//
//  Fix: Added a SKIP_LOGOUT_URLS whitelist to the 401 handler.
//
//  Problem: The 401 interceptor was treating every 401 response
//  as a session expiry and calling logout. But some endpoints
//  legitimately return 401 for business logic reasons:
//    — PUT /api/auth/staff/me   → "Current password is incorrect"
//    — POST /api/auth/staff/login → "Invalid credentials"
//    — POST /api/auth/student/login → "Invalid credentials"
//
//  These 401s must NOT trigger a logout — the user is either
//  not logged in yet (login page) or validating their existing
//  password (account settings page).
//
//  Solution: Before triggering logout, check if the request URL
//  matches any entry in SKIP_LOGOUT_URLS. If it does, skip the
//  logout and let the calling component handle the error via
//  its own catch block (which it already does correctly).
// ================================================================

import axios from 'axios';
import { storedSessionIsCandidate } from '../utils/participant';
import type {
    AxiosInstance,
    AxiosError,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from 'axios';

// ── CONSTANTS ───────────────────────────────────────────────────

// Empty string = "same server that served this page". In production
// Express serves the built frontend, so every terminal calls back to
// whichever machine it loaded the app from — no IP to edit per deploy.
// In development, vite.config.ts proxies /api and /uploads to the
// backend. Set VITE_API_URL in .env only if the API lives elsewhere.
const BASE_URL: string = import.meta.env.VITE_API_URL ?? '';

const TIMEOUT_MS = 15_000 as const;

const STAFF_TOKEN_KEY   = 'cbt_staff_token'   as const;
const STUDENT_TOKEN_KEY = 'cbt_student_token' as const;


// ── ENDPOINTS THAT SHOULD NEVER TRIGGER LOGOUT ON 401 ──────────
//
// These endpoints return 401 for legitimate business logic reasons
// that have nothing to do with the user's session being expired:
//
//   /api/auth/staff/login     — wrong credentials on login page
//   /api/auth/student/login   — wrong PIN on student login page
//   /api/auth/staff/me (PUT)  — wrong current password in settings
//
// Any endpoint added here will have its 401 silently passed
// through to the calling component's catch block instead of
// triggering a full session wipe and redirect.
//
// Rule for adding new entries: only add an endpoint if it
// intentionally returns 401 to signal "your input was wrong"
// rather than "your session is invalid."

const SKIP_LOGOUT_URLS: readonly string[] = [
    '/api/auth/staff/login',
    '/api/auth/student/login',
    '/api/auth/staff/me',      
] as const;

/**
 * Returns true if the given request URL is in the skip-logout
 * whitelist. Uses endsWith so query strings don't break matching.
 */
function shouldSkipLogout(url: string | undefined): boolean {
    if (url === undefined) return false;
    return SKIP_LOGOUT_URLS.some((skipUrl) => url.endsWith(skipUrl));
}


// ── BACKEND ERROR RESPONSE BODY ─────────────────────────────────

interface BackendErrorBody {
    success : false;
    message : string;
    field?  : string;
}


// ── CREATE INSTANCE ─────────────────────────────────────────────

const axiosInstance: AxiosInstance = axios.create({
    baseURL        : BASE_URL,
    timeout        : TIMEOUT_MS,
    headers        : { 'Content-Type': 'application/json' },
    withCredentials: true,
});


// ── REQUEST INTERCEPTOR (unchanged) ─────────────────────────────

axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
        const staffToken   = localStorage.getItem(STAFF_TOKEN_KEY);
        const studentToken = localStorage.getItem(STUDENT_TOKEN_KEY);
        const token        = staffToken ?? studentToken;

        if (token !== null) {
            (config.headers as Record<string, string>)['Authorization'] =
                `Bearer ${token}`;
        }

        return config;
    },
    (error: AxiosError): Promise<never> => {
        console.error('[axiosInstance] Request configuration error:', error.message);
        return Promise.reject(error);
    }
);


// ── RESPONSE INTERCEPTOR (updated 401 handler) ──────────────────

axiosInstance.interceptors.response.use(

    (response: AxiosResponse): AxiosResponse => response,

    (error: AxiosError<BackendErrorBody>): Promise<never> => {

        if (error.response) {
            const status = error.response.status;
            const url    = error.config?.url;

            switch (true) {

                case status === 401: {
                    // ── Check the whitelist FIRST ──────────────────
                    // If this URL is in SKIP_LOGOUT_URLS, the 401 is
                    // a business logic response (wrong password, wrong
                    // credentials) — not a session expiry. Let the
                    // calling component handle it in its catch block.
                    if (shouldSkipLogout(url)) {
                        break;
                    }

                    // ── Session expired or invalid token ───────────
                    // Only reaches here for endpoints NOT in the
                    // whitelist — meaning the token itself was rejected,
                    // which is a genuine session expiry.
                    const wasStudentSession =
                        localStorage.getItem(STUDENT_TOKEN_KEY) !== null;

                    const wasCandidateSession = storedSessionIsCandidate();

                    const keysToRemove = Object.keys(localStorage).filter(
                        (key) => key.startsWith('cbt_') || key.startsWith('exam_')
                    );
                    keysToRemove.forEach((key) => localStorage.removeItem(key));

                    const currentPath    = window.location.pathname;
                    const alreadyOnLogin = currentPath.includes('/login');

                    if (!alreadyOnLogin) {
                        const loginPath = wasStudentSession
                            ? (wasCandidateSession ? '/login/training' : '/login/student')
                            : '/login/staff';
                        window.location.href = loginPath;
                    }
                    break;
                }

                case status === 403: {
                    console.warn(
                        `[axiosInstance] 403 Forbidden on: ${url ?? 'unknown endpoint'}`
                    );
                    break;
                }

                case status === 404: {
                    console.warn(
                        `[axiosInstance] 404 Not Found on: ${url ?? 'unknown endpoint'}`
                    );
                    break;
                }

                case status === 409: {
                    // Handled by individual form components
                    break;
                }

                case status >= 500: {
                    const serverMessage =
                        error.response.data?.message ?? 'Unknown server error';
                    console.error(
                        `[axiosInstance] ${status} Server Error on ${url ?? 'unknown endpoint'}:`,
                        serverMessage
                    );
                    break;
                }

                default:
                    break;
            }

        } else if (error.code === 'ECONNABORTED') {
            console.error(
                `[axiosInstance] Request timeout after ${TIMEOUT_MS}ms. ` +
                'The CBT server may be under heavy load.'
            );

        } else if (error.request !== undefined && error.response === undefined) {
            console.error(
                '[axiosInstance] Network error — no response from server at',
                BASE_URL || window.location.origin,
                '\nVerify: CBT server is ON | LAN cable connected | Router powered'
            );

        } else {
            console.error('[axiosInstance] Unexpected Axios error:', error.message);
        }

        return Promise.reject(error);
    }
);


export default axiosInstance;