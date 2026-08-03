# Phase 3 — Launch Validation and UI Polish

## Objective

Move Overflow Partner from feature-complete Phase 2 code to a deployment-validated, usable internal operating system.

## Validation gates

1. Production build uses the current `main` head.
2. Public website, `/login`, and authenticated Workspace routes load without server errors.
3. Supabase authentication and organisation-scoped RLS work for the owner profile.
4. Core workflow is verified end to end:
   - Prospect
   - Company and Contact
   - Lead
   - Technical Intake
   - Partner and Partner Quote
   - Commercial Review
   - Client Quote
   - Project
   - Controlled Document
5. Forms show actionable validation and database errors.
6. Workspace navigation works on desktop and mobile.
7. Empty, loading, error, and success states are consistent.
8. No MIDTS branding remains in public or private routes.
9. Metadata, accessibility labels, keyboard focus, and responsive layout are reviewed.
10. Production runtime logs are clear of new 5xx errors.

## Phase 3 workstreams

### 3A — Deployment alignment
- Force a production build from current `main`.
- Confirm deployed Git SHA.
- Review build and runtime logs.

### 3B — End-to-end workflow validation
- Run controlled test records through every workflow stage.
- Verify relationships, activity events, status transitions, and RLS.

### 3C — UI and navigation polish
- Responsive Workspace shell.
- Active navigation states.
- Consistent cards, forms, tables, spacing, typography, and feedback messages.

### 3D — Reliability and guardrails
- Error boundaries and not-found states.
- Safe query fallbacks.
- Duplicate prevention and transition guards.
- Document reference and project-number integrity.

### 3E — Launch readiness
- Final route audit.
- Production smoke test.
- Runtime-error review.
- Launch-readiness summary and remaining non-blocking backlog.
