# OPOS-QA — Environment Setup & Release Gates
**Date:** 30 October 2026
**Status:** QA database provisioned; branch preview credentials configured; transactions locked. This is **not** an approved E2E run or production release.

## Environment boundary
- Production Supabase: `klricctsxiifuduxpmzd` — **do not modify, seed, or import data from here**.
- Isolated QA Supabase: `ukcamenuxhdznxaxpyis` — project **OPOS-QA**, `eu-west-2`, same Free organisation, Supabase quote **$0/month**.
- Synthetic OPOS QA organisation: `717262cb-68da-4e7b-a9fa-238dc6c5d16b`. Do not reuse production organisation IDs.
- QA has **zero Auth users**. Create a QA-only operator account through Supabase Auth admin (not direct SQL writes into `auth.users`), then associate a role-bound `profiles` row with the synthetic QA organisation.
- The redesign branch `design/opos-decision-first-ia` on Vercel has **branch-scoped preview** values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY` and `OP_QA_SUPABASE_PROJECT_REF` pointing to QA. These never target production.
- **`OP_ISOLATED_QA_BACKEND` is deliberately NOT set**, so the preview's safe-write gates remain disabled. Production must never receive the QA project URL or QA user accounts.
- Never copy production personal data, mail credentials, customer documents, bank information, Stripe live keys or client/partner identities to QA.

## Schema installation
- All **107** committed `supabase/migrations/*.sql` files were applied to QA in order, without copying production records.
- Production also had an **uncommitted/missing migration** `quote_provider_payment_requests`. Its three payment-related tables, three functions, read policies and function execute restrictions were replicated **to QA only** in migration `qa_quote_provider_payment_schema_parity`.
- Production's additional `purge_labeled_qa_cases_retry` was a data-cleanup migration and was **not** replayed. The committed `prospect_conversation_import` migration created two additional QA tables not currently present in production.
- QA verification after bridge: **77 public tables, 144 public functions, 121 public RLS policies, two storage buckets**, and **zero original business organisations/users**. Production snapshot: 75 public tables, 144 public functions, 117 public RLS policies. Difference is the two conversation-import tables and four associated policies; schema-level parity is **not exact**.
- No claim of environment parity should be made until grants, storage policies, worker schedules and auth/storage flows have also been verified.

## Narrow authenticated QA fixture entry
- The new route `/opos-next/opportunities/new` is the three-stage entry form for **fictional** companies, contacts and opportunities.
- It uses existing tenant-scoped repositories and `requireUserContext`, checks the operator role and records audit events. Company names always start `QA - `; client emails are automatically set to the **exact** `+client` Gmail alias.
- The dedicated `OP_QA_FIXTURE_WRITES_ENABLED=true` Preview branch flag enables POST **only to this route**. `proxy.ts` continues returning 423 for **all other** mutations while `OP_ISOLATED_QA_BACKEND` remains unset.
- The fixture form does not send emails, issue work orders, quote, collect payment, or bypass controlled OPOS lifecycle transition functions.
- `OP_QA_EMAIL_SENDING_ENABLED` remains unset, and the QA cron schedule remains off.
- This is only the first functional QA slice. Full Step 2 email/partner flow is **not yet enabled** and needs QA service credentials and delivery validation.
- Existing authenticated OPOS user should see a new CTA on the Opportunities register when the fixture switch is on.
- Even with fixture writes on, the user must never be directed to production tokens or production test-data records.

## QA test inbox / client and partner personas (30 Oct 2026)
- The verified QA Gmail inbox receives **three exact destinations**: the base address plus its `+client` and `+partner` aliases. Gmail delivers all three to the same inbox; no separate Gmail accounts or passwords are needed for email receipt.
- Vercel `OP_QA_TEST_INBOX` is an encrypted, **branch-scoped Preview** variable; do not print or commit its value.
- `lib/qa/email-guard.ts` enforces an exact recipient allowlist when `VERCEL_ENV=preview` and the isolated QA backend is explicitly write-enabled. Without those conditions it denies all Preview queued and sent email.
- The application checks recipients at `queueNotification`, the Resend delivery worker, and public website intake **before** creating database records. Non-allowed recipients must fail closed.
- The secure Step 2 URL in QA uses the Preview request origin, not a configured production site domain.
- The branch's `OP_ISOLATED_QA_BACKEND` and `OP_QA_EMAIL_SENDING_ENABLED` remain **unset**. The worker requires both independently: writes cannot inadvertently enable email sending. No QA email has been sent.
- Before turning on QA writes or worker: configure **QA-only Supabase service/secret API key**, verified Resend test delivery credentials, Preview-only `CRON_SECRET`, and test-link accessibility; run negative tests for unlisted recipient addresses. Never borrow production database credentials.
- Supabase QA hourly notification worker remains disabled until replay/idempotency evidence and safe delivery are confirmed.

## Outbound worker kill switch
- Migration replay created `cron.job` named `overflow-partner-notification-worker-hourly`.
- **Disabled:** `cron.alter_job(job_id := ..., active := false)` applied and verified in QA.
- Do not enable notification cron until test recipient allowlist, sender domain, delivery-worker QA secret, queue failure/retry recovery and proof of non-production sending are verified. No real recipients.
- Test addresses and any passwords must be configured via protected services; do not put secrets into code or chat.

## Next technical steps — release sequence
1. Build fresh Vercel preview with QA branch-scoped environment values. Confirm current branch build is READY and that write mode remains locked.
2. Create one QA-only admin/operator Auth identity via Supabase Auth UI and associate its profile with the synthetic QA organisation. Require separate test customer and partner identities/links.
3. Create fictional engineering company + partner fixtures **within QA**, never production. Confirm seeded data and storage objects are labelled.
4. Configure email with a strict QA recipient allowlist and safe test sender. Verify first invitation, actual reminder HTML CTA and fallback link (#114), worker retries/expiry and event evidence.
5. Enable `OP_ISOLATED_QA_BACKEND=true` for this preview branch only **after** sender/recipient safeguards pass and the QA URL/ref match.
6. Run E2E website enquiry → requirements → partner assessment → internal feasibility decision → Case 360 with screenshots (1440px and 390px), expected persisted states, notification and audit evidence.
7. Repeat with wrong recipient, expired link, duplicate click, failed worker, interrupted form, missing info, bad actor and cross-organisation isolation.
8. Extend to quotation, named acceptance, Stripe test-mode advance verification, project creation, work order acceptance, execution, QA, delivery, final settlement and closure.

## Required artifacts per test
Record QA-only case UUID, test role, expected state/action, actual state/action, database/audit snapshot (redacted), recipient rendering screenshot, mobile/desktop screenshot, worker/webhook logs, retries and bug ID.

## Exit rule
A passing CI build / static contract / HTTP 200 is **not** E2E acceptance. No production cutover or PR #113 merge while the real operator, customer and partner journeys remain unverified.

Track defects via [OPOS-QA master matrix #115](https://github.com/zeeshankhanminhas/Overflow-Partner/issues/115) and [Step 2 reminder CTA #114](https://github.com/zeeshankhanminhas/Overflow-Partner/issues/114).
