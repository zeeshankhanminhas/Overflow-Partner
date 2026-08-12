# Global State Presentation Constitution

Status: normative presentation architecture

This document governs how Overflow Partner turns authoritative business state into operator-facing UI. It does not redefine the Business Lifecycle Constitution or database authority.

## 1. Core architecture

The product must follow this chain:

**Domain truth → canonical presentation state → UI surface**

A page, card, register or button must not independently infer a different business meaning from the same raw database state.

The canonical presentation contract lives under `lib/presentation/` and exposes, as applicable:

- operating state
- headline and summary
- who owns or is being waited on
- next action
- whether that action is currently available
- blockers
- warnings
- completed evidence
- approval requirement
- primary contextual actions

## 2. Stage is not the next action

A lifecycle stage describes where a record is. It does not automatically determine what the operator can do next.

Example:

`project_stage = in_progress` does **not** mean `Review Partner delivery`.

If the current execution cycle has no Partner delivery submission, the presentation state is:

- State: Partner execution
- Waiting on: Execution Partner
- Next: Await Partner delivery
- Review action: unavailable

Only a current-cycle delivery plus the required delivery-control state can produce `Review Partner delivery`.

## 3. Waiting is not blocked

Normal external dependency must not be shown as failure or attention.

Examples:

- waiting for client intake
- waiting for Partner Assessment
- waiting for Partner commencement
- waiting for Partner delivery
- waiting for client review

These are `waiting` states unless they become overdue, exceptional or otherwise off-plan.

`blocked` is reserved for a real condition that requires corrective intervention.

## 4. Approval is not action

An approval means a person with explicit authority must make a governed decision.

The Approvals workspace aggregates existing authoritative decisions. It does not create another workflow or duplicate status.

Examples of approvals:

- Go / No-Go
- controlled document approval
- commercial approval
- Partner payable approval
- governed client-release approval where required
- project closeout authority where required

Examples that are not approvals:

- open Partner workspace
- await Partner commencement
- submit Partner delivery
- record progress
- open Delivery Control
- send a package after it has already been authorised

## 5. One source of presentation truth

Record pages and portfolio/register pages must use the same presentation interpretation.

The Project portfolio must not show a different next action from Project 360 for the same evidence state.

Mission Control must not classify a normal Partner/client wait as an issue merely because progression is not yet possible.

## 6. Evidence rules

Zero is not automatically useful information.

- `0 of 0 documents` must not be shown.
- an empty evidence panel must not render merely because an evidence component exists.
- zero blockers may be shown only when it reassures the current decision; otherwise omit it.
- an empty delivery package is `Awaiting Partner delivery`, not `Review delivery`.

Evidence provenance remains explicit:

- OP controlled
- Partner reported
- Client evidenced
- System calculated

## 7. Approval workspace

`/workspace/approvals` is a cross-product decision queue.

It may aggregate only authoritative existing approval sources. The initial sources are:

- Acquisition Go / No-Go decisions
- commercial review approval
- controlled document approval
- Partner payable approval

The queue links back to the authoritative record where the decision is executed.

No `approvals` table is created solely to support the UI.

## 8. Information hierarchy

The first meaningful viewport of a record should answer, in this order:

1. Where am I?
2. What is happening now?
3. Who owns the next move?
4. What happens next?
5. Is anything genuinely blocking or off-plan?
6. What evidence supports that state?

Audit, history and metadata must remain available without competing with the current operating decision.

## 9. CSS balance

Presentation reconciliation must not create another generic card system.

Rules:

- Prefer one broad operating surface over several equal-weight cards.
- Use borders only to establish structure or attention.
- Do not override generic `.card` or `.button` styles from the presentation layer.
- Avoid large empty containers.
- Avoid tiny administrative table text for primary operating information.
- Preserve controlled whitespace and readable density.
- Mobile layouts must preserve state, waiting owner and next action before secondary metadata.
- Do not add another navigation layer to surface presentation state.

The scoped implementation stylesheet is `app/workspace/global-presentation.css`.

## 10. Change control

Any future change that introduces a new local interpretation of lifecycle state should instead extend the canonical presentation layer.

If a new domain requires a presentation adapter, it belongs under `lib/presentation/` and should use the same `OperatingPresentation` contract where practical.

A feature is not presentation-complete merely because it compiles. Its rendered state must be tested against the lifecycle presentation matrix and a realistic operator journey.
