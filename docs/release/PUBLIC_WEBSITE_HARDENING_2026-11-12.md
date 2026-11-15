# OPOS public website — integrated release gates (12 November 2026)

This release is a **public marketing and intake hardening** change, not a production financial or operational lifecycle promotion.

## Gate 1 — Privacy and cookies
- [x] Cookie preference banner is limited to public marketing routes.
- [x] Vercel Analytics and Speed Insights are gated by affirmative opt-in and excluded from authenticated workspaces.
- [x] Footer offers a repeatable preference control; privacy and cookie wording describes actual implementation.
- [ ] Manually verify consent options, reload persistence, reopening, and no workspace banner in Edge and mobile browsers.
- [ ] Review all third-party storage and privacy notices with the final legal controller identity.

## Gate 2 — Enquiries
- [x] Service choices match the six canonical marketing service titles.
- [x] Backend fails closed if more than one receiving organisation is eligible. `OP_PUBLIC_INTAKE_ORGANISATION_ID` may explicitly select the OPOS tenant.
- [x] Success UI distinguishes saved enquiry from potentially delayed email queueing and displays reference.
- [ ] Authorised isolated QA browser test of public form -> right company/contact/prospect -> pending secure Step 2 -> sent and received real inbox.
- [ ] Confirm production receiving tenant and email provider dispatch credentials; provider queue success is NOT delivered-inbox evidence.
- [ ] Check spam protection and throttling before broad paid acquisition.

## Gate 3 — Landing page
- [x] Keep Outfit typography and existing brand colours.
- [x] Form focus contrast and navigation scroll offsets improved.
- [ ] Verify desktop and mobile layouts, dropdown native behaviour on Windows Edge, keyboard-only forms, zoom and Core Web Vitals on deployed preview.

## Gate 4 — Credibility
- [ ] Confirm legal entity/trading name, service address/contact details, the actual data controller and legal document owner. **No legal registration details are inferred here.**
- [ ] Independent review approval for OP-DEMO-001 (indexing and clamping fixture) and OP-DEMO-002 (roller support): coherent original CAD source, full manufacturing dimensions and GD&T, mechanical checks/fits, clashes, controlled drawings, revision history, file validity, reviewer signature. **Both remain unpublished.**
- [ ] Do not claim independent review or manufacturing readiness without source evidence.

## Gate 5 — Integrated release
- [ ] GitHub Quality Gate passes at PR head.
- [ ] Vercel preview build READY and basic route/status checks.
- [ ] Run a single read-only/isolated browser suite covering marketing routes, cookie banner vs workspace, input validation and service options.
- [ ] Authorised real inbox receipt evidence for enquiry and Step 2. Do not create synthetic leads in the production CRM merely to obtain a passing test.
- [ ] Release sign-off before merging/deploying. Reconfirm no migration/payment/lifecycle changes.

**Release policy:** A passing build is not proof that a production inbox received mail, legal disclosures are correct, or engineering demos are independently validated.
