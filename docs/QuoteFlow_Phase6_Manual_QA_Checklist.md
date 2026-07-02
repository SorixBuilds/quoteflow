# QuoteFlow — Phase 6 Manual QA Checklist (Pre-Release Runbook)

**Phase 6B Step 12 · v1.0 release candidate**

The browser-driven, three-plane end-to-end verification from §25/§29 Step 15, written as a manual runbook. Automated Playwright coverage of this flow is the named next automation increment (see the Definition-of-Done doc); until then this checklist is the pre-release gate. Run it against a fresh deployment with a seeded-empty database.

Prerequisites: a deployed build with `DATABASE_URL` and `AUTH_SECRET` set; every provider on its zero-cost default (`EMAIL_PROVIDER=console`, `STORAGE_PROVIDER=url`, `AI_PROVIDER=null`, `RATE_LIMITER=db`).

---

## Plane 1 — Staff session (the core Phase 5 pipeline, unchanged)

1. [ ] Register the first user (bootstrap) → lands on an empty dashboard; the new **insight widgets** render below the classic KPIs with empty states.
2. [ ] Create a Lead → Create a Quote from it → Send → Accept → confirm a Job is auto-created and the Lead flips to WON.
3. [ ] On the Job, record a Payment against its Invoice → the Invoice status advances (UNPAID → PARTIAL/PAID).
4. [ ] Reports: as OWNER, confirm all ten tabs render; as STAFF, confirm the four financial tabs (Revenue & AR, Aging, Profitability, Tax) are **absent** and hitting `?tab=aging` directly is rejected.
5. [ ] Health: `GET /api/health` returns `200 {"status":"healthy"}`.

## Plane 2 — Customer Portal (§12)

6. [ ] On the Customer, staff **issues a Portal link** → the link is shown once.
7. [ ] Open the link in a logged-out browser → the portal loads WITHOUT any staff login; a staff session cookie grants no additional access.
8. [ ] In the portal: view the Invoice and its paid status; view the Quote and **Accept/Decline** it → the decision reflects back in the internal Quote record.
9. [ ] Update contact info in the portal → the change appears on the internal Customer record.
10. [ ] Confirm the portal URL cannot reach any `/(dashboard)` route (redirect/blocked), and an internal route cannot be reached with only the portal cookie.

## Plane 3 — Public API (§21)

11. [ ] Settings → API Keys: create a key granting `leads:read`, `leads:write`, `customers:read` → copy the one-time key.
12. [ ] `GET /api/v1/leads` with `Authorization: Bearer <key>` → `200` with the `{ data, pagination }` envelope.
13. [ ] `POST /api/v1/leads` with a valid body → `201`; the new Lead appears in the internal app **identically** to a UI-entered one (Activity logged, same shape).
14. [ ] `GET /api/v1/quotes` with the same key → `403 insufficient_scope` (no `quotes:read` granted).
15. [ ] Any request with no/invalid/revoked key → `401`; malformed body → `422`; exceed the rate window → `429` with `Retry-After`.
16. [ ] Rotate the key → the old key immediately `401`s; revoke → same.

## Automation (§15) + Webhooks (§21)

17. [ ] Settings → Automations: create a rule "Quote accepted, total ≥ $5,000 → notify Owner."
18. [ ] Accept a matching Quote → the Owner receives the notification and an `AutomationLog` row records SUCCESS.
19. [ ] Settings → Integrations: create a Webhook subscribed to `quote.accepted` with an https URL → the signing secret is shown once.
20. [ ] Accept a Quote → a `WebhookDelivery` is created and dispatched with an HMAC signature header; an unreachable endpoint retries with backoff and caps.

## AI (§16) — flag-gated, off by default

21. [ ] With the `ai` flag OFF (default): the Quote Builder notes field and Job notes show **no** AI affordance; every workflow behaves exactly as an AI-free build.
22. [ ] (Only when a real provider is funded) Flip `ai` on → the "Suggest with AI" control appears; a suggestion is proposed with Accept/Discard and is never auto-applied; an `AiUsageLog` row records the call.

## Security headers (§22)

23. [ ] Response headers include `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin`, and (over https/prod) `Strict-Transport-Security`; `X-Powered-By` is absent.

---

**Sign-off:** all boxes ticked ⇒ the three authentication planes, the automation/webhook orchestration, the flag-gated AI layer, and the security posture are confirmed working end-to-end for the v1.0 release candidate.
