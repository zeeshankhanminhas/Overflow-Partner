# OPOS UX simplification contract — every page and portal

**Scope:** All operator pages, Client Workspace, Partner Workspace, secure quotation, advance/final payment, review, handover, and mobile versions. Not limited to Project 360. This document specifies UI only; there are no database or business-rule changes.

## Single current decision
Every page should let a user answer within five seconds: Where am I? What is the current stage? What do I do next (or what am I waiting for)? Keep only one visually prominent next action. Other details go into relevant register views or optional disclosures. Keep the short progression indicator where it clarifies delivery.

## Navigation and information architecture
- Operator: six visible destinations: Mission Control, Opportunities, Projects, Tasks, Finance and Documents; Outreach, Cases, Accounts and Partners in **More**.
- QA walkthrough and portal previews do not belong in everyday operator navigation. Their routes remain available for authorised testing.
- Client: quotation acceptance and verified payment, project status, controlled review, final balance and approved handover in a decision-first journey.
- Partner: Work Order acceptance, commencement, updates, submissions, corrections and governed closeout.
- Technical QA diagnostics, temporary manual sign-in link generators, fingerprints and test logs belong in restricted QA tooling, not operational pages.

## Standard visual contract
1. Compact header and meaningful stage. 
2. One authoritative next action or explicit waiting dependency.
3. Active form visible when the user can take that action.
4. Optional compact progress strip.
5. Historical, financial and evidence details behind disclosure or in registers.
6. No duplicate status blocks, competing CTAs, disabled mystery actions or unnecessary technical prose.

## Mandatory safety / functional invariants
No project without verified opening payment or contractual release. Work Order acceptance must precede commencement. Internal engineering QA, revision-specific manifest verification and independent owner release precede client review. Authenticated client decisions cannot be fabricated by OP staff. Included correction entitlement is respected; partner defects remain separate; variations cannot silently authorise new price/scope/dates. Final native files require accepted client review, verified final payment and owner approval. Partner settlement requires its own gates. Keep all tenant- and role-scoped authorisation, audit trails and full original documents.

## Verification gate before launch
Run existing TypeScript, build and QA regression scripts; compare desktop and mobile screens to the original 29 October v2 prototype; authenticated role-by-role tests for operator, client and partner must prove the next action is correct and every protected flow remains reachable.

## Implementation status — 4 November 2026
Foundation pass covers shared operator desktop/mobile navigation, WorkRecord detail disclosure defaults, Client/Partner account summary disclosure, project-fact disclosure and shared account navigation. This does **not** claim complete all-page simplification. Remaining opportunity/case/project stage forms, original secure Client Portal and Partner Work surfaces, QA generator relocation, and visual E2E review still require follow-through.
