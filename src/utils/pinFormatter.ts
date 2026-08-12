// ================================================================
//  CBT SYSTEM — PIN INPUT FORMATTER & VALIDATOR
//  File    : src/utils/pinFormatter.ts
//  Purpose : All formatting, sanitisation, and validation logic
//            for the 5-character alphanumeric student exam PIN.
//            Centralising this here ensures the StudentLoginPage
//            auto-submit trigger, the useExamSession submission
//            payload builder, and any future PIN display component
//            all share one consistent rule set.
//
//  PIN specification (mirrors backend schema.sql and
//  authController.ts studentLogin):
//    — Exactly 5 characters
//    — Uppercase letters A–Z and digits 0–9 only
//    — Case-insensitive on input (lowercase is auto-converted)
//    — No spaces, hyphens, or special characters
//
//  Usage in StudentLoginPage:
//    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//      const cleaned = sanitisePin(e.target.value);
//      setPinValue(cleaned);
//      if (isValidPin(cleaned)) {
//        void submitPin(cleaned);   // Auto-forward trigger
//      }
//    };
// ================================================================


// ── CONSTANTS ────────────────────────────────────────────────────

/** The exact required length of a valid exam PIN. */
export const PIN_LENGTH = 5 as const;

/**
 * Regex that matches a fully valid PIN: exactly 5 uppercase
 * alphanumeric characters. Used for final validation before
 * the auto-submit trigger fires and before the API call is made.
 *
 * Anchors (^ and $) ensure the entire string is tested, not
 * just a substring — '1A2B3C' would pass a non-anchored test.
 */
export const PIN_PATTERN: RegExp = /^[A-Z0-9]{5}$/;

/**
 * Regex matching any single character that is NOT a valid PIN
 * character. Used in sanitisePin to strip invalid input in one
 * replace() pass rather than filtering character by character.
 */
const INVALID_CHAR_PATTERN: RegExp = /[^A-Z0-9]/g;


// ── SANITISATION ─────────────────────────────────────────────────

/**
 * sanitisePin
 *
 * Converts raw keyboard input into a clean PIN candidate:
 *   1. Converts to uppercase (handles lowercase keyboard entry).
 *   2. Strips any character that is not A–Z or 0–9 (spaces,
 *      hyphens, accented characters, symbols, etc.).
 *   3. Truncates to PIN_LENGTH characters so the input field
 *      never displays more than 5 characters regardless of paste
 *      content length.
 *
 * This function is called on every keystroke in the PIN input
 * field so the displayed value is always a valid candidate string
 * with length 0–5 and only uppercase alphanumeric characters.
 *
 * @param raw - The raw string from the input event target value.
 * @returns   - Sanitised string, length 0 to PIN_LENGTH.
 */
export function sanitisePin(raw: string): string {
  return raw
    .toUpperCase()
    .replace(INVALID_CHAR_PATTERN, '')
    .slice(0, PIN_LENGTH);
}


// ── VALIDATION ────────────────────────────────────────────────────

/**
 * isValidPin
 *
 * Type-guard style predicate that returns true only when the
 * provided string is a fully valid, submittable PIN.
 * A valid PIN satisfies ALL of:
 *   — Exactly PIN_LENGTH (5) characters
 *   — Only uppercase A–Z and 0–9 characters
 *
 * After sanitisePin() is applied, a valid PIN is one where
 * sanitised.length === PIN_LENGTH. The full regex test is kept
 * here as an additional guard for call sites that may receive
 * a PIN from a source other than the sanitised input field
 * (e.g., from a URL parameter or a programmatic test).
 *
 * @param pin - The string to validate.
 * @returns   - True if the PIN is valid and ready to submit.
 */
export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}


// ── DISPLAY FORMATTING ────────────────────────────────────────────

/**
 * formatPinDisplay
 *
 * Formats a raw PIN string for display in result sheets, student
 * tables, and the scoreboard export. Returns the PIN as an
 * uppercase string padded to PIN_LENGTH with underscore placeholders
 * for missing characters — useful for rendering a partially entered
 * PIN in a character-box UI.
 *
 * Examples:
 *   formatPinDisplay('B7X9K')  → 'B7X9K'  (full pin — no change)
 *   formatPinDisplay('B7')     → 'B7___'  (partial — padded)
 *   formatPinDisplay('')       → '_____'  (empty — all placeholders)
 *   formatPinDisplay('b7x9k') → 'B7X9K'  (lowercase normalised)
 *
 * @param pin         - Raw PIN string (may be partial or empty).
 * @param placeholder - Character used to fill missing positions.
 *                      Defaults to '_'.
 * @returns           - A PIN_LENGTH string representation.
 */
export function formatPinDisplay(
  pin         : string,
  placeholder : string = '_',
): string {
  const sanitised = sanitisePin(pin);
  const padded    = sanitised.padEnd(PIN_LENGTH, placeholder);
  return padded;
}


// ── CHARACTER ARRAY DECOMPOSITION ────────────────────────────────

/**
 * pinToCharArray
 *
 * Splits a PIN string into an array of exactly PIN_LENGTH
 * character strings. Empty positions are filled with empty
 * strings. Used by PIN character-box renderers where each
 * character occupies its own styled box element.
 *
 * Examples:
 *   pinToCharArray('B7X9K') → ['B', '7', 'X', '9', 'K']
 *   pinToCharArray('B7')    → ['B', '7', '',  '',  '' ]
 *   pinToCharArray('')      → ['',  '',  '',  '',  '' ]
 *
 * @param pin - Raw or sanitised PIN string.
 * @returns   - Array of exactly PIN_LENGTH single-char strings.
 */
export function pinToCharArray(pin: string): string[] {
  const sanitised = sanitisePin(pin);
  const chars: string[] = sanitised.split('');

  // Pad with empty strings to guarantee exactly PIN_LENGTH elements.
  while (chars.length < PIN_LENGTH) {
    chars.push('');
  }

  return chars;
}


// ── MASKING ──────────────────────────────────────────────────────

/**
 * maskPin

 *   maskPin('A1')    → 'A1___'   (partial PIN — not maskable)
 *
 * @param pin - A complete or partial PIN string.
 * @returns   - Masked display string of length PIN_LENGTH.
 */
export function maskPin(pin: string): string {
  const sanitised = sanitisePin(pin);

  if (sanitised.length < PIN_LENGTH) {
    // Cannot meaningfully mask a partial PIN — return padded.
    return formatPinDisplay(sanitised);
  }

  const visible = sanitised.slice(0, 2);
  const masked  = '*'.repeat(PIN_LENGTH - 2);
  return visible + masked;
}