# OPOS 1.0 — Stage-based external access and unified navigation decision

**Decision owner:** OPOS Editor / Controller · **Confirmed:** 15 November 2026
**Status:** Approved product policy; implementation and live release require separate evidence and sign-off.
**Scope:** OPOS Controller, prospective clients, quotation-stage clients, active clients, feasibility-review partners, execution partners. This is not an authentication or financial-release bypass.

## Binding rules

1. **Not every prospect becomes a workspace user.** A captured prospect or Step 2 technical-intake recipient gets one purpose-limited, short-lived secure intake link. The link grants access only to its assigned intake and attached files. It is not a Client dashboard account.
2. **Pre-contract partner feasibility is not mobilisation.** An NDA/eligibility-checked prospective Execution Partner may receive a short-lived review link to the minimum appropriate technical pack for feasibility/capacity/costing; no full Partner dashboard, unrelated opportunity, client identity unless expressly authorised, OP margin or client quotation. No formal work instruction, execution, payment authority or final files.
3. **Quotation-stage client has only quotation services.** A controlled link may expose the current issued quote, decision, authorised signatory confirmation and verified payment instructions. No active-project status, deliverables or workspace membership is implied merely by quote acceptance or a payment checkout session.
4. **Client project workspace opens only after authoritative project release.** Current quote acceptance, contractual conditions and verified opening-payment evidence (or documented approved PO/credit/no-advance contractual exception where explicitly allowed) must be confirmed server-side; exactly one project is created via the governed lifecycle. An active client sees only their organisation's projects, review tasks, documents permitted for current release and payments. A client may access their quotation link earlier without obtaining this workspace.
5. **Partner execution workspace opens only after separate mobilisation.** The project and approved controlled scope must exist; the selected partner must be assigned, the formal Work Order issued and accepted where required, and OP execution release authorised. A feasibility response does not satisfy this. Active partner links show only their assignment's scoped work, due actions, allowed deliverables, controlled project communication and permitted settlement status.
6. **Permission always enforced on the server.** Every page, server action, API, signed file and database query must revalidate the token/user, role, organisation, exact resource, expiry, current quote/project/work-order state and record-specific release authority. UI labels and menu visibility are never an authorisation check. Do not rely on URL obscurity, cached state, fabricated QA fixtures or a client-supplied `isPaid` flag.
7. **One visual system, role-specific information architecture.** Every OPOS application surface (Controller, Client, Execution Partner, secure intake/review/payment/error, mobile and popovers) shares the verified black UI. Only actual white engineering/document/PDF/print paper remains light. The public marketing site is out of scope.
8. **No premature execution or disclosure.** A Partner Review Request is not a Work Order; client quote acceptance is not verified payment; a Stripe checkout redirect is not cleared funds; payment is not controlled-document release. Existing QA, contract, IP, tenant/RLS, audit and final-settlement/owner-approval gates are unchanged.

## Launch 1.0 navigation, deliberately lightweight

| Audience and stage | Entry | Permitted product navigation | Explicitly unavailable |
| --- | --- | --- | --- |
| Prospect, Step 2 | Time-limited Technical Intake link | Requirement form, permitted source files, submit/confirmation | Full dashboard, finance, other cases |
| Feasibility partner | Time-limited governed Partner Review link | Relevant scope/files, assessment, capability and quoted partner fee, response status | Full Partner dashboard, client fee/OP margin, execution permission |
| Quotation client | Current issued quote portal link | Current quote, accept/decline/request time, verified opening payment and status | Active project register, final files, internal review |
| Active client, commercially released | Authenticated/authorised Client Workspace | Home/Next Action, My Projects, Reviews, Documents, Payments and contextual communications | Controller registers, partner cost, unreleased documents |
| Mobilised Execution Partner | Authenticated/authorised Partner Workspace or assignment-scoped secure execution link | Home/Next Action, Assigned Work, Work Order, progress, permitted upload, payment status | Other partners' assignments, OP commercial markup, client portal |
| Controller | Existing database-backed Controller Workspace | **Desktop:** Outreach, Home, Opportunities, Projects, Finance, Documents. **Mobile:** Outreach, Home, Opportunities, Projects, More. Contextual sections available through records/More. | No invented second authority or navigation-based bypass |

**Presentation principle:** One clear Next Action and current owner/blocker per eligible stage; avoid large empty portals, duplicate forms and artificial accounts. User access can be narrower than the person/organisation's CRM status. The Work Order remains a separate governed release instrument.

## Nonnegotiable test evidence before production

- Positive and negative cases at each stage including expired/invalid/cross-tenant tokens and role changes.
- Unpaid accepted quotation never creates active dashboard or execution assignment.
- Valid verified PO/no-advance exceptions honour the *actual documented quote terms* and approval, not a generic switch.
- Pre-payment feasibility partner cannot see full project dashboard, client fees, other opportunities or execution actions.
- Client and Partner signed sessions cannot view each other's records or Controller routes.
- Client final download remains blocked until reviewed current revision, final settlement and distinct OP owner release approval.
- Current Controller navigation routes, deep links, mobile More, command palette and keyboard focus function with identical black visual system.
- Isolated QA only. No production RLS, schema, Stripe secrets or payment initiation from visual tests. Screenshots of authenticated private data require an explicitly approved redaction/retention policy.

## Implementation boundaries

This policy is **not evidence** that Client/Partner authenticated dashboards, every external link or all release gates have passed. In particular, the existing `/client-portal`, `/partner-review/[token]`, `/intake/[token]` and `/execution/[token]` are scoped link surfaces; they must not be misrepresented as an authenticated multi-project Client/Partner workspace.

Authority precedence: `BUSINESS_LIFECYCLE_CONSTITUTION.md`, `OPOS_COMMERCIAL_LIFECYCLE_CONTRACT.md`, existing RLS/RPC and signed-token rules retain precedence over this presentation contract in any conflict.
