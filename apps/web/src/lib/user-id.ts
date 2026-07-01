/**
 * @file apps/web/src/lib/user-id.ts
 * Deprecated: user identity is derived from verified Clerk JWTs on the API.
 * Kept as a re-export for any remaining imports during migration.
 */

export { buildAuthHeaders, getCurrentUserId, requireCurrentUserId } from "@/lib/auth-user-store";
