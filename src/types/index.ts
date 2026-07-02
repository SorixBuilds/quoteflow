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

/**
 * The caller identity a session-free business core runs under (Phase 6B Step 8,
 * §21.6). Both front doors resolve one before calling the shared core: a server
 * action from the staff session (`actorId` = the signed-in user), a Public API
 * write handler from the authenticated key (`actorId` = the key's creator, for
 * Activity attribution). The core itself never reads a session or a key.
 */
export type ActorScope = {
  organizationId: string;
  /** The `User` id business side effects (Activity, notifications) attribute to. */
  actorId: string;
};
