# OPOS integrated production hardening and unified experience

Status: implementation foundation; production **NO-GO**. This document is an
execution contract, not evidence that the programme or new interfaces are complete.

## Reconciled baseline

Verified 9 November 2026 against GitHub, Vercel, read-only production and QA SQL,
security advisors and the current Library production/UI audits.

| Boundary | Verified state |
|---|---|
| Production source | `main` at `d46010f1fd3e986d47d55fe301f15f58fa6ca279` |
| Production deployment | READY `dpl_GoB87J1vs3iiwW5WiG7EEDTYzBzX`, same SHA |
| Frozen QA | `ba70d2124118326d80cd0a7e88b790c2309bc32e` on `freeze/northfield-e2e-2026-11-09` |
| Divergence | QA 743 commits ahead / 7 behind main; 247 changed files |
| Release branch | `release/opos-production-hardening-2026-11-09`, main ancestor; initially three documentation files only |
| PR #123 | Open, draft, unmerged; head at inspection `5808986a022060febfb5755f2acd6cf6cdb0fa96` |
| Implementation/test DB | **OPOS-QA**, `ukcamenuxhdznxaxpyis`, as explicitly confirmed by owner |
| Production DB | `klricctsxiifuduxpmzd`; read-only comparison only |
| Northfield | QA `OP-PRJ-2026-0002`: stage and status both `closed`; preserve unchanged |
| Migration histories | Production 108; QA 142; local main migration files 107 |
| Public tables/functions/policies | Production 75/144/117; QA 94/186/130 |
| Schema delta | 19 QA-only tables, 42 QA-only function signatures, 8 changed shared function bodies |
| Security findings | Production anon/authenticated SECURITY DEFINER 3/39; QA 3/58; leaked-password protection warning in both |

See `evidence/2026-11-09-schema-reconciliation.json` for name-level metadata.
Fingerprints are comparison aids, not backups or proof of function safety. Migration
names differ even for related capabilities; do not subtract timestamps and apply
the resulting files blindly. Production histories also contain administrative
operations that must never become a fresh-build seed.

Current main does not contain `app/opos-next`, `app/portal`, `lib/portals` or the
frozen design contracts. The QA UI is therefore a selective port and integration,
not a stylesheet change to existing production screens.

The release branch has no verified branch-specific Vercel QA environment. Existing
QA variables are scoped to earlier QA/design branches; shared preview credentials
also exist. Automatic deployment of this release branch is disabled in
`vercel.json` until its URL/key/project-ref and test-only integration configuration
are independently verified. CI can still run. Do not test a preview against an
inherited production database or blindly copy Northfield environment variables.

The initial local build compiled but exited with a security warning for locked
Next.js 16.4.0. The release candidate pins Next.js and eslint-config-next to
16.4.5, the upstream security release, and updates the lockfile. This does not
patch the currently deployed production build. Reference:
https://github.com/vercel/next.js/releases/tag/v16.4.5 . Dependency audit findings
beyond this targeted framework update remain to be triaged; no clean dependency
audit is claimed.

## One lifecycle, three role views

The business journey is stable; the owning data record changes. A project is not
created early merely to make a navigation component easier to implement.

| Phase | Owning record and primary operator task | Client experience | Execution Partner experience | Required evidence before progression |
|---|---|---|---|---|
| Opportunity | Opportunity: qualify expressed need | Enquiry confirmation | No access until authorised | Source, contact authority, qualification |
| Requirements | Opportunity/Case: approve scope | Submit requirements and clarifications | Only explicitly shared scope | Confidentiality before sensitive sharing, submitted intake, approved requirements |
| Feasibility | Case: approve feasibility and capacity | Await assessment; answer questions | Controlled technical assessment | Partner authority/confidentiality, technical decision, cost/capacity basis |
| Commercial Offer | Case: approve and issue offer | Read controlled quote | Agreed partner basis only | Approved margin/price, valid revision, controlled issue |
| Contractual Commitment | Case: verify acceptance and opening funds | Sign/accept; pay issued invoice | Await Work Order | Accepted MSA/SOW/IP terms, issued invoice, independently verified advance; only an explicitly approved contractual no-advance basis may waive it |
| Mobilisation | Project: owner/dates and Work Order | See agreed delivery plan | Accept exact Work Order | Verified release authority, project lineage, approved mobilisation, issued WO and partner acceptance |
| Execution | Project/assignment: manage exceptions | Read updates | Confirm start; progress; submit files | Accepted WO, commencement, current assignment, revisioned files and completion declaration |
| Quality Assurance | Project: review engineering and manifest | Await checked review pack | Correct findings on a fresh revision | File/storage integrity, senior technical QC, verified manifest, approved controlled documents |
| Delivery | Project: issue protected client review | View watermarked review; accept/request changes | Await review or correct assigned findings | Current review issue, explicit tenant/member entitlement, exact revision and recorded response |
| Payment Settlement | Project: reconcile funds; owner release; supplier settlement | Pay final invoice; retrieve authorised final files | See own invoice/settlement status | Current acceptance, final invoice and verified funds, independent owner approval, issued handover, verified supplier invoice and real settlement evidence |
| Closure | Project/archive: governed close | Read history and authorised files | Read assignment history | All document, QA, financial and contractual checks satisfied; explicit closure event |

Client review can return work to correction. Increment the engineering revision,
invalidate downstream review/release evidence and show the earliest outstanding
gate. Preserve previous records in the audit trail. Commercial scope changes
return to a governed change/offer process; never edit an issued contract in place.
Reversals/refunds/disputes require financial reconciliation and can block release
even after an earlier payment succeeded. Do not delete historical receipts.

## Information architecture and screen contract

Operator navigation: Home, Outreach, Work, Partners, Finance, Documents,
Administration. Home is an intervention queue, registers locate work, and the
owning workspace performs it. Messages, approvals and tasks appear in context.

Each record shell contains a safe reference/title, compact lifecycle, **one current
action**, owner and reason. Supporting views are Work & Partner, Engineering
Review & Delivery, Commercial & Settlement, and Activity & Evidence. Use task
panels or focused routes with a deterministic return to the owning record. A
waiting state has no primary execute button. A closed record has no repeat close.

Client navigation: Home → quotation/project → current task. Requirements,
contract, invoice, review and final handover stay in the authenticated account.
Only provider checkout/signing may leave it. Checkout returns to the same record
and says payment pending until verified receipt evidence exists. No margin,
partner cost, private notes or internal approval controls are serialised.

Partner navigation: Home → assignment → current task. Work Order acceptance,
commencement, progress, files, corrections and own settlement share one context.
No client selling price, margin, other assignment, client bank details or owner
release controls are serialised. Authenticated membership is checked on every
read, mutation and file request; a valid login alone is insufficient.

At mobile widths the lifecycle scrolls within its own region, supporting views
stack, and the current action remains near the top. All tasks require labelled
inputs, visible focus, keyboard operation, recoverable validation and clear
saved/pending/failed feedback. Verify 360/390/768/1024/1440px and 200% zoom.

## Service boundaries and downstream effects

`lib/lifecycle/currentAction.ts` implements the new pure read-only contract.
It is deliberately not wired into an existing page yet: server evidence adapters
and task parity must be proved first. Existing SQL authorisation remains final.

| Service | Responsibility | Downstream impact and validation |
|---|---|---|
| Evidence projection | Current tenant, entity, contract, assignment, revision and payment environment; unknown on read failure | All role summaries agree; stale revisions cannot keep old approvals green |
| Current action | Earliest unresolved prerequisite, owner, state, safe task target and completion event | Exactly one prominent allowed task or explicit waiting/blocker; never derives permission from a stage or URL |
| Contract/release | Issued immutable offer, authority, acceptance, original opening invoice | Project creation/WO cannot bypass verified advance or approved contractual exception |
| Payments | Invoice-bound minor-unit amounts/currency; signed replay-safe webhook; provider reference uniqueness | No return-URL payment success, duplicate invoice/receipt/checkout, simulation in production or early file release |
| Documents/files | Current manifest, checksums, native format, controlled revision, QC, watermark preview and entitlement | Client review view-only; final native download requires current approval, funds and owner release; superseded files stay locked |
| Partner settlement | Own supplier invoice, bank-change controls, approval, transfer evidence and reconciliation | No simulated transfer counts as money moved; closure follows verified liability settlement |
| Notifications | Durable transactional intent and separate provider outcomes | Business decision remains saved when delivery fails; retry idempotent without repeating payment/approval |
| Audit | Actor, event, entity, revision, correlation/idempotency key and timestamp | Every task can prove saved state independently from email/provider side effects |

Adapters must obtain scoped evidence from authenticated SQL/RLS services. A
service-role fallback is not a substitute for external membership checks. Evidence
must match the active contract, engineering revision and execution cycle; missing
evidence is unknown, not false approval. Cross-role output is an allowlisted DTO.

The action service requires verified gate evidence and a server-supplied target
capability. Capabilities are obtained only after checking the actual task service
and actor permission. It never executes a transition. Pending payment suppresses
repeat checkout. Failed retry is available only with a valid capability. An
unknown or inconsistent phase fails closed.

Decision commit and notification state are independent: `committed`, then
`queued`, `provider_accepted`, `delivered`/`bounced` where attested, or `failed`.
An approved release must not be reported as rejected because email failed.

## Selective QA reuse and route retirement

Reusable candidates: design tokens/shells, external account membership queries,
protected review entitlement, payment signature/environment checks, generic
manifest/document gates and outbox processing. Review each dependency and its SQL
contract before porting. Keep main marketing and public intake changes intact.

Rebuild rather than copy: Northfield settlement, closeout/handover scenario
handlers, historical invoice exception, QA service-role fallbacks, hardcoded
recipients, amounts, IDs and fixed R01 messaging. No wholesale branch merge.

| Existing route family | Owning replacement | Retirement evidence |
|---|---|---|
| `/workspace/acquisition/**`, `/workspace/leads/**` | Unified opportunity/case workspace | Intake, confidentiality, feasibility, offer, contract, invoice and project lineage parity |
| `/workspace/projects/**`, provisional `/opos-next/projects/**` | Operator Project 360 | All tasks, permissions, registers and return paths pass |
| `/client-portal`, `/project-final-payment`, `/client-final-files` | Authenticated Client Workspace | Quote→checkout return→review→native handover and bookmarks pass |
| `/execution/[token]` | Authenticated assignment workspace | WO, start, upload, correction and settlement parity |
| `/portal/**/open` token redirects | Account-scoped tasks/services | No context switch; old tokens retain expiry/audience checks |

Do not remove these routes yet. Token links in previously sent emails need a
guarded compatibility entry that checks audience/expiry before choosing the
authenticated destination. Redirects must not reveal project existence.

## Required new QA scenarios (not yet executed)

Use new synthetic records only in OPOS-QA; preserve Northfield. Prices, revisions,
files and actors must differ between runs. Never send mail to invented real
addresses; use owner-authorised test inboxes. No live charges or bank transfers.

1. **Fresh happy path:** new opportunity, requirements, feasibility, offer,
   contract, original opening invoice, Stripe test receipt, project, accepted WO,
   commencement, real revisioned CAD + PDF upload, manifest/QC, protected review,
   acceptance, final invoice/test receipt, owner release, authorised native
   download, test settlement evidence explicitly marked synthetic, closure.
2. **Fresh adverse path:** different client/partner/amounts; declined/expired offer,
   duplicate checkout and webhook, delayed receipt, wrong tenant/role/token,
   missing native file, correction with fresh revision, stale approval denial,
   email failure/retry/bounce, denied early download and unpaid supplier closure.
   Recover through legitimate tasks without manual SQL repair, then close.

For each capture build SHA/URL, actor, expected/actual state, SQL evidence IDs,
provider test references, manifest hashes, notification events and mobile/keyboard
results. These are **database/browser E2E runs**, not action-reducer unit tests.
Synthetic settlement tests cannot prove live banking readiness.

## Execution ledger and release decision

| Sequence | Current result | Remaining acceptance evidence |
|---|---|---|
| 1 Baseline and release architecture | Main/deployment/freeze/PR verified; schema metadata reconciled; QA target confirmed | Full migration/grant/trigger/storage reconciliation; backup/restore and clean replay |
| 2 Unified lifecycle and IA | This full-lifecycle contract and pure action model added | Desktop/mobile implementation and observed task parity |
| 3 Shared business/payment/document services | Current-action foundation with ownership/negative tests | Authenticated evidence adapters, service consolidation and concurrency tests |
| 4 Three complete workspaces | Not implemented on release branch | Selective port, integration, visual/accessibility verification |
| 5 Obsolete route removal | Deferred deliberately | Replacement parity and compatibility-link tests |
| 6 Regression + two fresh E2Es | Unit regression added; existing checks run separately | Fresh DB replay and two authenticated cross-role QA scenarios |
| 7 Readiness review | Advisor metadata inspected | Function/RLS/tenant audit, real CAD, notification delivery, finance and rollback evidence |
| 8 GO/NO-GO | **NO-GO** | Specific eligible build, completed evidence register and owner release decision |

No database writes, production deployment, live payment or external messages were
performed while establishing this checkpoint. No clean DB replay can be claimed
from this runtime: Docker, Supabase CLI and PostgreSQL binaries were unavailable.
The existing credential-free ephemeral Supabase CI workflow is extended to the
release branch so migration replay can produce independently inspectable results.

Continue from this ledger. Do not describe this foundation as completed production
hardening or as an approved production UI.
