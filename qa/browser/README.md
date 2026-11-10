# OPOS browser QA — safe setup and execution

## What is implemented

The read-only Playwright Chromium smoke suite verifies the Controller, Client and
Partner sign-in forms, explicit workspace destinations, anonymous portal redirects
and a rejected external login-return URL. It targets an allowlisted isolated-QA
Vercel preview; there are **no test-user credentials, Gmail passwords or writes**.

The separate existing fake-inbox integration tests are not equivalent to real Gmail
delivery or authenticated three-role browser acceptance.

## Initial test workflow

GitHub Actions → **OPOS QA Browser Smoke (read-only)**.

The workflow runs on changes to QA/browser, login or portal code in PRs against
main, and also supports manual dispatch. It uses pinned Playwright 1.65.0,
Chromium, screenshot/trace capture on failures and a seven-day HTML report.

The temporary default target is the last verified OPOS isolated-QA preview.
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

1. Confirm the preview is not Vercel-protected for the GitHub runner, or configure
   the official Vercel automation-bypass method using an appropriately scoped secret.
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
OPOS_QA_BASE_URL=https://<approved-preview>.vercel.app npx playwright test --config=qa/browser/playwright.config.mjs
```

No production API keys, financial provider keys or real client data should be used.
