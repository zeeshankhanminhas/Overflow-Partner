# Overflow Partner UI Language Constitution

Status: Normative presentation-language standard

Implementation: PR #18 — UI Language & Microcopy Lock

This document governs user-facing language only. It does not rename database enums, columns, tables, routes, RPCs or audit event keys.

## 1. Principle

Human language first. Governance language second.

The operator should understand the business situation before seeing the formal evidence terminology that supports it.

A screen must answer, in plain language:

1. Where am I?
2. What is happening?
3. Who are we waiting on?
4. What is blocking progress?
5. What do I do next?

Formal governance terms remain available in evidence, audit and helper text when they add precision.

## 2. Canonical business nouns

Use these terms in primary UI:

- Enquiry — pre-Case Acquisition record
- Case / Case 360 — qualified commercial opportunity
- Project / Project 360 — accepted delivery engagement
- Execution Partner — external engineering delivery party
- Partner Assessment — pre-commercial feasibility, capacity and price assessment
- Partner Price — Execution Partner commercial input
- Commercial Review — internal sell-price / margin approval
- Client Quote — controlled commercial offer
- Partner Execution — external engineering execution period
- Partner Delivery — engineering output submitted by the Execution Partner
- Client Delivery — approved controlled package sent to the client
- Issue — operational exception or blocker when the operator does not need the formal exception class
- Action — operator task when the operator does not need the technical task model

Do not surface `lead` as a business noun. `lead` remains a technical compatibility term only.

## 3. Canonical verb system

Use one verb for one type of business action:

- Create — create a governed record
- Send — put something with an external party in ordinary human-facing UI
- Issue — controlled formal external release when the distinction matters
- Record — capture evidence of something that already happened
- Submit — send work into a review/gate
- Approve — governed internal approval
- Release — authorise work to an Execution Partner
- Declare / Confirm — Partner-originated formal assertion
- Resolve — close a blocker or issue
- Close — terminal lifecycle action

Avoid generic verbs such as Advance, Process, Proceed, Update or Action when a specific business verb exists.

## 4. Human-first stage language

Internal enum names remain unchanged. Primary UI uses:

- mobilisation → Mobilisation
- ready_for_execution → Ready to release
- in_progress → Partner execution
- internal_review → Internal review
- partner_correction → Partner correction
- ready_for_client_issue → Ready to send
- issued_to_client → Sent to client
- client_review → Client review
- completion → Delivery complete
- closed → Closed

## 5. Evidence provenance

Exactly four primary provenance labels are permitted:

- OP controlled
- Partner reported
- Client evidenced
- System calculated

Do not introduce synonyms such as system gate, customer provided, internally verified, partner evidence or system generated unless a specific legal or operational distinction requires it.

## 6. Primary copy vs governance copy

Primary UI:

> Waiting for MIDTS to start work

Supporting governance copy:

> Partner commencement has not been confirmed yet.

Primary UI:

> Send approved delivery to client

Supporting governance copy:

> Recording this creates the controlled client transmittal evidence for the current execution cycle.

Primary UI:

> Add delivery files

Supporting governance copy:

> Files become immutable evidence when the Partner Delivery is submitted.

## 7. Blockers

State the missing thing, not the database condition.

Preferred:

- Partner commencement required
- Client acceptance evidence required
- Approved Scope of Work required
- Partner delivery files required
- Client outcome required

Avoid:

- Stage readiness failed
- Project cannot advance
- Required condition not met
- partner_commencement_declaration missing

## 8. Buttons

Buttons must describe the business result.

Preferred:

- Send technical intake
- Send Partner assessment
- Record Go / No-Go
- Create Case 360
- Set commercial position
- Send Client Quote
- Record client acceptance
- Release to Execution Partner
- Review Partner delivery
- Send approved delivery to client
- Record client outcome
- Close project

Avoid using internal implementation terms in button labels.

## 9. Navigation

Navigation names the thing the operator wants to find, not its storage model.

Use:

- Enquiries
- Cases
- Partner assessments
- Projects
- Client quotes
- Execution Partners
- Issues
- Actions
- Documents
- Messages
- Executive view

Technical route names may remain unchanged.

## 10. Error language

Never expose raw PostgreSQL, Supabase, enum, RLS, RPC, table or constraint language as the primary operator error.

Errors should contain:

1. what the operator needs to know;
2. what they can do next.

Technical diagnostics belong in logs and audit tooling.

## 11. Sentence style

- Prefer short active sentences.
- Prefer one idea per sentence.
- Use sentence case.
- Use `Partner` only when the current context clearly identifies the Execution Partner; otherwise use `Execution Partner`.
- Use `client`, not `customer`, after Case creation unless the source interaction is explicitly still Acquisition/customer intake.
- Do not use CRM jargon in the operating UI.
- Do not use SaaS jargon such as orchestration, pipeline, workflow engine or state machine in operator copy.

## 12. Change control

Any PR that introduces a new primary business noun, action verb, stage label or provenance label must update this constitution in the same PR.

Database terminology may diverge for compatibility, but presentation language must remain canonical.
