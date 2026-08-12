// ================================================================
//  CBT SYSTEM — UNIFIED ASYNC API WRAPPER HOOK
//  File    : src/hooks/useApi.ts
//  Purpose : Eliminates repetitive try/catch/loading/error state
//            boilerplate from every component that makes an API
//            call. Provides a single, consistently typed pattern
//            for all data-fetching and mutation operations.
//
//  Design goals:
//    1. Generic type parameter T represents the resolved data type
//       so every call site gets fully typed response data without
//       casting.
//    2. Structured error extraction — reads the backend's
//       ApiErrorResponse envelope first, falls back to the Axios
//       network error message, and finally to a generic offline
//       fallback string. No component ever sees a raw Error object.
//    3. The execute() function is stable across re-renders
//       (useCallback) so it is safe to pass as a prop or include
//       in dependency arrays.
//    4. Supports both immediate execution (data-fetching on mount)
//       and deferred execution (form submissions on user action)
//       through the same interface.
//    5. Exposes a reset() function so a component can clear error
//       and data state before retrying an operation.
//
//  Usage patterns:
//
//    Pattern A — Deferred (form submit, button click):
//      const { data, loading, error, execute } = useApi<Branch>();
//      const handleSubmit = async () => {
//        await execute(() =>
//          axiosInstance.post('/api/superadmin/branches', { name })
//        );
//      };
//
//    Pattern B — Immediate (fetch on mount via useEffect):
//      const { data, loading, error, execute } = useApi<Branch[]>();
//      useEffect(() => { void execute(() =>
//        axiosInstance.get('/api/superadmin/branches')
//      )}, [execute]);
//
//    Pattern C — With success callback:
//      await execute(
//        () => axiosInstance.post('/api/admin/teachers', payload),
//        (result) => { navigate('/dashboard/admin/teachers'); }
//      );
// ================================================================

import { useCallback, useState } from 'react';
import  { AxiosError  } from 'axios';
import type {AxiosResponse} from 'axios'
import type { ApiErrorResponse,  } from '../types/auth';


// ── STATE SHAPE ──────────────────────────────────────────────────

/**
 * The internal state managed by useApi for a single API operation.
 * Exported so components can reference the type when lifting state.
 */
export interface UseApiState<T> {
  /** The resolved data from the last successful execute() call. */
  data    : T | null;
  /** True while the async operation is in-flight. */
  loading : boolean;
  /** Human-readable error message from the last failed execute(). */
  error   : string | null;
  /** True after at least one successful execute() call. */
  success : boolean;
}


// ── RETURN TYPE ──────────────────────────────────────────────────

/**
 * Full return shape of the useApi hook.
 */
export interface UseApiReturn<T> extends UseApiState<T> {
  /**
   * Executes the provided async API call.
   *
   * @param apiCall       - A zero-argument function that returns a
   *                        Promise<AxiosResponse<TEnvelope>>. The
   *                        generic TEnvelope allows the caller to
   *                        type the full response envelope while T
   *                        types only the extracted data field.
   * @param onSuccess     - Optional callback fired with the full
   *                        response data on success. Use this for
   *                        post-mutation side effects (navigation,
   *                        toast display, parent state refresh).
   * @returns             - The extracted data of type T on success,
   *                        or null if the call failed. The caller
   *                        can await execute() and branch on null.
   */
  execute: <TEnvelope extends object>(
    apiCall   : () => Promise<AxiosResponse<TEnvelope>>,
    onSuccess?: (data: TEnvelope) => void,
  ) => Promise<T | null>;

  /**
   * Resets data, error, loading, and success to their initial
   * values. Call before retrying an operation to clear stale state.
   */
  reset: () => void;
}


// ── ERROR EXTRACTION HELPER ──────────────────────────────────────

/**
 * Extracts the most specific available error message from an
 * unknown thrown value. Priority order:
 *   1. Structured backend ApiErrorResponse body message.
 *   2. Axios network / timeout error message.
 *   3. Generic offline-specific fallback string.
 *
 * The return type is always string — no component ever receives
 * an Error object or undefined as an error value.
 */
function extractErrorMessage(thrown: unknown): string {
  // Check if this is an AxiosError with a typed response body.
  if (thrown instanceof AxiosError) {
    const axiosError = thrown as AxiosError<ApiErrorResponse>;

    // Priority 1: structured backend error envelope.
    if (
      axiosError.response !== undefined &&
      axiosError.response.data !== undefined &&
      typeof axiosError.response.data.message === 'string' &&
      axiosError.response.data.message.length > 0
    ) {
      return axiosError.response.data.message;
    }

    // Priority 2: network timeout.
    if (axiosError.code === 'ECONNABORTED') {
      return (
        'The request timed out. The server may be under heavy load. ' +
        'Please wait a moment and try again.'
      );
    }

    // Priority 3: no response at all (server unreachable on LAN).
    if (axiosError.request !== undefined && axiosError.response === undefined) {
      return (
        'Cannot reach the server. Please check that the CBT server ' +
        'machine is powered on and connected to the network.'
      );
    }

    // Priority 4: Axios message string (e.g., 'Request failed with status 500').
    if (typeof axiosError.message === 'string' && axiosError.message.length > 0) {
      return axiosError.message;
    }
  }

  // Fallback for non-Axios errors (should not occur in normal flow).
  if (thrown instanceof Error && thrown.message.length > 0) {
    return thrown.message;
  }

  return 'An unexpected error occurred. Please try again.';
}


// ── INITIAL STATE CONSTANT ───────────────────────────────────────



// ── HOOK ─────────────────────────────────────────────────────────

/**
 * useApi<T>
 *
 * Generic hook that wraps any Axios call with consistent
 * loading / error / success state management.
 *
 * @template T - The type of the data value that execute() resolves
 *               to on success. This is the data field extracted from
 *               the response envelope, not the full envelope type.
 *               In most cases T === the full TEnvelope because our
 *               backend returns data directly in response.data.
 */
export function useApi<T>(): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data   : null,
    loading: false,
    error  : null,
    success: false,
  });


  // ── execute ────────────────────────────────────────────────────
  // useCallback with empty deps ensures the function reference is
  // stable. Components that call useEffect(() => { execute(...) },
  // [execute]) will not trigger an infinite loop.

  const execute = useCallback(
    async <TEnvelope extends object>(
      apiCall   : () => Promise<AxiosResponse<TEnvelope>>,
      onSuccess?: (data: TEnvelope) => void,
    ): Promise<T | null> => {

      // Clear previous error and set loading.
      setState({
        data   : null,
        loading: true,
        error  : null,
        success: false,
      });

      try {
        const response = await apiCall();
        const responseData = response.data;

        // Update state with the resolved data.
        // We cast response.data to T here because the caller has
        // provided TEnvelope as the full response type and T as the
        // expected data type. In our API pattern they are the same
        // object — the entire response.data IS the typed payload.
        setState({
          data   : responseData as unknown as T,
          loading: false,
          error  : null,
          success: true,
        });

        // Fire the optional success callback with the full envelope.
        if (onSuccess !== undefined) {
          onSuccess(responseData);
        }

        return responseData as unknown as T;

      } catch (thrown: unknown) {
        const errorMessage = extractErrorMessage(thrown);

        setState({
          data   : null,
          loading: false,
          error  : errorMessage,
          success: false,
        });

        return null;
      }
    },
    [] // No dependencies — execute is a stable function reference
  );


  // ── reset ──────────────────────────────────────────────────────
  const reset = useCallback((): void => {
    setState({
      data   : null,
      loading: false,
      error  : null,
      success: false,
    });
  }, []);


  return {
    data   : state.data,
    loading: state.loading,
    error  : state.error,
    success: state.success,
    execute,
    reset,
  };
}

export default useApi;