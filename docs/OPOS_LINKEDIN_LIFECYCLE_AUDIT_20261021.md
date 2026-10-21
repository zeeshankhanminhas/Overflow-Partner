# OPOS Lifecycle + LinkedIn Funnel — Audit Pass 1 (21 Oct 2026)

Status: **audit in progress; do not merge PR #104 yet**. Read-only inspection of PR #104 `feat/linkedin-acquisition-funnel`, `main`, live OPOS Supabase schema/data aggregates, GitHub Actions, and Vercel environment metadata. **No customer messages sent, test records created, migrations applied, or production changes made.**

## Agreed business contract (from operator walkthrough)

**LinkedIn:** manually add Company/Contact/Prospect; first outreach stays on LinkedIn; no automatic email on cold capture; only send Step 2 secure requirements link after a recorded interested conversation.  
**Website:** acknowledge inbound enquiry; nurture with at most five reminders, stopping on opt-out or non-engagement according to agreed policy; send Step 2 after affirmative customer interest (rather than immediately from basic website form).  
**Convergence:** when Step 2 is submitted, send the same customer receipt/under-review acknowledgement for both sources, automatically forward the scoped technical pack to the approved Execution Partner for feasibility, and keep all states/owner/action visible. The partner asks for clarification through OPOS rather than exposing customer contact details.  
**Commercial:** fixed default 33% margin with override; controlled non-editable quote PDF with secure persistent client portal; initial payment normally 30%, final balance before editable handover; project only after verified payment; automatically issue partner work order with approved scope annexure; partner accepts/clarifies/declines; milestone progress; partner-led senior-engineer QC; OPOS manual release for client review; one consolidated in-scope correction round and seven working days review; revisions and scope changes separated; verified balance + manual final release; partner paid after received client final payment and final release, manually recorded; manual closure.

These are target rules; this audit does **not** claim that all are implemented.

## Evidence verified

- PR [#104](https://github.com/zeeshankhanminhas/Overflow-Partner/pull/104) is open, mergeable, based on `main`, 13 changed files at initial review. The latest inspected commit is `27725ad`.
- GitHub Actions Quality Gate run `39475404203` succeeded, including lint, typecheck, existing lifecycle regression, LinkedIn unit/contract checks and Next production build. Vercel preview deployment for that commit is READY. These are **not** authenticated, state-changing end-to-end tests.
- `lib/acquisition/linkedinFunnel.ts` enforces `source != linkedin || (outreach_status === replied && response_outcome === interested)`. `app/workspace/acquisition/actions.ts` checks it server-side before the normal operator creates Step 2; a cold LinkedIn prospect created by that operator action no longer queues the generic enquiry email. The new funnel view is organisation-scoped. Good foundational separation.
- Live OPOS DB `klricctsxiifuduxpmzd` is ACTIVE_HEALTHY. `prospects.source` enum includes `linkedin, website, email, referral, phone, manual`; required outreach fields, intake session and notification outbox tables exist.
- **Duplicate evidence:** live DB aggregate has **2 prospect records but only 1 unique (company_id, contact_id) pair**. Both are `identified` and neither is LinkedIn-sourced. Do not modify them until a reconciliation and dedupe rule are agreed.
- Preview and Production are targeted by the **same `NEXT_PUBLIC_SUPABASE_URL` Vercel environment entry**. A Preview URL must not be treated as an isolated QA database. No live writing or customer notification test was attempted.

## Gaps / merge risks

| Priority | Finding | Evidence | Expected |
| --- | --- | --- | --- |
| P0 | Step 2 completion has **no customer confirmation** and **no automatic partner review referral** in the route inspected. | `app/api/intake/[token]/route.ts` POST stores submission, cancels reminders, queues only `OWNER_NOTIFICATION_EMAIL` with `system_failure` template. Intake tables inspected have no direct submission triggers. | Transactional receipt to customer for both origins, governed partner-assessment request with status/outbox, retries and exception on failure. |
| P0 | Website bypasses the agreed nurture/interest gate, immediately invokes Step 2 invitation. | `app/api/intake/route.ts` invokes `send-step-2-invitation` on initial form submit. | Website acknowledgement + capped opt-out-safe nurture, Step 2 only on affirmative interest. |
| P0 | **No isolated authenticated QA environment** for safe business-path E2E; passing CI does not prove portal, email, DB and state handoff. | Vercel env metadata and PR #104 review/QA criteria. | Isolated database + non-production sender and Stripe test environment; then run full two-route test. |
| P1 | A separate internal Edge Function that sends Step 2 does not itself inspect LinkedIn interest state. | `supabase/functions/send-step-2-invitation/index.ts` selects prospect ID/organisation/status only. | Centralize the source-specific invitation policy at all server entry points. |
| P1 | Automated acknowledgement on prospect creation is blocked only for `source=linkedin`; manually captured cold prospects under other sources may still be emailed. | `app/workspace/acquisition/actions.ts` `parsed.data.email && parsed.data.source !== 'linkedin'`. | Source + affirmative inbound request/permission should determine transactional eligibility; suppress unsolicited outreach across manual sources. |
| P1 | Two records point to one client/contact, risking separate pending states and duplicate actions. | Read-only live aggregate and website API insert behavior. | One canonical opportunity/enquiry identity, duplicate-safe intake, provenance for multiple inbound events. |
| P1 | Quote payment screen uses full `quotes.total` as prominent amount despite reading `quote_release_contracts.opening_amount`. | `app/quote-payment/page.tsx`. | Display and charge only contracted opening amount (typically 30%) with correctly reconciled final balance. Audit actual checkout action separately. |
| P2 | LinkedIn outreach recording is inside the record's **Messages drawer** while the primary next-action card says to use Communications. | `RecordWorkspace` drawer and `app/workspace/acquisition/[id]/page.tsx`. | Surface the one actionable outreach control directly on a pre-enquiry LinkedIn record; keep audit/history secondary. |
| P2 | CSS architecture still imports broad workspace layers plus scoped/inline styles, with inconsistent page design patterns. | `app/workspace/layout.tsx`, `app/workspace/acquisition-layout.css`, multiple inline-style portal pages. | Audit selector conflicts, tokens, text/button scales and mobile navigation before consolidation; do not blindly delete CSS. |

## Audit acceptance matrix

- Cold LinkedIn prospect capture → no unsolicited email/outbox record.
- Reply marked interested → exactly one secure Step 2 invitation, both the visible UI and all server sending routes enforce consent/interest, no duplicate session.
- Website inbound enquiry → immediate thank-you, not premature Step 2; no more than five lawful nurture messages, unsubscribe and stop on interest/closed state.
- Step 2 submission (both sources) → exactly one receipt to client, exactly one authorized partner technical assessment referral, deduped notifications, explicit `awaiting_partner` state; delivery failures visible with retry.
- Partner clarification → OPOS owns client interaction; pending client / client answered / partner resumed states; no leak of client direct contacts.
- Partner assessment → approved milestones, partner cost, OPOS internal Go/No-Go → Case 360 and 33% default margin.
- Controlled quote PDF + client portal + 14-day quote validity, accepted signatory, 30% contractually due, payment verified before Project creation, idempotent webhook, no orphan project.
- Work order auto-issued with approved scope annexure; partner acceptance/clarification/decline gates; milestones; partner QC evidence; manual OPOS client-review release.
- One consolidated correction round vs separately priced revision/variation; seven working-day window; payment balance, manual final release, partner paid only after customer final settlement, manual closure.
- Desktop/mobile navigation: current state, owner, next action and blockers always visible; no forced navigation for ordinary step actions; document identifiers and audit evidence hidden behind progressive disclosure.
- CSS: inventory imported stylesheets and selectors, check specificity and style overrides, unify spacing, typography, buttons, status and responsive grids; compare screenshot and accessibility results.

## Release decision

**HOLD PR #104.** Its LinkedIn pre-enquiry logic and CI look promising, but agreed Step 2 convergence, website route, duplicate handling and isolated portal testing remain unresolved. Do not interpret a green CI/build as full business-lifecycle acceptance. Protect production and existing records; first implement and test the missing business gates in an isolated environment, then reassess the merge.