# Overflow Partner — UX/UI Parity Constitution

**Status:** Normative product-experience companion to `BUSINESS_LIFECYCLE_CONSTITUTION.md`  
**Scope:** Mission Control, Acquisition, Case 360, Project 360, Partner Execution, delivery/review and closeout surfaces.

The database lifecycle is the authority for what is permitted. The interface is responsible for making that authority immediately understandable without exposing database complexity to the operator or Execution Partner.

## Core rules

1. **Current operating state dominates.** Every record screen must make the current lifecycle state unmistakable before showing history, metadata or secondary modules.
2. **One governed next action has primary visual weight.** Readiness, summary and audit support the decision; they do not compete with it.
3. **Where / what / evidence / next.** A working screen must answer: where am I, what is happening, what evidence exists, and what is the next permitted action.
4. **Evidence provenance is visible.** Distinguish `OP controlled`, `Partner reported`, `System gate`, and `Client evidenced`. Do not make an external statement look like an internal approval.
5. **Commercial context is present but subordinate.** Value, partner cost, margin, programme and financial control remain visible to authorised users without turning the operating screen into a finance dashboard.
6. **Progressive disclosure protects focus.** History, metadata, older documents and correspondence remain available but must not displace the live decision.
7. **No dashboard-card inflation.** A screen should not use multiple equal-weight cards when one is the current operating object or decision.
8. **Flat industrial precision.** Prefer borders, spacing, typography and restrained accent over gradients, glass, heavy shadows, decorative pills or illustration.
9. **Mobile is a distinct operating layout.** Current state and next action appear first. Completed history collapses. Current/future lifecycle stages remain reachable without hiding the active stage.
10. **External Partner UX is narrower than internal Project 360.** Show only controlled scope, dates, reporting requirements, execution state and permitted Partner declarations/submissions.
11. **Submission packages behave like governed objects.** Execution-cycle engineering files show cycle, package state, file count/payload and immutability after submission.
12. **No UI-only authority.** Visual readiness must be derived from the same governed state used by the server/database. Styling must never imply that a blocked action is permitted.

## Canonical record hierarchy

1. Record identity / current state
2. Lifecycle position
3. Evidence provenance key
4. Next permitted action
5. Gate readiness / blockers
6. Commercial or record summary
7. Current-stage operating work
8. Controlled evidence
9. Communications when needed
10. Audit/history/metadata through disclosure

## Mission Control hierarchy

1. Next controlled decision
2. Waiting-on signals: Internal / Execution Partner / Client
3. Off-plan signal
4. Compact portfolio metrics
5. Governed decision queue
6. Exception queue

Mission Control is an operating brief, not a generic KPI dashboard.

## Partner Execution hierarchy

Before commencement:

1. Controlled project/scope identity
2. Commencement state
3. Execution basis and release instructions
4. Commencement declaration as primary action
5. Exception route if valid commencement is impossible

After commencement:

1. Current execution state / cycle
2. Partner-reported progress
3. Exceptions
4. Engineering delivery package
5. Historical execution evidence

## Visual provenance

- **OP controlled** — restrained Overflow Partner accent rule.
- **Partner reported** — distinct cool evidence rule.
- **System gate** — system/control rule.
- **Client evidenced** — distinct client-evidence rule.

Provenance markers are labels, not status badges. Status and source are different concepts.

## Acceptance criteria for future UX changes

A lifecycle UX change is not complete unless:

- the next permitted action is visible without searching the page;
- blockers explain what must be resolved and link to the correct module where practical;
- the interface does not expose an action forbidden by the lifecycle constitution;
- external evidence is attributable to its source;
- required controlled evidence is visible at the point of decision;
- desktop and mobile both preserve current state and action priority;
- audit/history remain accessible without dominating the operating surface;
- lint, typecheck and production build pass.

## Change-control rule

A future change that materially changes operating hierarchy, evidence provenance, action priority, Partner-facing scope or mobile lifecycle behaviour must update this constitution in the same pull request. Business rules remain governed by `BUSINESS_LIFECYCLE_CONSTITUTION.md`; UX work must not redefine them.
