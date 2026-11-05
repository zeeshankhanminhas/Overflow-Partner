# OPOS — Information Architecture Contract v1
**Decision:** Approved direction, implementation in progress.
**Visual reference:** OPOS Visual Review v2 (Mission Control, Opportunity, Register, Case 360, Project 360, Outreach, Client Portal, Execution Partner Portal).
**Implementation branch:** `design/opos-decision-first-ia`.
**Principle:** One next meaningful decision, one authoritative business state, zero duplicate descriptions.

## 1. Global information model
The business runs one uninterrupted lifecycle:
`Opportunity → Requirements → Feasibility → Commercial Offer → Contractual Commitment → Mobilisation → Execution → Quality Assurance → Delivery → Payment Settlement → Closure`.

Business objects remain separate:
- **Outreach conversation**: pre-CRM manual LinkedIn engagement. No cold email or Step 2 until expressed interest.
- **Opportunity (Acquisition)**: consented or inbound prospect; secure requirements and feasibility. Do not duplicate it as a separate sales funnel.
- **Case 360**: the commercially governed pre-project record, approvals, pricing, quote, acceptance and advance request.
- **Project 360**: only after advance **received and verified**. Mobilisation, work-order acceptance, execution, QA, client review, settlement and closure.
- **Company / Contact**: CRM master records, *not* top-level work stages.
- **Documents / Finance / Partners / Activity**: shared evidence and operational capabilities linked to owning records.

## 2. Navigation
Top-level operator navigation (7 groups maximum):
1. **Home** → Mission Control (decisions, exceptions, short next-up queue).
2. **Outreach** → LinkedIn prospect conversations and manual engagement.
3. **Work** → Opportunities, Cases and Projects. Distinct registers; contextual workspaces underneath.
4. **Partners** → execution partner directory and qualifications.
5. **Finance** → money received, due, reconciled and payable.
6. **Documents** → controlled evidence and document registry.
7. **Administration** → settings, delivery diagnostics, audit and low-frequency utilities.

Do not give Approvals, Messages, Risk, Companies, Contacts or Tasks equal top-level weight. Present these within their owning work and direct navigation/search. Approval and urgent tasks appear on Mission Control.

The **Client Portal** and **Execution Partner Portal** are distinct, independently branded experiences without internal operator navigation.

## 3. Four screen responsibilities
- **Mission Control** = what needs human intervention across the business now?
- **Register** = which work item am I looking for or managing?
- **Record Workspace** = what is this object's verified state, ownership and one next decision?
- **Review / Portal / Intake** = one constrained, authorised transaction, evidence-first.

There must not be second 'status summaries', parallel 'next-action cards', a dashboard inside every record, or developer-only controls in standard usage.

## 4. State-to-interface truth contract
- **Action needed:** primary CTA + decision reason, owning role and consequence.
- **Waiting:** no fake CTA; who/what is outstanding, when requested, valid escalation only if condition met.
- **Blocked:** explicit blocker, resolution owner, evidence, no invalid advance action.
- **Failed:** failure source and safe retry path, preserving idempotency and audit.
- **Completed:** proof and timestamp; no action button to repeat completed work.
- **Unknown/unverifiable:** explicitly unverified; do not fake certainty.

For email, clearly distinguish `queued`, `provider-accepted`, `confirmed-delivered` (only if provider reports), `failed`, and `not configured`. Never infer delivered from a queued record.

## 5. URL migration map (do not cut over prematurely)
| New operator intent | Existing route | Replacement status |
|---|---|---|
| Home | `/workspace` | New isolated shell, in progress |
| Outreach | `/outreach` | New view pending; existing behaviour preserved |
| Work / Opportunities | `/workspace/acquisition/prospects` | New register, in progress |
| Opportunity detail | `/workspace/acquisition/[id]` | New detail view, in progress |
| Work / Cases | `/workspace/leads` | Pending |
| Case detail | `/workspace/leads/[id]` | Pending |
| Work / Projects | `/workspace/projects` | Pending |
| Project detail | `/workspace/projects/[id]` | Pending |
| Partners | `/workspace/partners` | Pending |
| Finance | `/workspace/payments` | Pending |
| Documents | `/workspace/documents` | Pending |
| Client Portal | `/client-portal` | Pending |
| Execution Partner Portal | existing secure partner route(s) | Confirm exact route before migration |

Provisional implementation routes live under **`/opos-next`** and are **not** production routing. They must share one new style system without importing the legacy workspace CSS. Replace each existing route only when its equivalent passes business and visual regression.

## 6. Acceptance gates
1. Visual reference set accepted in principle by product owner.
2. Actual new shell, Home and register verified against approved desktop and mobile designs.
3. Detail workspace shows one governing state and next decision, with backend truth.
4. Outreach, Case, Project, Finance and partner/client interfaces follow same design language.
5. End-to-end user journeys, permissions, documents, email, payment and audit checks pass.
6. Redirect / route cutover only after approved parity. Do not merge unfinished presentation into `main`.

## 7. Development controls
- Preserve Supabase data and authorisation boundaries; no schema reset.
- Avoid importing legacy workspace styles into new UI.
- New pages read canonical data, not mock records.
- A 'successful build' is a code quality gate, **not** proof of visual conformity.
- Add screenshot snapshots and keyboard/mobile checks before any visual signoff.

**Outcome:** OPOS is a decision-and-execution system with an interface that makes complex work feel simple.