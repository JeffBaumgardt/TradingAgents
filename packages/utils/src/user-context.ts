/**
 * @file packages/utils/src/user-context.ts
 * Validation and sanitization for free-text investing context stored in session config.
 * Values are bound as JSONB parameters (never interpolated into SQL).
 */

export const MAX_USER_CONTEXT_LENGTH = 8192;

const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Return a validation error message, or null when input is acceptable. */
export function validateUserContext(value: string | undefined | null): string | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  if (value.includes("\0") || CONTROL_CHAR_PATTERN.test(value)) {
    return "userContext contains invalid characters";
  }
  if (value.length > MAX_USER_CONTEXT_LENGTH) {
    return `userContext must be at most ${MAX_USER_CONTEXT_LENGTH} characters`;
  }
  return null;
}

/** Trim, strip control chars, enforce max length; omit when empty. */
export function sanitizeUserContext(value: string | undefined | null): string | undefined {
  if (value == null) {
    return undefined;
  }
  const cleaned = value.replace(CONTROL_CHAR_PATTERN, "").trim();
  if (!cleaned) {
    return undefined;
  }
  return cleaned.slice(0, MAX_USER_CONTEXT_LENGTH);
}
