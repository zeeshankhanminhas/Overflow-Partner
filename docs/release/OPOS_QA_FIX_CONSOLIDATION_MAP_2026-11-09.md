# OPOS QA-to-production fix consolidation map
**9 November 2026 · Release candidate must be based on current `main`.**

This is an engineering integration inventory, **not** a list of files approved to cherry-pick automatically. The closed Northfield QA commit `ba70d2124118326d80cd0a7e88b790c2309bc32e` is the reproducible source reference.

## A — Reusable platform behaviour to port after review

| Area | Candidate source | Production implementation outcome |
| --- | --- | --- |
| Common next-action model | `lib/presentation/canonicalProjectDecision.ts`, `lib/presentation/threePortalNextAction.ts`, `app/opos-next/projects/[id]/page.tsx` | One state-machine projection: each operator, customer and partner sees exactly one valid governed next action |
| Authenticated customer/partner workspaces | `lib/portals/account.ts`, `app/portal/[kind]/...` | Membership-derived project entitlement, no impersonation, proper audit events, fail-closed links |
| Protected review and delivery | `app/portal/client/projects/[projectId]/review/`, `lib/portals/clientFinalRelease.ts`, `app/client-final-files/page.tsx` | Exact accepted submission and authorised release; signed private-storage URLs, route-level negative tests, native CAD coverage |
| Customer payment recovery | `app/api/stripe/webhook/route.ts`, `app/quote-payment/`, `app/project-final-payment/`, `lib/payments/stripeEnvironment.ts` | Signed webhook, replay-safe event ledger, distinct test/live keys, reconciliation after redirects, invoice coverage without duplicate charges |
| Release and notifications | `app/workspace/projects/[id]/final-release-action.ts`, `lib/notifications/queue.ts`, `lib/notifications/emailProvider.ts` | Transactional release decision; independent outbox dispatch and delivery status; retry and allowlist tests |
| Work Order and partner liability | `lib/execution/paymentWorkOrderHandoff.ts`, `app/opos-next/projects/[id]/work-order/` | Selected partner quotation → accepted Work Order → accepted submission → approved supplier invoice → evidenced bank transfer |
| Document governance | `components/workspace/documents/`, document-control functions and properly reviewed migrations | Current revision, signed/approved/issued status and storage evidence enforced by reusable database + UI constraints |
| QA tests | `scripts/qa/`, `supabase/tests/`, `.github/workflows/` | Fresh isolated database plus a two-project, three-role browser flow, rejected-payment and premature-release negatives |

## B — Keep strictly in QA; do not deploy as production functions

- `lib/qa/northfieldPartnerSettlement.ts`, `lib/qa/northfieldCloseoutEvidence.ts`.
- `app/opos-next/projects/[id]/partner-settlement/`, `closeout-evidence/`, and scenario-specific handover preparation.
- `scripts/qa/sql/20261109_northfield_partner_simulation_guard.sql` and `20261109_northfield_closeout_reconciliation.sql`.
- Any `QA-SIM-*` references, synthetic-cleared bank methods or test evidence presented as genuine funds.
- Fixed fictional Northfield IDs, quotes, invoices, partner amounts, test recipient aliases and one-project database trigger exceptions.
- Preview-only service-role, test Stripe, protected deployment, restricted email allowlist and synthetic fixture flags.

The resulting production payout mechanism must **never** mark a bank transfer cleared from an internally generated simulation identifier.

## C — Rebuild generically; do not port the current QA shortcut

1. **Opening invoice**: issue a real contractual deposit invoice at the original acceptance/payment stage. Preserve invoice number, VAT treatment, Stripe or bank reference and paid-at reconciliation. A retroactive case-specific paid invoice is QA test evidence only.
2. **Partner payable**: require an actual partner invoice, verified bank destination and maker-checker authorisation before external bank payment. Preserve selected Work Order cost and any approved variation.
3. **Controlled closeout documents**: generate completion and final handover packages from current project documents, not hand-authored scenario-specific PDFs. Retain native CAD manifest, revision evidence, IP deliverable terms and genuine delivery log.
4. **Email and portal**: treat final approval, notification queued/sent/delivered, client viewed and client downloaded as separate states. Allow portal self-service when email fails, but do not claim notification delivery.
5. **Project closure**: use an audited, idempotent closeout transition with verified 100% client settlement, current released package, settled partner liability and issued completion evidence. Test rerun and post-closure immutability.

## D — Integrate without losing the current public marketing site

The latest `main` contains seven commits not in the frozen QA branch, affecting site pages, SEO, enquiries and the deliberate retraction of unverified engineering demonstrations. Preserve all of these. Do not copy draft CAD assets or overstate drawing verification.

## E — Integration checks

- Main-based branch diff is reviewed by domain, **not** wholesale compared as one 743-commit PR.
- No QA-only project IDs, QA test amounts, synthetic payment methods, sandbox Stripe keys, fake client emails or QA-only SQL enabled on production.
- Dedicated lint/typecheck + SQL migrations/pgTAP + signed webhook/idempotency + multi-role authenticated browser tests.
- Server-authoritative final release and no download before payment + approved QA + owner decision.
- Resend/email allowlist tests with an approved inbox, traceable outbox events and no unintended send.
- Live config and bank payment remain disabled until final production release approval.
- Compare fresh database schema to approved migrations; maintain rollback and a separate evidence archive.
