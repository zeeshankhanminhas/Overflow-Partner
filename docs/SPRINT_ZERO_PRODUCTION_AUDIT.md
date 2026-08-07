# Overflow Partner — Sprint Zero Production Audit

Date: 7 Aug 2026
Scope: Workspace architecture, business truth, UX/UI, language, process, notifications, search, finance, BI, risk/compliance, mobile, accessibility, performance and scale readiness.

## Executive conclusion

Overflow Partner is commercially credible as an early production operating system, but it has grown through several UI generations. The core workflow, governed documents, commercial control and Project/Case operating model are stronger than the consistency layer around them. Sprint Zero therefore freezes feature expansion and consolidates the system around one rule: every screen must communicate business truth, next permitted action and evidence without forcing the user to interpret implementation history.

Current overall launch-readiness assessment: **7.8 / 10** before the Sprint Zero fixes below. The product is not blocked by a missing business model; it is blocked primarily by UX consistency, a few scale regressions, incomplete queue pagination outside Case/Project, and operational-state semantics that are sometimes inferred rather than independently evidenced.

## Severity definitions

- **Critical** — can misrepresent business truth, bypass governance, create financial/operational risk, or materially fail at scale.
- **High** — creates significant usability, maintainability, performance or trust problems.
- **Medium** — should be corrected before broader multi-user adoption.
- **Low** — polish or later-stage optimisation.

---

# A. Architecture & business operating model

## What is strong

- Case 360 is the primary commercial/technical operating surface.
- Project 360 is the primary controlled-delivery operating surface.
- Lifecycle navigation is separated from record lifecycle truth.
- Commercial Control is outside the lifecycle rather than pretending to be a lifecycle stage.
- Evidence Registry is a registry; documents remain attached to workflow context.
- Financial mobilisation is governed at UI and database level.
- Notification delivery uses one Resend outbox rather than multiple email stacks.
- Case and Project register queues have database-side pagination.

## Findings

### HIGH — Case 360 currently regressed to organisation-wide orchestration loading
`app/workspace/leads/[id]/page.tsx` calls `listWorkflowCases(...).find(...)` even though a targeted `getWorkflowCase(...)` now exists. This means opening one Case can load every lead, technical intake, partner quote, commercial review, quote and project for the organisation. At higher volume this undermines the scale-readiness work.

**Required correction:** Case 360 must use `getWorkflowCase(supabase, organisationId, id)` only.

### HIGH — Lifecycle completion display remains sequentially inferred
The sidebar/project progress displays prior stages as complete because the current stage is later in the sequence. The governed transition rules make this normally true, but migrated/admin-created records can create exceptions.

**Required correction:** introduce explicit gate-completion evidence for migrated/exception records, or visibly label those records as migrated exceptions.

### MEDIUM — Exceptional entry routes are still embedded in operating registers
Case and Project registers load company/contact/quote/lead data to support hidden exceptional-entry forms. This increases query cost for normal users.

**Required correction:** lazy-load administrative exception forms or move them to an explicit admin-only route.

---

# B. Dashboard / Owner Command Centre

## Findings

### CRITICAL — action metrics were based only on the first eight displayed actions
`Open actions`, `Overdue`, `Internal decision` and `Execution partner` were calculated after slicing the queue to eight records. The dashboard could therefore report 8 open actions when the business actually had 20.

**Sprint Zero status: FIXED.** Metrics now use the full attention set while the visible action list remains capped at eight priority records.

### HIGH — dashboard needs queue-level financial and risk exception signals
The command centre currently prioritises operating work but does not yet surface overdue receivables, blocked mobilisation, critical risk or failed communication counts.

**Next consolidation:** add exception signals only; do not turn the dashboard into a decorative BI screen.

### MEDIUM — action queue requires a genuine full-queue destination
The current fallback sends users to the Case register. A future dedicated `My Work` queue may be useful once ownership/assignment becomes multi-user.

---

# C. Acquisition

## Findings

### HIGH — one page was acting as register + data-entry screen + technical dossier + partner review workspace
The Acquisition page permanently rendered technical evidence and the partner-review form inside each prospect card, causing long, irregular pages as records accumulated.

**Sprint Zero status: FIXED.** Acquisition is now summary-first. Technical evidence and partner review are disclosed only when the operator opens that prospect's evidence section.

### HIGH — light-paper technical brief broke the dark OS visual language
The technical brief used `var(--paper)` and deliverable chips explicitly used `background: white`.

**Sprint Zero status: FIXED.** Evidence now uses the dark governed information language and restrained dark tags.

### HIGH — Prospect and Technical Intake registers are unpaginated
`listProspects()` returns the full prospect set; Technical Intake loads every intake session. These will become slow and visually unwieldy at scale.

**Required correction:** add paginated Supabase queue functions for acquisition, matching Case/Project queue architecture.

### MEDIUM — Technical Intake register has no focused record destination
Rows show state but cannot open a focused technical-intake record. Acquisition is currently the operating workspace, which is acceptable for V1, but deep links will become necessary when queues grow.

### MEDIUM — Prospect terminology still leaks `lead` language in some copy/actions
User-facing language should consistently use **Prospect → Case 360 → Project 360**. `Lead` may remain an internal/database entity name.

---

# D. Case 360

## What is strong

- One current business object is dominant.
- Next permitted action is explicit.
- Partner evidence, commercial review, quote and project transition remain on the Case.
- Quote issue is gated by the controlled quotation document state.

## Findings

### HIGH — targeted lookup regression
See Architecture finding above.

### HIGH — state logic is encoded as a long imperative `if` chain in the page
Current status, next action, reason, blocker and action key are all computed in `page.tsx`. This is business logic and should live in one canonical Case presentation/resolver function.

**Required correction:** move `currentStatus / nextAction / reason / blocker / actionKey` into a domain-level presenter using canonical lifecycle state.

### MEDIUM — language mixes `technical scope`, `technical intake`, `partner review`, `partner response` without always distinguishing evidence from action
Adopt a controlled vocabulary:
- Technical Intake = customer-provided structured requirement.
- Technical Scope = internal governed definition.
- Partner Review = external technical/capacity assessment request.
- Partner Response = returned execution evidence.

### MEDIUM — activity history is limited and document lists can become long
Case detail should paginate/archive historical events once record volume grows.

---

# E. Project 360

## What is strong

- Stage gate and next permitted action are visible.
- Financial mobilisation is now governed.
- Controlled documents and delivery activities sit in the project context.
- Project history records transitions.

## Findings

### HIGH — typography is too small for a primary operating surface
The original Project OS CSS uses many 8–11px labels and values. This is difficult on normal desktop monitors and especially poor for long shifts/operations use.

**Sprint Zero status: FIXED globally.** The final consistency layer raises operational labels/body text and control hit areas.

### HIGH — progress rail implies historical completion from stage position
See lifecycle completion finding.

### MEDIUM — Project 360 financial position is not visible enough in the project itself
The financial gate is enforced, but operators should see concise `authorised / blocked / basis / outstanding condition` context without leaving Project 360.

### MEDIUM — activity list is capped at ten with no dedicated full history destination
Fine for V1; requires pagination/activity register for higher-volume delivery.

---

# F. Case & Project registers

## What is strong

- Server-side pagination exists at 25 rows.
- Lifecycle views are database-filtered.
- Register pages are now navigation, not lifecycle progress.

## Findings

### HIGH — exceptional entry dependencies load on every register request
Case register loads all companies/contacts. Project register loads client quotes/leads. Move these behind explicit admin action/lazy loading.

### MEDIUM — queue filters are fixed lifecycle filters only
As queues grow, users will need owner, priority, age, due-date and customer filters. Do not add until multi-user/volume requires them.

### LOW — row status uses workflow vocabulary mapping but could include ageing/owner for better queue decisions.

---

# G. Documents / Evidence

## What is strong

- Contextual Case/Project filtering exists.
- Evidence is treated as governed record rather than file storage.
- Document state transitions and audit integration are established.
- Client quote/document gating is integrated.

## Findings

### HIGH — validate context IDs instead of silently showing empty evidence
`/workspace/documents?lead=random` or invalid Project IDs should identify an invalid context rather than looking like a legitimately empty evidence register.

### MEDIUM — document relationship model should later support parent, revision lineage, superseded-by and source-generated-from relationships explicitly.

### MEDIUM — document search should include extracted content/drawing metadata when needed; current enterprise search is primarily record metadata.

---

# H. Commercial Control / Finance

## What is strong

- Client invoices, receipts, partner liabilities and partner payments are first-class.
- Financial mobilisation gate exists.
- Overpayment/project/currency safeguards exist.
- Partner payable approval requires evidence.
- Invoice issue/payment lifecycle integrates with Resend.
- Secure public invoice token view exists.
- Finance queues/totals were hardened for scale.

## Findings

### HIGH — accounting integration/reconciliation remains manual
No bank-feed or accounting-system reconciliation exists. This is acceptable for owner-operated V1 but becomes a CFO control risk at scale.

### HIGH — invoice PDF should eventually use the governed document engine
The controlled print view is useful, but invoices should ultimately have immutable generated evidence/revision/issue records consistent with the document engine.

### MEDIUM — no aged receivables buckets yet
Need 0–30, 31–60, 61–90, 90+ day visibility before larger receivables volume.

### MEDIUM — billing milestones exist in the data model but do not yet drive automatic invoice readiness.

### MEDIUM — credit note/refund workflow remains basic.

---

# I. Executive Intelligence

## What is strong

- CEO/COO/CFO views use operating and financial records.
- Focus is on management signals, not decorative charts.

## Findings

### HIGH — several BI calculations still load complete tables into application memory
The page queries all quotes, projects, invoices and risks to derive win rate/due-soon/overdue/high-risk counts. This will become expensive as history grows.

**Required correction:** extend `op_executive_snapshot` so all executive metrics are aggregated in SQL, with time-window filters.

### HIGH — no historical/time-series intelligence
Current metrics are point-in-time only. CEO/CFO need trends: pipeline movement, win rate, cash conversion, margin, stage velocity.

### MEDIUM — no KPI definitions/versioning
Each KPI should eventually have a documented definition to prevent metric drift.

---

# J. Risk & Compliance

## What is strong

- Risk is linked to business context, owner, likelihood, impact and mitigation.
- Compliance has evidence, effective/expiry dates and status.

## Findings

### HIGH — hard limits hide records without pagination
Risk and compliance queries cap at 200, while the UI only renders the first 20. Records beyond that are effectively inaccessible from the screen.

**Required correction:** paginated risk and compliance queues with server-side counts/filtering.

### HIGH — expiry and high-risk conditions do not yet trigger notification/escalation workflows
The register identifies exceptions but does not automatically create reminders/escalations.

### MEDIUM — risk acceptance needs explicit approver/reason/evidence for mature governance.

### MEDIUM — risk gates are not yet able to block selected Project transitions.

---

# K. Notifications & Communications

## What is strong

- One governed outbox.
- Transactional, reminder, nurture and system categories.
- Retry/failure visibility.
- Record linkage.
- Invoice reminders now reuse the same system.

## Findings

### HIGH — 150-record hard limits make totals and registers incomplete
Notification Centre and Communications load only the latest 150 and compute counts from that subset. Once history exceeds 150, `Sent / Scheduled / Failed` no longer describe the full ledger.

**Required correction:** database counts + pagination; keep latest records as the visible page only.

### HIGH — failure handling needs an operator retry action from Notification Centre
Failures are visible but operational recovery should be explicit and audited.

### MEDIUM — communication register and notification centre overlap conceptually
Keep distinction clear:
- Communications = business correspondence history.
- Notification Centre = delivery engine/control/failures/retries.

### MEDIUM — daily/operator digest should be built only when multi-user workload needs it.

---

# L. Enterprise Search

## What is strong

- One authenticated search across major governed objects.
- Search is organisation-scoped.

## Findings

### HIGH — search returns a maximum result set without pagination/group counts
At scale, common terms may return 60 matches and hide the rest.

### MEDIUM — ranking/relevance should weight exact reference/project/invoice number above body/knowledge matches.

### MEDIUM — add type/filter chips only after enough volume justifies them.

### MEDIUM — deeper document content/drawing metadata indexing remains future work.

---

# M. Knowledge

## Findings

### HIGH — knowledge list is capped at 200 and has no pagination/search inside the library
Global Search can find entries, but the library itself will become cumbersome.

### MEDIUM — `<a>` navigation causes full page reload instead of Next.js `Link` behaviour.

### MEDIUM — knowledge governance needs review/approval/archive states if it becomes authoritative technical guidance.

### MEDIUM — source entity linkage is captured in schema but should be visible in the UI so lessons remain traceable.

---

# N. Navigation & information architecture

## What is strong

- Lifecycle and navigation state are separate.
- Commercial Control, BI, Risk and Knowledge are outside lifecycle progression.
- Case/Project context persists into Evidence and Communications.

## Findings

### MEDIUM — context is still route-pattern dependent
If future nested record routes are added, `recordContext()` must be updated or context silently disappears. Prefer a context provider/layout at the record route level later.

### MEDIUM — utility sections use native `<details>` and do not persist expansion choice between routes.

### LOW — Dashboard + Notifications are both in Overview while Notifications also exists under Control. Duplicate destination is understandable but should eventually have one canonical navigation position.

---

# O. Visual design system & consistency

## Findings

### HIGH — multiple UI generations coexist
Legacy `.card/.metric`, Mission Control classes, `vp-*`, Project OS and document-specific styles all remain active.

**Sprint Zero status: PARTIALLY FIXED.** A final `sprint-zero.css` consistency layer now normalises operational typography, dark form controls, focus styles, mobile grid collapse, hit areas and reduced-motion behaviour without rewriting stable modules.

### HIGH — operational typography was below comfortable readability
Many labels and data values were 8–10px.

**Sprint Zero status: FIXED globally.** Minimum operational label/value sizes increased.

### HIGH — white controls/light surfaces appeared inside dark Workspace
Project administrative form classes and Acquisition evidence introduced white inputs/panels.

**Sprint Zero status: FIXED globally for private workspace controls; Acquisition evidence explicitly refactored.**

### MEDIUM — too many inline layout styles make responsive behaviour fragile
New work should use named layout primitives rather than new inline `gridTemplateColumns` declarations.

### MEDIUM — establish canonical primitives: `PageHeader`, `MetricStrip`, `OperatingQueue`, `StatusBadge`, `Disclosure`, `ActionPanel`, `FactGrid`, `EmptyState`, `Callout`.

---

# P. Mobile & responsive UX

## What is strong

- Dedicated mobile nav exists.
- Command palette is available on mobile.
- Document review/print has dedicated responsive work.

## Findings

### HIGH — many newer pages use inline two-column grids without page-specific responsive classes
Risk, Knowledge, Commercial Control and BI can retain desktop grids unless overridden.

**Sprint Zero status: FIXED defensively.** The final CSS collapses inline `grid-template-columns` within VP/Project operating pages at <=900px.

### MEDIUM — mobile nav intentionally exposes only five primary actions; record-context actions require sidebar/context parity or command palette discovery.

### MEDIUM — all financial/risk forms need hands-on small-screen testing after migrations are live.

---

# Q. Accessibility

## Findings

### HIGH — tiny text and controls were the main baseline accessibility problem.

**Sprint Zero status: IMPROVED.** Typography and minimum control height increased.

### HIGH — focus visibility was not guaranteed consistently across generations.

**Sprint Zero status: FIXED at workspace baseline.** Explicit `:focus-visible` treatment added.

### MEDIUM — colour is still used as a strong status signal; ensure text/status labels always accompany colour.

### MEDIUM — long forms need validation summaries and field-level error association where not already present.

### MEDIUM — full keyboard audit remains necessary for disclosures, command palette, document review and complex forms.

### LOW — reduced-motion support was not explicit.

**Sprint Zero status: FIXED baseline.**

---

# R. Performance & scalability

## Already strong

- Case and Project registers paginate in Supabase.
- Financial queue totals were moved away from first-100 calculations.
- Canonical targeted Case lookup exists.
- Relevant database indexes were added.

## Remaining scale risks

1. Case 360 currently calls organisation-wide `listWorkflowCases` — **HIGH**.
2. Acquisition Prospect register loads all prospects — **HIGH**.
3. Technical Intake register loads all sessions — **HIGH**.
4. Risk/Compliance uses hard limits and only renders first 20 — **HIGH**.
5. Notifications/Communications uses first 150 for totals — **HIGH**.
6. Executive BI loads whole operational tables for some derived metrics — **HIGH**.
7. Knowledge library caps at 200 — **MEDIUM**.
8. Search caps at 60 without pagination — **MEDIUM**.

---

# S. Security, privacy & trust

## Strong

- Workspace authentication.
- Organisation-scoped RLS on newer business-control tables.
- Secure tokenised public invoice links.
- Financial gates enforced in database, not only UI.
- Notification worker uses service-role credentials server-side.

## Findings

### HIGH — public invoice token lifecycle needs revocation/rotation policy
Tokens should be revocable and optionally expire after settlement/retention period.

### MEDIUM — exported/printed finance documents should avoid exposing internal notes or partner cost.

### MEDIUM — retention/deletion policies need explicit operational schedules for prospect/customer data, communications and documents.

---

# T. Language / controlled vocabulary

Adopt this as the user-facing canonical vocabulary:

- Prospect — pre-governed opportunity.
- Technical Intake — structured customer technical evidence.
- Technical Scope — internal governed technical definition.
- Partner Review — request for execution-partner technical/capacity evidence.
- Partner Response — returned evidence.
- Case 360 — commercial/technical operating record after qualification.
- Commercial Review — internal selling-position decision.
- Client Quote — controlled commercial offer.
- Project 360 — accepted work in delivery.
- Evidence — controlled documents and proof attached to workflow.
- Commercial Control — receivables, payables and financial authority.
- Notification Centre — delivery engine/failure control.
- Communications — business correspondence record.

Avoid user-facing `Lead` except where legally/business-specifically required. Keep it as an implementation/database term.

---

# U. Sprint Zero implementation completed in this pass

1. Added `app/workspace/sprint-zero.css` as the final cross-workspace consistency layer.
2. Increased operational typography from the overly small legacy baseline.
3. Normalised dark Workspace form controls and focus-visible behaviour.
4. Added defensive responsive collapse for inline two-column operating layouts.
5. Added reduced-motion baseline.
6. Corrected Dashboard metrics so full queue truth is not capped to the first eight visible records.
7. Refactored Acquisition into a summary-first operating workspace.
8. Removed light-paper/white technical evidence surfaces from Acquisition.
9. Moved detailed technical evidence and partner review into controlled disclosure rather than permanent long-page rendering.
10. Standardised Acquisition language toward Prospect → Case 360.

---

# V. Sprint Zero remaining implementation order

## P0 — finish before production reliance

1. Replace Case 360 `listWorkflowCases().find()` with targeted `getWorkflowCase()`.
2. Apply all pending Supabase scale/business-control migrations and run end-to-end finance/workflow tests.
3. Database-paginate Prospect and Technical Intake registers.
4. Database-paginate Notification/Communications and use global counts.
5. Database-paginate Risk/Compliance.
6. Move remaining Executive Intelligence derived metrics into SQL snapshot/aggregates.

## P1 — before broader customer/partner volume

7. Make lifecycle completion gate-backed for exceptional/migrated records.
8. Move admin exception entry off normal Case/Project register fetch paths.
9. Add invalid Evidence context validation.
10. Add notification retry action and compliance/risk reminder automation.
11. Add finance ageing buckets and billing-milestone readiness.
12. Add token revocation/expiry policy for public invoice links.

## P2 — multi-user maturity

13. Assignment/ownership filters and My Work queue.
14. Knowledge governance/review/archive.
15. Search pagination/ranking/filter groups.
16. Time-series executive intelligence and KPI definitions.
17. Accounting/bank reconciliation integration.
18. Full accessibility regression audit and automated test coverage.

---

# Launch gate

No new feature family should be started until all **P0** Sprint Zero items are closed and an end-to-end controlled test proves:

Website enquiry → Step 2 → technical/partner evidence → Case 360 → commercial review → controlled quote → acceptance → financial authorisation → Project 360 → controlled delivery → invoice/payment → partner payable → closeout → audit/evidence history.

That path is the commercial spine of Overflow Partner. Sprint Zero exists to ensure every surrounding screen supports that spine rather than obscuring it.
