# OPOS public front-end release gate — 13 November 2026

Scope: marketing website, public document previews/downloads, unauthenticated enquiry, and secure Sign In entry. Operational QA and payment release are separate gates. **Do not interpret a green build or mocked response as production launch approval.**

## Automated in isolated browser CI

Workflow: `.github/workflows/public-frontend-preflight.yml` (no credentials). Chromium opens a local Next.js production build. Assertions cover:

- 14 marketing and login HTML routes with HTTP 200.
- Desktop (1440px), tablet (768px) and mobile (390px): home, assurance, document templates, contact, no document-wide horizontal overflow, navigation and login.
- Cookie preference decline, footer reopen and absence on secure login.
- Actual generated Capability PDF (2 pages) and illustrative Handover PDF (3 pages), HTTP content type, download header, A4 dimensions.
- Public form field/service selection, simulated successful response and reference, simulated 503 and visible accessible error. Interception is **before** /api/intake reaches a network or database.

## Mandatory pre-launch checks not simulated by CI

1. **Anonymous public access:** Vercel project `overflow-partner` reports SSO protection enabled for default domains; no custom project domain is currently attached. Verify that an external, signed-out visitor sees the actual OPOS homepage, /contact, /assurance and both PDFs without Vercel sign-in. The CI workflow includes a read-only public-homepage probe only on manual dispatch. Do not remove authentication from any protected application routes.
2. **Real enquiry ownership:** Verify production owner routing resolves exactly one authorised organisation (`OP_PUBLIC_INTAKE_ORGANISATION_ID` where needed). In approved isolated QA, submit a synthetic enquiry and verify one prospect assigned to the correct owner, receipt/reference, Step 2 invite status and provider dispatch to an approved test mailbox. Inspect inbox delivery separately; queued does not mean delivered. Do not send synthetic enquiries to production.
3. **Secure login:** Confirm valid existing Controller/Client/Partner logins and invalid credentials on reviewed isolated QA after release candidate deployment. No public registration or shortcuts. Legacy protected authenticated smoke is a separate suite.
4. **Browser review:** Check keyboard and focus, visible links/buttons, form validation, tablet/mobile document viewer, and both PDF download filenames/page counts on reviewed deployment. Local CI does not establish public routing, production email or a physical-device review.
5. **Legal and claims:** Confirm accurate business identity/privacy contact before inviting real prospects. Keep unapproved CAD demonstrations unpublished; illustrative assurance templates must remain clearly marked as examples.

## Decision

**Fail closed:** Keep public launch approval pending until anonymous domain access, end-to-end real enquiry acknowledgement to an authorised test mailbox, and reviewed deployment smoke all pass. Operational payments and final customer handover require their own separate production approval.
