# Phase 3 — Launch Validation and Reliability

## Objective

Move Overflow Partner from a feature-complete operating system to a release that is repeatedly verifiable in production.

Phase 3 is a launch/reliability phase. It does **not** add another business workflow, dashboard, payment integration or UI philosophy.

## Automated release gates

The repository now exposes two launch commands:

```bash
npm run phase3:check
PHASE3_BASE_URL=https://overflow-partner.vercel.app npm run phase3:smoke
```

`phase3:check` is part of the production build and fails when a required launch surface is missing, legacy MIDTS branding leaks into runtime source, the Workspace error boundary exposes raw thrown messages, or the canonical navigation placement contract is lost.

`phase3:smoke` adds production HTTP checks for the public site, login, policy pages, sitemap/robots, the release health endpoint and unauthenticated Workspace protection.

## Validation gates

1. Production build uses the current `main` head.
2. Public website, `/login`, policy routes and `/api/health` load without server errors.
3. Unauthenticated `/workspace` is redirected to login.
4. Supabase authentication and organisation-scoped RLS remain authoritative for the owner profile.
5. Core workflow is verified end to end:
   - Prospect / Enquiry
   - Company and Contact
   - Technical Intake
   - Case 360
   - Partner Assessment and Partner Price
   - Commercial Review
   - Client Quote
   - Payment confirmation
   - Project 360
   - Controlled Document
   - Delivery / Closeout
6. Forms show actionable validation and database errors without exposing raw implementation errors.
7. Workspace navigation works on desktop and mobile.
8. Empty, loading, error and not-found states are present and consistent.
9. No MIDTS branding remains in public or private runtime routes.
10. Metadata, accessibility labels, keyboard focus and responsive layout are reviewed.
11. Production runtime logs are clear of new 5xx errors.

## Phase 3 implementation

### 3A — Deployment alignment

- Production Vercel build must resolve to the merged `main` SHA.
- Build must pass lint, typecheck, Phase 3 static checks and Next.js production compilation.
- `/api/health` provides a minimal no-store service probe without exposing secrets.

### 3B — End-to-end workflow validation

The authenticated workflow is a controlled operational test, not an automated production data seeder.

Do not create fake production customers, quotes, invoices or payment records merely to make this checklist green. Use an explicitly identified test Case/Project or a disposable non-production environment when full mutation validation is required.

Validate relationships, audit events, state transitions, document gates and organisation scoping while following the canonical lifecycle.

### 3C — UI and navigation polish

Phase 2 already closed the information architecture. Phase 3 therefore applies the 80% stability rule:

- no navigation redesign;
- no new cockpit concept;
- no new page family;
- correct only launch-blocking inconsistency, inaccessible controls, broken responsive behaviour or misleading state presentation.

### 3D — Reliability and guardrails

Implemented baseline:

- root `global-error.tsx`;
- root `not-found.tsx`;
- Workspace error boundary hides raw thrown messages and retains a diagnostic digest when available;
- Workspace loading and not-found states remain canonical;
- automated runtime branding scan;
- automated canonical-route presence checks;
- automated navigation-placement contract check;
- minimal production service health probe.

Remaining reliability work should be evidence-led from real failures, not speculative feature expansion.

### 3E — Launch readiness

Before declaring a release launch-ready:

1. Merge the Phase 3 branch only after a READY preview build.
2. Verify the production deployment references the merge SHA.
3. Run the production smoke command.
4. Review production runtime errors for the new deployment.
5. Record any authenticated end-to-end gaps as explicit P0/P1 items.

## Severity rule

- **P0** — misrepresents business truth, bypasses a gate, breaks core navigation/authentication, loses evidence, or blocks the real client workflow.
- **P1** — materially confusing or unreliable but the workflow can still be completed safely.
- **P2** — useful improvement after launch.
- **P3** — idea / optimisation; do not delay launch.

Phase 3 is complete when P0 launch blockers are zero, P1 items are either closed or explicitly accepted, production smoke passes, and the live deployment is tied to the validated `main` commit.
