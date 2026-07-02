import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook payload signing (§21.9) — HMAC-SHA256 with the per-webhook secret,
 * the same signing discipline the Phase 5 quote share-link token uses, applied
 * to an outbound surface. The signature covers `"<timestamp>.<body>"` so a
 * receiver can both verify authenticity and bound replay, and is carried as:
 *
 *     X-QuoteFlow-Signature: t=<unix-seconds>,v1=<hex-hmac>
 *
 * Pure functions (crypto only, no DB/fetch) so correctness is unit-testable.
 * `verifySignatureHeader` is what a receiving endpoint implements — exported
 * so the docs example and the tests are the same code path.
 */

export const SIGNATURE_HEADER = "X-QuoteFlow-Signature";

/** Default receiver-side replay tolerance, in seconds. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Hex HMAC-SHA256 of `"<timestamp>.<body>"` under `secret`. */
export function signWebhookBody(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** The full signature header value for one delivery attempt. */
export function buildSignatureHeader(
  secret: string,
  timestamp: number,
  body: string,
): string {
  return `t=${timestamp},v1=${signWebhookBody(secret, timestamp, body)}`;
}

/**
 * Receiver-side verification: parse the header, check the timestamp is within
 * tolerance, and constant-time-compare the recomputed HMAC. Returns false for
 * anything malformed — never throws on untrusted input.
 */
export function verifySignatureHeader(
  secret: string,
  header: string,
  body: string,
  options: { toleranceSeconds?: number; now?: number } = {},
): boolean {
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header);
  if (!match) return false;

  const timestamp = Number(match[1]);
  const presented = match[2];
  const nowSeconds = options.now ?? Math.floor(Date.now() / 1000);
  const tolerance = options.toleranceSeconds ?? SIGNATURE_TOLERANCE_SECONDS;
  if (Math.abs(nowSeconds - timestamp) > tolerance) return false;

  const expected = signWebhookBody(secret, timestamp, body);
  const expectedBuffer = Buffer.from(expected, "hex");
  const presentedBuffer = Buffer.from(presented, "hex");
  if (expectedBuffer.length !== presentedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, presentedBuffer);
}
