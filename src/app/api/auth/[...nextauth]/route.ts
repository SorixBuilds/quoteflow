import { handlers } from "@/lib/auth";

/**
 * Auth.js HTTP handler (§23). Exposes the GET/POST endpoints Auth.js manages
 * internally (session, CSRF, callback). This is the only API route handler that
 * performs authentication work — all other auth logic lives in Server Actions
 * (§21 rule 1).
 */
export const { GET, POST } = handlers;
