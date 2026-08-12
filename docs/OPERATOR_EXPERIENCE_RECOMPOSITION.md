# Overflow Partner — Operator Experience Recomposition

**Status:** Normative product-experience contract for the recomposition programme  
**Branch:** `sprint/operator-subtraction`  
**Depends on:** `BUSINESS_LIFECYCLE_CONSTITUTION.md`, `OPERATOR_SUBTRACTION_CONSTITUTION.md`  
**Objective:** Preserve governed business truth while making the normal operator path read and behave like focused SaaS rather than a database administration surface.

## Definition of done

An authorised operator can run the complete governed lifecycle without understanding the database schema, internal IDs, assignment/session implementation, enum values, evidence joins, or duplicate representations of the same business fact.

A build passing is necessary but not sufficient. The exact head must also pass lifecycle, interaction, responsive, permission, and operator-simulation acceptance.

## Product laws

1. The database may be complex; the operator journey must remain simple.
2. A governance object is not automatically a UI object.
3. Never ask an operator to enter, confirm, select, or manage information the system can derive authoritatively.
4. Existing records open as evidence/view state. Editing is intentional and exceptional.
5. A completed control collapses to compact evidence; its form does not remain permanently visible.
6. One business action has one operating location and one authoritative owner.
7. One important fact appears once in the working viewport unless repetition is necessary for the current decision.
8. Normal waiting is quiet. Off-plan work, blockers, exceptions, and required decisions receive attention.
9. Temporary actions use temporary UI.
10. The first viewport communicates the business situation, owner of the next move, and next permitted action or wait.
11. Server/RPC invariants must enforce every lifecycle gate independently of UI visibility.
12. No Project execution may start before the required client start payment has actually cleared.

## Canonical lifecycle

Website / manual enquiry
→ Technical Intake
→ governed Execution Partner review
→ Partner feasibility + price
→ internal Go / No-Go
→ Case 360
→ controlled technical basis
→ Commercial Review
→ controlled Client Quote
→ Quote issued
→ written Client Acceptance
→ Project 360 created in **Awaiting Payment / Mobilisation**
→ required start payment received and cleared
→ mobilisation controls complete
→ Ready for Execution
→ release to commercially selected Execution Partner
→ Partner commencement declaration
→ In Progress
→ governed delivery
→ Internal Review
→ controlled client issue
→ Client Review
→ Completion
→ financial and closeout reconciliation
→ Closed.

### Mandatory start-payment invariant

Client acceptance may create the Project record so that invoicing, payment evidence, mobilisation, and audit have an authoritative Project context. Creation is not permission to start work.

For every positive-value Project:

- the required start-payment amount is derived from the accepted commercial terms;
- `commercial_terms.deposit_required_amount` is the current authoritative explicit deposit amount when present;
- the normal path must not ask the operator to retype the start-payment requirement during Project mobilisation;
- only `payments` records with `status = 'cleared'` count toward satisfaction of the start-payment gate;
- pending, failed, refunded, promised, invoiced, or merely referenced money does not satisfy the gate;
- the cleared amount attributable to the Project must meet or exceed the required start-payment amount, allowing only normal currency rounding tolerance;
- Partner release/session creation must be rejected server-side while the gate is unsatisfied;
- Partner commencement must also be rejected server/RPC-side while the gate is unsatisfied, even if an assignment/session exists from historical or exceptional data;
- the UI may show `Awaiting client payment` and a route to record/view settlement, but must not expose Partner release as an available normal action;
- after the gate is satisfied, the payment form/action collapses to compact evidence and the next permitted mobilisation/execution action becomes visible.

Commercial owns the terms. Payments owns settlement evidence. Project 360 consumes the resulting readiness state. No parallel payment model is permitted.

## Operator-object classification

Every operator-facing object must be classified before redesign:

| Class | Meaning | Normal treatment |
|---|---|---|
| **Action** | A human decision or intervention genuinely required now | Clear verb; temporary interaction where possible |
| **Evidence** | A governed fact/event the operator may need to inspect | Read-only, compact, attributable |
| **Derived** | A value/state computable from authoritative lineage | Display only when useful; never re-enter |
| **Internal Control** | Governance/implementation machinery needed by the system | Hidden from normal path; admin/advanced only if genuinely required |

## Interaction-depth contract

The visual depth must match task depth.

| Primitive | Use |
|---|---|
| **Page** | Persistent workspace or record |
| **Tab / working area** | Persistent aspect of a large record; one working area at a time |
| **Right Drawer / Sheet** | Contextual inspection/work without losing the record; mobile becomes sheet/full-screen surface |
| **Dialog** | Focused temporary decision/action |
| **Disclosure** | Rare/advanced detail or exceptional repair |
| **Toast / inline confirmation** | Completed action feedback; never authoritative evidence by itself |

Do not introduce draggable windows, nested modal chains, or route-specific interaction primitives without a documented product reason.

## Canonical record anatomy

Major records (Enquiry, Case, Project, Partner where applicable) should converge on:

1. **Identity** — record/client/title/reference only.
2. **Operating State** — one plain-language business statement.
3. **Next Action or Wait** — exactly one dominant permitted action or external/internal dependency.
4. **Relevant Facts** — normally no more than 3–4 facts required for the current decision.
5. **Working Areas** — selected domain tab/section, not all domains stacked vertically.
6. **Context on demand** — drawers/disclosures for evidence, history, commercial basis, advanced controls.

## Ownership boundaries

- **Acquisition** owns opportunity capture through governed Go / No-Go.
- **Case 360** owns controlled technical/commercial conversion after qualification through client acceptance.
- **Commercial** owns pricing, margin, commercial authority, quote/invoice generation basis, and partner liability basis.
- **Payments** owns actual client settlement capture and payment evidence.
- **Project 360** owns governed delivery after acceptance, but remains in mobilisation/awaiting-payment until the start-payment gate clears.
- **Execution** exposes operator intent (`Release work`, `Await Partner`, `Review delivery`) while assignment/session records remain governance machinery.
- **Documents** is the controlled registry and document workspace, not a second lifecycle.
- **Approvals** is a decision queue pointing to authoritative domain records, not a second workflow.
- **Activity/Audit** is history/evidence, not correspondence or task management.
- **Messages** is correspondence, not audit history.
- **Issues** is off-plan work, not normal waiting.

## Programme waves

### Wave 0 — Contract and inventory

- Freeze this programme contract and the lifecycle constitution.
- Maintain a complete operator-facing object inventory across routes and shared components.
- For each visible object record: operator job; classification; truth owner; visibility; editability; interaction primitive; duplicate locations; completed-state behaviour; permissions; empty/loading/error behaviour; desktop/mobile behaviour; audit requirement.
- No object receives a free pass because it is visually small.

**Exit:** lifecycle + interaction contract committed; exact branch head deploys successfully; inventory gaps explicitly listed.

### Wave 1 — Backend lifecycle truth

- Enforce start-payment gate in canonical Project readiness.
- Enforce the same invariant directly in Partner release/session Server Actions.
- Enforce the same invariant in Partner commencement RPC/path.
- Confirm commercial terms and payment ledger are sufficient for deposit/partial-payment scenarios; do not create duplicate finance fields when existing authoritative fields suffice.
- Add/extend lifecycle tests for zero payment, pending payment, partial cleared payment, sufficient cleared payment, refunded/failed money, and attempted bypass.

**Exit:** direct UI, Server Action, and RPC bypasses all fail before cleared payment; qualifying cleared payment unlocks only the next governed gate.

### Wave 2 — Shared interaction primitives

- Standard Dialog, Drawer/Sheet, Disclosure, action menu, compact evidence row, feedback pattern, and record tabs.
- Focus trap, Escape rules, return focus, scroll lock, keyboard navigation, ARIA labelling, double-submit prevention, loading/error/success states.
- Mobile transformation defined for every primitive.

**Exit:** primitives are reusable and route code does not invent competing modal/drawer implementations.

### Wave 3 — Shell and record archetype

- Reconcile global navigation and record navigation.
- Canonical record anatomy implemented.
- Remove duplicate state strips, navigation, provenance legends, metric clutter, and persistent forms that do not represent current work.
- Project 360 becomes reference implementation.

### Wave 4 — Acquisition and Case 360

- Enquiry, Step 2, Partner review, Go / No-Go, technical basis, commercial review, quote, issue, and acceptance.
- Derived lifecycle values removed from forms.
- Completed gates collapse to evidence.
- Inherited Partner evidence is not re-created as Case-owned review work.

### Wave 5 — Project mobilisation and payment

- Accepted Quote creates Project in mobilisation/awaiting-payment presentation.
- Project displays required start amount, cleared amount, and one relevant payment action/link.
- No Partner release until gate clears.
- Cleared payment becomes evidence and reveals the next mobilisation/execution action.

### Wave 6 — Execution

- Normal path is `Release to Execution Partner` with Partner, controlled scope, recipient, dates, and cadence derived where authoritative.
- Assignment/session/token machinery hidden from normal path.
- Completed release collapses to evidence.
- Normal waiting is quiet; exceptions only appear when present.
- Advanced Partner access is exceptional/repair UI.

### Wave 7 — Delivery

Replace state editing with business verbs: submit for review, approve internally, request correction, send to client, record client outcome, mark blocked. Partner/project/revision lineage is derived where authoritative. Current-cycle rules remain server-enforced.

### Wave 8 — Documents and Approvals

- One canonical `Documents needed now` presenter.
- Zero requirements render nothing.
- Signing derives authenticated identity where authoritative.
- Approve/sign/issue/request changes/archive are focused temporary actions.
- Approvals remains a queue, never a duplicate state machine.

### Wave 9 — Commercial and Payments

- Remove duplicate settlement-entry paths.
- Commercial may display receivable/payable position and link to Payments.
- Payments records actual movement/evidence.
- Partner payable evidence derives from governed delivery where possible; avoid manual confirmation booleans when evidence already exists.

### Wave 10 — Supporting workspace

Partners, CRM, Messages, Notifications, Issues, Tasks, Risk, Knowledge, Activity, Settings. Remove raw UUID entry, raw enums, data-quality vanity metrics, diagnostics from normal paths, and duplicated operational launchpads.

### Wave 11 — Registers and command navigation

Operational registers become workhorses with useful saved views such as My Work, Needs Attention, Waiting on Partner, Waiting on Client, Due This Week, At Risk, Recently Updated. Add global search/command navigation across clients, Projects, Partners, quotes, and controlled-document references.

### Wave 12 — Visual/CSS reconciliation

Remove dead/duplicate selectors and historical overrides. Standardise hierarchy for Operating State, registers, evidence, attention, dialogs, drawers, and tabs. Avoid new arbitrary card families and box-within-box presentation.

### Wave 13 — Responsive, accessibility, permissions, performance

Validate desktop/mobile independently. Hide irrelevant controls rather than presenting walls of disabled actions. Audit repeated Supabase reads, N+1 patterns, and duplicate state calculations. Simplification must not create slower or less accessible software.

### Wave 14 — Full operator simulation

Run a fresh sacrificial lifecycle without mutating Northstar merely to pass tests:

Enquiry → Intake → Partner Review → Go → Case → Technical Control → Commercial → Quote → Issue → Acceptance → Project/Awaiting Payment → Payment → Mobilisation → Partner Release → Commencement → Execution → Delivery → Internal Review → Client Issue → Client Review → Completion → Invoice/settlement → Closeout.

Capture evidence at every state on desktop and mobile.

## Per-object audit matrix

Every changed object must answer all of these before acceptance:

| Question | Required answer |
|---|---|
| What operator job does it serve? | Specific business purpose |
| Classification | Action / Evidence / Derived / Internal Control |
| Authoritative truth owner | Table/RPC/domain source |
| Should operator see it? | Yes / contextual / advanced / no |
| Should operator edit it? | Yes / exception only / never |
| Interaction location | Page / tab / drawer / dialog / disclosure |
| Duplicate elsewhere? | Locations and removal/justification |
| Completed-state behaviour | Collapse/remove/evidence rule |
| Permission behaviour | Explicit |
| Empty/loading/error behaviour | Explicit |
| Desktop/mobile behaviour | Explicit |
| Audit requirement | Explicit |

## Per-PR acceptance sheet

Every implementation PR/wave must record:

1. business rule;
2. authoritative source;
3. operator job;
4. interaction primitive;
5. duplicate check;
6. completed-state behaviour;
7. permission behaviour;
8. empty/loading/error behaviour;
9. desktop result;
10. mobile result;
11. audit effect;
12. backend invariant;
13. exact-head build/typecheck/lint result;
14. preview/runtime smoke result;
15. known debt intentionally deferred.

## Full-state operator acceptance questions

At every lifecycle state, a reviewer must be able to answer:

1. What is happening?
2. Who owns the next move?
3. What can I do right now, or what am I waiting for?
4. Is anything unnecessarily editable?
5. Is important information duplicated?
6. Is a completed form still hanging around?
7. Is database/developer terminology exposed?
8. Is an internal ID exposed without a business reason?
9. Is normal waiting presented like a problem?
10. Is the first viewport calm and decisive?
11. Can the operator act without understanding the schema?
12. Does mobile tell the same business story?
13. Can the action be bypassed through Server Action/RPC/direct database paths?

## Release discipline

- Keep `main` stable while recomposition work is incomplete.
- Prefer coherent, independently reviewable PRs/waves over a single unreviewable rewrite.
- Never merge merely because code compiles.
- Never mutate Northstar to manufacture a passing state.
- Never weaken a lifecycle gate to simplify presentation.
- If exact-head validation is unavailable, keep the work isolated.
- Any change to lifecycle ownership, payment authority, gate evidence, Partner/client authority, or stage transitions must update the Business Lifecycle Constitution in the same change.

## Immediate next implementation target

The next implementation wave is **Wave 1 — Backend lifecycle truth**, starting with the start-payment invariant. Current schema inspection confirms that the existing model already contains `commercial_terms.deposit_percent`, `commercial_terms.deposit_required_amount`, Project-linked `payments`, and payment status values including `cleared`, so the first implementation should use these authoritative objects rather than add a parallel payment model.
