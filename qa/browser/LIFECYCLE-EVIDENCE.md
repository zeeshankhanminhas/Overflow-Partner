# OPOS browser lifecycle: evidence and controlled next gate

## What this PR actually tests
- Opens two separate Chromium browser contexts against the approved QA Vercel preview.
- Signs in as synthetic Northfield client and execution partner.
- Derives their project links from each role's actual dashboard.
- Verifies both users see the same governed Project 360, next action, responsible role and lifecycle summary.
- Verifies neither role can directly access the other portal's project route.
- Leaves the closed Northfield baseline unchanged, creates no payments, and uploads no files.
- Runs only by reviewed `main` manual dispatch with GitHub's `opos-qa-auth` protected environment. Secrets are never passed to pull-request jobs.

## Not yet established by these tests
This is **multi-role browser continuity**, not an end-to-end commercial lifecycle. Neither the existing five read-only cases nor this new case validates a new customer's journey from opportunity through closure.

A full write-enabled journey must use a *new, disposable organisation, customer and partner*, never Northfield. All business transitions must occur through the browser's actual user-facing actions, and independently validated database evidence must be read-only. Setup fixtures may be seeded only in ephemeral infrastructure; setup inserts and triggered database calls **cannot** count as business transitions.

## Proposed full write-enabled browser evidence gates
1. New synthetic enquiry and consented account created by operator UI.
2. Requirements and formal feasibility/partner assessment approved through the appropriate workspaces.
3. Approved quote issued, client identity and contractual acceptance recorded from client UI.
4. Fake, locally signed opening payment through test HTTP endpoint; verify one and only one project is created. No live Stripe.
5. Partner agreements, work order and commencement accepted from partner UI.
6. Partner progress, controlled CAD/document submission and operator internal technical QA.
7. Controlled view-only client review and an explicit client response.
8. Correctly valued final payment, restricted final file release and owner approval.
9. Recorded partner settlement evidence and operator-governed closure.

Each gate must emit PASS/FAIL/BLOCKED evidence with the actual UI route and proof of the resulting state, and contain at least one negative authorisation assertion. Never disable triggers, write business state directly by SQL, or use `service_role` to bypass application gates. No actual bank transfer, customer email or production resources.

## Delivery requirements before first write-enabled run
- A disposable, isolated Supabase/PostgREST database and dedicated preview bound exclusively to it; refuse to run on hosted QA or production without separate explicit scope approval.
- Disposable auth users and operator/client/partner credentials, never credentials from untrusted PR heads.
- Test-only, locally signed Stripe events, not a real payment processor.
- Stable UI selectors or accessible names for the complete orchestration, partner review, controlled documents, and financial release.
- A reset/cleanup policy for the ephemeral test database and evidence retention that excludes PII and credentials.
- Independent review of PR #127's schema migration and document reference lookups before production promotion.

## Current release gate
**Production NO-GO.** This branch is a non-destructive prerequisite and does not authorise merging PR #127, hosted migration changes, or production release.
