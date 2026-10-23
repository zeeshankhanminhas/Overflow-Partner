# OPOS Operator Experience Contract

**Status: ACTIVE — authoritative for workspace UI, information architecture and interaction hierarchy from PR #109 (23 October 2026).**

## Why this exists
Make OPOS easy to operate without weakening its commercial discipline. Previous overlapping product/visual/navigation documents are not permission to restore clutter, tiny typography, dark legacy interfaces, mandatory Inspect steps, extra sidebar groups or parallel funnels.

## Precedence
1. **Business authority is unchanged:** `BUSINESS_LIFECYCLE_CONSTITUTION.md`, `OPOS_COMMERCIAL_LIFECYCLE_CONTRACT.md`, `RPC_SECURITY_CONTRACT.md`, database/RLS/RPC role checks, financial gates, client/partner contractual commitments, audit, controlled document identity and versioning, and external-actor boundaries.
2. **Presentation state is governed:** `GLOBAL_STATE_PRESENTATION_CONSTITUTION.md` and `lib/presentation/` remain the single interpretation of state, owner, blockers and next permitted action.
3. **UI, IA and operator interactions:** this contract takes precedence over conflicting historical navigation maps, visual sizing tables, old UI/UX sprint directives and legacy stylesheet examples. `lib/presentation/navigationContract.ts` identifies navigation destinations and their jobs. `WORKSPACE_PRODUCT_CONTRACTS.md` and `WORKSPACE_INTERACTION_ARCHITECTURE.md` remain valid for compatible accessibility, interaction mechanics and relationship evidence.
4. **Brand:** `OPDS.md` remains authoritative for the Overflow Partner mark, public identity and controlled engineering/commercial documents, but historical document sizing/radius constraints do not override the accessible operator workspace.

If a legacy UI test, screenshot, comment or document contradicts current navigation or accessible defaults, update/retire that test or instruction rather than reverting the operator experience. Never loosen a business, security or evidence invariant to improve appearance.

## Current information architecture
**Desktop:** Outreach · Home · Opportunities · Projects · Finance · Documents. **Secondary:** My Work and More.
**Mobile:** Outreach · Home · Opportunities · Projects · More. Finance, Documents, partner/CRM master data, approval tools and settings remain available inside More or from the owning record.

- **Outreach is pre-CRM.** Cold LinkedIn contacts and pasted messages stay in separate outreach records. Only explicitly confirmed interest and a deliberate conversion may create or reuse Company, Contact and Prospect records.
- **Opportunities** is one read-only front door to existing governed Enquiries and Case 360 records, not a merged status model. Preserve old URLs and specialist registers for authoritative decisions and full pagination, not as competing top-level navigation.
- **Home/My Work** reuse one ranked business attention model. Approvals, issues, dependencies and routine tasks preserve their authoritative records.
- **Project 360** opens with next governed action. Payments and commercial controls are separate financial/authority surfaces, reached contextually.

## Default operator screen
1. Show record identity, **current operating stage**, who owns/waits, **one next permitted action**, real blockers and essential evidence first.
2. Keep required documents, tasks, communication, audit and history available in appropriately named disclosures, contextual panels or governed work surfaces. Never hide an actual blocker behind optional UI.
3. Each worklist row has one clear click target. An Inspect drawer is optional where it offers genuine preview value, **not mandatory** before opening the owning record. Avoid identical Inspect/Open buttons.
4. Preserve the full lifecycle and server actions: no UI-only override of approval, quote, advance-payment release, partner Work Order, QA, document evidence, client review, final payment or partner settlement dependencies.
5. Older deep links and record relationships must still work; supporting views must return to owning Case or Project.

## Visual and accessibility defaults
- Restrained neutral visual system, readable whitespace, no competing dashboard cards, repeated status badges, decorative gradients or rescue CSS.
- Routine body and record primary copy **14–16px**; useful secondary information **12–13px minimum** with sufficient contrast; mobile form inputs **16px**; 11–12px is only for optional eyebrows/reference metadata.
- Normal interactive touch targets **at least 44px** where feasible, with proper spacing, focus-visible styles, semantic text for statuses and reduced-motion respect. Normal text contrast target WCAG AA **4.5:1**; large text **3:1**.
- Reuse existing components and four workspace CSS layers (`workspace-base.css`, `workspace-features.css`, `workspace-surfaces.css`, `focus-first.css`). Progressively migrate obsolete declarations to owning primitives; do **not** introduce a fifth rescue stylesheet or an alternate Simple Mode.
- Desktop and mobile convey the same business truth with context-appropriate geometry.

## Superseded assumptions
The old Home/Operate/Control/Reference desktop rail, Home/Enquiries/Cases/Projects/Finance mobile navigation, Prospect-backed cold LinkedIn funnel, dark-density-first styling, mandatory 32–40px interactive controls, 10/11px normal copy, mandatory Inspect-first registers and old "every register gets 3–4 KPI cards" composition are retired as current UI requirements.

Historical plans may be retained as archives and route maps, not design authorities. This contract does **not** retire contract-specific commercial terms, billing rules, approval authority, tenant isolation or security tests.

## Acceptance gate
For changes affecting IA/UI: update the navigation contract, desktop, mobile and command palette together; test old bookmarks and pre-CRM separation; run existing workspace/lifecycle/LinkedIn/Stripe/security tests; verify an exact Vercel preview SHA; inspect authenticated desktop and mobile before merge. Do not replace a failed old-UI assertion with no test—replace it with an assertion for this current contract.
