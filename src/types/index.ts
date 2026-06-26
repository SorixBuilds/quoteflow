/**
 * Shared, app-wide TypeScript types.
 *
 * Feature-specific types live alongside their feature in
 * `src/features/<feature>/`. Only genuinely cross-cutting types belong here.
 */

/** A standard result wrapper for server actions. */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
