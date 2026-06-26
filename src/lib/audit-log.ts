/**
 * Low-level authentication event logging (§15).
 *
 * This is intentionally separate from the business-facing `Activity` table:
 * those are domain events, these are security/audit signals (login attempts,
 * logout, password and role changes, deactivations). Phase 3 emits them as
 * structured single-line JSON to the server log — a real client deployment can
 * route stdout to its log aggregator without a schema change.
 *
 * Hard rule: this helper never receives, and must never log, password or hash
 * material (§15).
 */

export type AuthEvent =
  | "login.success"
  | "login.failure"
  | "login.rate_limited"
  | "logout"
  | "bootstrap.success"
  | "register.success"
  | "register.blocked"
  | "password.changed"
  | "teammate.created"
  | "user.deactivated"
  | "user.reactivated";

export type AuthEventDetails = {
  userId?: string;
  organizationId?: string;
  /** The email an attempt was made against — useful for failures. */
  email?: string;
  /** Best-effort client IP, when the call site has request headers. */
  ip?: string;
  /** Machine-readable reason, e.g. "invalid_credentials", "inactive". */
  reason?: string;
  /** The role involved, for role-change / teammate-creation events. */
  role?: string;
};

/**
 * Emit a structured auth event. Failures to log are swallowed — logging must
 * never break an authentication flow.
 */
export function logAuthEvent(event: AuthEvent, details: AuthEventDetails = {}) {
  try {
    const entry = {
      scope: "auth" as const,
      event,
      timestamp: new Date().toISOString(),
      ...details,
    };
    // Failures (and rate-limits) are warnings; everything else is informational.
    const isWarning =
      event === "login.failure" ||
      event === "login.rate_limited" ||
      event === "register.blocked";
    const line = JSON.stringify(entry);
    if (isWarning) {
      console.warn(line);
    } else {
      console.info(line);
    }
  } catch {
    // Never let audit logging throw into an auth flow.
  }
}
