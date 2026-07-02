/**
 * Next.js instrumentation hook (Phase 6B Steps 6 & 8, §15, §21.7).
 *
 * Runs once per server instance, before any request is served — the correct
 * place to register the in-process event-bus subscribers so they are listening
 * by the time a business action publishes its first domain event. Two
 * consumers of the same taxonomy register here: the Automation engine (Step 6)
 * and the outbound webhook dispatcher (Step 8). Guarded to the Node.js
 * runtime: both import Prisma and must not load in the Edge runtime (where
 * instrumentation also runs).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerAutomationSubscribers } = await import(
      "@/features/automation/subscribers"
    );
    registerAutomationSubscribers();

    const { registerWebhookSubscribers } = await import(
      "@/features/webhooks/subscribers"
    );
    registerWebhookSubscribers();
  }
}
