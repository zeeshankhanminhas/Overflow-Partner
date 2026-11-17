# OPOS 1.0 — Stage-based external access and unified navigation decision

**Decision owner:** OPOS Editor / Controller · **Confirmed:** 15 November 2026
**Status:** Approved product policy; strict paid-only dashboard eligibility confirmed 16 November 2026. Implementation and live release require separate evidence and sign-off.
**Scope:** OPOS Controller, prospective clients, quotation-stage clients, active clients, feasibility-review partners, execution partners. This is not an authentication or financial-release bypass.

## Binding rules

1. **Not every prospect becomes a workspace user.** A captured prospect or Step 2 technical-intake recipient gets one purpose-limited, short-lived secure intake link. The link grants access only to its assigned intake and attached files. It is not a Client dashboard account.
2. **Pre-contract partner feasibility is not mobilisation.** An NDA/eligibility-checked prospective Execution Partner may receive a short-lived review link to the minimum appropriate technical pack for feasibility/capacity/costing; no full Partner dashboard, unrelated opportunity, client identity unless expressly authorised, OP margin or client quotation. No formal work instruction, execution, payment authority or final files.
3. **Quotation-stage client has only quotation services.** A controlled link may expose the current issued quote, decision, authorised signatory confirmation and verified payment instructions. No active-project status, deliverables or workspace membership is implied merely by quote acceptance or a payment checkout session.
4. **Client project workspace is paid-only.** A Client dashboard is allowed only when an authoritative project exists, the currently accepted quote has a matching, *verified positive opening-payment record*, and an explicitly provisioned Client account is bound to the correct client organisation. PO, credit or approved no-advance project release can remain lawful under its governing contract, but **never substitutes for actual verified funds for dashboard eligibility**. Other client interactions continue through purpose-limited secure links. Access remains limited to that client's authorized paid projects, reviews, documents, payments and communications.
5. **Partner dashboard is paid-only and mobilisation-gated.** An active Partner dashboard requires *the same verified positive opening-payment record*, a project, approved controlled scope, explicit Partner assignment, formally issued and accepted Work Order where required, and OP execution authorization. A feasibility response, PO or no-advance exemption does not unlock a Partner dashboard. Before eligibility, the Partner receives only its appropriately scoped, authorized secure feasibility/review link. Paid project data for an unrelated Partner is never visible.
6. **Permission always enforced on the server.** Every page, server action, API, signed file and database query must revalidate the token/user, role, organisation, exact resource, expiry, current quote/project/work-order state and record-specific release authority. UI labels and menu visibility are never an authorisation check. Do not rely on URL obscurity, cached state, fabricated QA fixtures or a client-supplied `isPaid` flag.
7. **One visual system, role-specific information architecture.** Every OPOS application surface (Controller, Client, Execution Partner, secure intake/review/payment/error, mobile and popovers) shares the verified black UI. Only actual white engineering/document/PDF/print paper remains light. The public marketing site is out of scope.
8. **No premature execution or disclosure.** A Partner Review Request is not a Work Order; client quote acceptance is not verified payment; a Stripe checkout redirect is not cleared funds; payment is not controlled-document release. Existing QA, contract, IP, tenant/RLS, audit and final-settlement/owner-approval gates are unchanged.

## Launch 1.0 navigation, deliberately lightweight

| Audience and stage | Entry | Permitted product navigation | Explicitly unavailable |
| --- | --- | --- | --- |
| Prospect, Step 2 | Time-limited Technical Intake link | Requirement form, permitted source files, submit/confirmation | Full dashboard, finance, other cases |
| Feasibility partner | Time-limited governed Partner Review link | Relevant scope/files, assessment, capability and quoted partner fee, response status | Full Partner dashboard, client fee/OP margin, execution permission |
| Quotation client | Current issued quote portal link | Current quote, accept/decline/request time, verified opening payment and status | Active project register, final files, internal review |
| Active client, verified opening payment | Authenticated/authorised Client Workspace | Home/Next Action, My Projects, Reviews, Documents, Payments and contextual communications | Controller registers, partner cost, unreleased documents |
| Mobilised Execution Partner, verified opening payment | Authenticated/authorised Partner Workspace or assignment-scoped secure execution link | Home/Next Action, Assigned Work, Work Order, progress, permitted upload, payment status | Other partners' assignments, OP commercial markup, client portal |
| Controller | Existing database-backed Controller Workspace | **Desktop:** Outreach, Home, Opportunities, Projects, Finance, Documents. **Mobile:** Outreach, Home, Opportunities, Projects, More. Contextual sections available through records/More. | No invented second authority or navigation-based bypass |

**Presentation principle:** One clear Next Action and current owner/blocker per eligible stage; avoid large empty portals, duplicate forms and artificial accounts. User access can be narrower than the person/organisation's CRM status. The Work Order remains a separate governed release instrument.

## Nonnegotiable test evidence before production

- Positive and negative cases at each stage including expired/invalid/cross-tenant tokens and role changes.
- Unpaid accepted quotation never creates active dashboard. No dashboard for PO, credit or no-advance exception without verified payment, even if a governed project exists.
- Valid verified PO/no-advance exceptions honour the *actual documented quote terms* and approval for their governed business process, but not for dashboard access.
- Pre-payment feasibility partner cannot see full project dashboard, client fees, other opportunities or execution actions.
- Client and Partner signed sessions cannot view each other's records or Controller routes.
- Client final download remains blocked until reviewed current revision, final settlement and distinct OP owner release approval.
- Current Controller navigation routes, deep links, mobile More, command palette and keyboard focus function with identical black visual system.
- Isolated QA only. No production RLS, schema, Stripe secrets or payment initiation from visual tests. Screenshots of authenticated private data require an explicitly approved redaction/retention policy.

## Implementation boundaries

This policy is **not evidence** that Client/Partner authenticated dashboards, every external link or all release gates have passed. In particular, the existing `/client-portal`, `/partner-review/[token]`, `/intake/[token]` and `/execution/[token]` are scoped link surfaces; they must not be misrepresented as an authenticated multi-project Client/Partner workspace.

Authority precedence: `BUSINESS_LIFECYCLE_CONSTITUTION.md`, `OPOS_COMMERCIAL_LIFECYCLE_CONTRACT.md`, existing RLS/RPC and signed-token rules retain precedence over this presentation contract in any conflict.

## 16 November 2026 — strict dashboard activation decision

**Verified opening payment is mandatory for both role dashboards.** A checkout success screen, unsigned payment notification, acceptance alone, signed Work Order alone, manual toggle, purchase order, or no-advance exception is not evidence of paid status. Only validated opening-payment evidence reconciled to the exact project/quote in the authoritative finance records qualifies; it must be checked at every request. No backfilled or fake QA flag grants access.

Before verified payment, issue no login/dashboard invitation. Use only the existing time-limited, resource-scoped Step 2, partner feasibility, quote and permitted review links. Paid-only dashboard views must not rely on frontend hiding or permissive organisation-wide RLS: server authorization must bind each authenticated external user to their exact client or partner identity and the paid project, and exclude Controller and unrelated records. Partner dashboard additionally requires a valid assigned, accepted and authorized execution Work Order. Do not create external accounts with internal `profiles` organisation membership merely to make login work; use a scoped and audited external access grant instead.

**Important:** Paid-only portal implementation, access provisioning, route separation and authenticated multi-role QA are still pending until independently evidenced. No claim of full external dashboards or production readiness follows from this policy alone.
