# OPOS browser QA — safe setup and execution

## What is implemented

The read-only Playwright Chromium smoke suite verifies the Controller, Client and
Partner sign-in forms, explicit workspace destinations, anonymous portal redirects
and a rejected external login-return URL. It targets an allowlisted isolated-QA
Vercel preview; there are **no test-user credentials, Gmail passwords or writes**.

The separate existing fake-inbox integration tests are not equivalent to real Gmail
delivery or authenticated three-role browser acceptance.

## Initial test workflow

GitHub Actions → **Quality Gate** → **browser-smoke** job.

The browser-smoke job runs automatically on the existing QA release PR against
main. It does not run on the production branch or other PRs. It uses pinned Playwright 1.65.0,
Chromium, screenshot/trace capture on failures and a seven-day HTML report.

The bootstrap target is the manually verified OPOS isolated-QA preview.
For lasting coverage, set the repository Actions variable
`OPOS_QA_BASE_URL` to the exact current preview address for the release branch.
Never point it at `main`, the production custom domain or a live-payments site.

For a different preview hostname, explicitly review the allowed hostname pattern
in `playwright.config.mjs` first. An accidental production target must fail closed.

## Three independent test identities (later stage)

Gmail's plus addressing can direct three independent OPOS email identities to
one mailbox:

- `yourname+controller@gmail.com`
- `yourname+client@gmail.com`
- `yourname+partner@gmail.com`

These must become **three separate Supabase Auth users** with separately checked
internal/Client/Partner memberships in the isolated QA project. The inbox being
shared never means identity or access is shared. First check existing QA
memberships and avoid duplicates. Never reuse production admin credentials.

Create unique passwords for these *OPOS test accounts*, not your Gmail password,
and enter them only in approved secret stores, not in chat or source code.
Do not save browser storage-state fixtures or authentication tokens in GitHub.

## What comes after smoke

1. Vercel Authentication is enabled on preview deployments. In Vercel's project
   Settings → Deployment Protection → Protection Bypass for Automation, create a
   distinct bypass key for browser QA. Save the value DIRECTLY as the GitHub
   repository Actions secret `OPOS_QA_VERCEL_AUTOMATION_BYPASS_SECRET`; do not
   paste the value into chat, code, issue comments, or action logs. Keep Vercel
   Authentication enabled. Do not make the protected preview public.
   The runner sends the key in `x-vercel-protection-bypass` and disables HTTP
   traces and videos to avoid leaking authentication headers in artifacts.
2. Verify the exact Controller, Client and Partner QA account entitlements.
3. Add authenticated Playwright cases, each in an isolated browser context.
4. Validate the cross-role workflow and negative permissions with synthetic data.
5. Check fake-inbox notifications and document links; add real Gmail API delivery
   evidence only after the user authorises a mailbox connection.
6. Generate a formal GO/NO-GO report. Green browser smoke is **not** a launch gate.

## Run locally (with access to QA preview)

```bash
npm install --no-save --package-lock=false @playwright/test@1.65.0
npx playwright install chromium
OPOS_QA_BASE_URL=https://<approved-preview>.vercel.app VERCEL_AUTOMATION_BYPASS_SECRET=<locally-configured-secret> npx playwright test --config=qa/browser/playwright.config.mjs
```

No production API keys, financial provider keys or real client data should be used.

## Authenticated browser suite (implemented, not yet executed)

`qa/browser/tests/authenticated.spec.mjs` contains three credential-backed,
read-only QA tests: Controller, Northfield Client and Precision Partner login,
the expected workspace/account, and negative cross-role access checks.

This is intentionally **NOT** enabled on PR #123. The separate
`OPOS Authenticated Browser QA (protected)` workflow has no PR or push event,
requires `refs/heads/main`, and uses the `opos-qa-auth` GitHub environment.
Review the PR before merging; merging remains separately blocked by the wider
OPOS production NO-GO state. Do **not** merge solely to run browser tests.

Before enabling execution:
1. Create the GitHub Actions environment `opos-qa-auth` and configure required
   reviewers and the `main` branch restriction.
2. Confirm all six QA email/password repository secrets exist alongside the
   Vercel bypass secret. Never echo them.
3. Review the authenticated test file and confirm the preview belongs to the
   known isolated Supabase QA project. It must never hit production.
4. After approved code is on protected main, manually dispatch
   `OPOS Authenticated Browser QA (protected)`.

No authentication storage states, cookies, traces, screenshots, videos, or
browser reports are uploaded for credential-bearing tests. The CI runner is
ephemeral and only performs read-only navigation/sign-in; no financial writes.

Successful authenticated login checks still do not prove the 28-step business
lifecycle, real provider email delivery, or payment settlement. Those require
separate governed tests.
