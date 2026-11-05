# OPOS North Star — Product Experience Contract v1
**Status:** Product direction agreed; implementation and acceptance are incomplete.
**Authoritative reference:** Approved OPOS Visual Review v2 — Mission Control, Opportunity, Register, Case 360, Project 360, LinkedIn Outreach, Client Portal, Execution Partner Portal. The prototype is an **experience blueprint**, not merely a colour or layout reference.
**Branch:** `design/opos-decision-first-ia`; draft PR #113.
**Protection:** Preserve current Supabase data, role permissions, contractual safeguards, payment validation, audit trails and production operation. A prototype's illustrative data or simulated buttons are **not** proof that a business action occurred.

## Product outcome
**Someone should be able to operate the engineering overflow business through OPOS with minimal manual coordination.** The user sees one truthful current situation, one permitted next decision where needed, and evidence of what OPOS has already done. The OS performs routine authorised work and quietly manages dependencies. No operator should have to understand database tables, manually reconcile duplicate statuses, copy secure email links, or shuttle between conflicting UI systems.

## What "match the prototype" means
An implemented view has five inseparable dimensions:
1. **Visual fidelity:** desktop/mobile information hierarchy, navigation, density, typography and spacing match the chosen v2 screen and its interaction states.
2. **Information architecture:** the right business object, at the right place, with the right supporting evidence. No duplicated lifecycle explanations.
3. **Behaviour:** each button, input, selection, form, disclosure or link does what the prototype communicates, using real permitted handlers.
4. **Operational automation:** legitimate consequences happen reliably: secure invitation, reminder, handoff, controlled document generation, notifications, task ownership and lifecycle movement.
5. **Business truth:** state, access, blockers, identities, payment verification, signature, timestamps and evidence originate in authoritative records; no optimistic or contradictory statuses.

A page **fails** if it looks right but uses demo data, contains inert buttons, sends the user to an unrelated legacy view, or requires manual intervention where governed automation is expected. Likewise, a page fails if it executes correctly but does not reproduce the approved hierarchy and experience.

## Experience loop — universal
**Trigger → verified state → automatic system work → human intervention only if authorised/needed → evidence → next state.**
Each completed operation must answer:
- **What happened?** Human-readable event and accurate timestamp.
- **What did OPOS do?** Job queued/processed or deliberately blocked, with failure/retry state where relevant.
- **Who owns the next dependency?** Customer, Execution Partner, OP operator, approver, or system.
- **Is a decision actually required?** Show **one** primary decision only if the authorised action is available.
- **What happens after that decision?** Background consequences, notification, document, schedule and audit event.
- **How do we recover safely?** Idempotent retry or controlled escalation, without duplicate records/commits.

## Screen contracts

### 1. Mission Control — operator's decision desk
**Prototype:** A single high-priority decision, a small ordered Up next queue and a visible Waiting on others section.
**Live behaviour:** Derive from the actual approvals/exceptions and dependency owners. Pending client/partner work belongs in Waiting on others unless an overdue failure actually warrants an operator decision. Clicking a task opens that task in the **new** owning record workspace; no generic jump to a legacy dashboard. A customer merely completing a form is not an operator emergency.
**Acceptance:** The primary CTA reflects an actual permitted decision; when nothing needs the operator, display an honest calm state. Counts and row states reconcile to records.

### 2. LinkedIn Outreach — conversation before CRM
**Prototype:** Select a conversation, read its history, qualify interest, and see the single next conversation decision.
**Live behaviour:** LinkedIn remains manual, person-to-person. Store history and disposition; schedule relevant follow-up. Only explicit interest/consent may promote a conversation into the Opportunity/CRM workflow. No unsolicited Step 2 email or premature Company/Contact/Prospect records. Conversion is idempotent and clearly reports created/reused objects.
**Acceptance:** Follow-up, status update, and CRM conversion work on desktop/mobile; the conversation remains visible after handoff.

### 3. Website Opportunity — acquisition and requirements
**Prototype:** One current position, three stages (Enquiry/Requirements/Feasibility), activity and evidence.
**Live behaviour:** New website enquiry triggers the secure Step 2 invitation through the authorised worker. Show **queued**, **accepted by email provider**, **confirmed delivered only with delivery proof**, **failed**, **expired**, and **submitted** distinctly. While customer response is due, do not show redundant "send" or developer-test-link CTAs. Reminders and expiry handling run automatically; the operator is only called for real exception/escalation. After submission, initiate the governed technical assessment path and manage missing-information relay.
**Acceptance:** One real enquiry flows through the actual email queue, secure client submission and partner assessment without copying links or creating duplicate records.

### 4. Case 360 — technical and commercial decision
**Prototype:** One commercial/approval decision with controlled price basis, evidence and compact stage progression.
**Live behaviour:** Inherit approved feasibility and technical scope; do not repeat partner assessment unnecessarily. Record controlled partner cost; calculate default **33% gross margin** with deliberate override and audit. Generate versioned quotation using approved documents; default validity **14 days**, reminders on days 7/12, secure client portal acceptance by named authorised person. Price/quote/acceptance actions are role-gated. No executable project on quote acceptance alone.
**Acceptance:** Every CTA results in a governed state transition, document, communication, timestamp, audit evidence and accurate subsequent position.

### 5. Client Portal — deliberate acceptance and payment
**Prototype:** One relevant customer task with scope, commercial terms and clear consequences.
**Live behaviour:** Secure portal presents the controlled quotation, approved scope, questions, named acceptance and **30% default advance** payment request via Stripe or bank transfer. Client sees the next appropriate task after acceptance. Advance must be received **and verified** before OPOS creates Project 360. Repeated submissions are safe and don't duplicate projects.
**Acceptance:** A complete authenticated customer journey is demonstrated, including declines/questions, acceptance, payment pending, failure, verified payment and next state.

### 6. Project 360 — execution and controlled delivery
**Prototype:** One execution clarification or other actionable decision, readiness stages, controlled evidence and project facts.
**Live behaviour:** Project only exists after verified advance. OPOS automatically issues Execution Partner Work Order after project creation. Execution cannot start until the partner accepts. The work order, deliverables, clarification, QA, correction-vs-scope-change distinction, client delivery and review are governed. Corrections and variations follow agreed controls. The operator sees real blockers and the single next human decision, not made-up next steps.
**Acceptance:** Verified payment → Project 360 → issued work order → acceptance → execution → QA → delivery → client review works as a traceable, authorised chain.

### 7. Execution Partner Portal — accept and deliver
**Prototype:** View own controlled scope/terms, ask questions, explicitly accept work order, upload progress/evidence.
**Live behaviour:** Partner sees only their assignments, value and terms—not customer margin/pricing. No partner advance. Formal work-order acceptance is recorded before execution. Partner can raise clarifications and submit work securely. OPOS logs, notifies and routes all submissions. Partner payout is gated by client final payment verification, partner completion, OP QA approval and client final review approval.
**Acceptance:** Invited partner can review, clarify, accept, execute and submit from phone or desktop; access restrictions and evidence trail verified.

### 8. Registers, Finance and Documents — supporting operating tools
**Prototype:** Efficient mobile and desktop search, filters, selected records, and contextual evidence without a dashboard wall.
**Live behaviour:** Registers permit search and navigation across owning records while preserving state. Finance derives receivables, payments, reconciliations and partner payables from real ledgers. Documents retain controlled versions, approval, issue and retrieval rights. Secondary actions do not compete with a record's governing next decision.
**Acceptance:** Real data, search/filter, empty/blocked states and authorised actions work; no sideways-scrolling desktop table forced on mobile.

## Canonical commercial lifecycle
`Opportunity → Requirements → Feasibility → Commercial Offer → Contractual Commitment → Mobilisation → Execution → Quality Assurance → Delivery → Payment Settlement → Closure`.

Preserve the approval and financial gates agreed for OPOS. The visual prototype expresses the journey; it does **not** authorise bypassing those gates.

## What must change in our implementation strategy
- Stop equating "screens created", "route working" or "dark CSS applied" with a delivered experience.
- Stop building generic placeholder records and pointing every primary CTA back to `/workspace`.
- Implement **one complete vertical slice first**, with the actual server actions, background jobs, audit evidence, notifications, portal and error handling. Then use the same design/interaction contracts for every remaining business stage.
- Every prototype affordance becomes an acceptance case: **input → real business consequence → persisted fact → new screen state**.
- Distinguish visual demo interactions from business transactions; do not ever claim an email sent or a payment received because a user clicked a button.
- Review with actual desktop 1440px and mobile 390px screenshots, authenticated journeys, long names, empty/waiting/failed/blocked states and full permissions.
- Do not replace production routes or merge draft PR until experience fidelity and end-to-end operating integrity are jointly approved.

## First required vertical slice
**Website enquiry → secure Step 2 invitation (automated queued/provider-accepted/failure status) → customer submission → partner technical assessment → internal feasibility decision → Case 360 handoff.**
This slice crosses operator, customer, partner, email worker, approvals and audit. It demonstrates whether OPOS is truly operating the business instead of merely showing its data.

## Definition of done for every slice
**Visual + functional + operational + evidence + accessibility.** If one is missing, it is not done.

**North-star rule:** The approved prototype is the desired **real user experience** of operating Overflow Partner. The app should behave like the prototype feels, while using production-grade rules, security, reliable automation and traceable business facts.
