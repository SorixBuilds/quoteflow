/**
 * Minimal structured server logger (Phase 5, §36). Business server actions log
 * the real error here — as single-line JSON to stdout, the same shape
 * `lib/audit-log.ts` uses for auth events — before mapping it to a safe,
 * user-facing string. No raw Prisma error or stack ever reaches the client.
 *
 * Server-only. A real deployment routes stdout to its log aggregator; this is
 * deliberately dependency-free until that is funded.
 */

type LogContext = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", message: string, context?: LogContext) {
  try {
    const line = JSON.stringify({
      scope: "app",
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.info(line);
  } catch {
    // Logging must never throw into a request path.
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};
