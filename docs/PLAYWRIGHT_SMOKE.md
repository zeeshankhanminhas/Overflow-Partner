# OPOS read-only Playwright smoke checks

## Safety contract
- Run **only** against an intentionally designated, standalone Vercel preview deployment. Do not use a production URL.
- Before enabling, configure a separate test Supabase project and test email sandbox in Vercel Preview environment settings. Never copy production credentials into the test environment.
- No authentication state, payment providers, real client records, client emails, or mutation requests are used.
- The browser test blocks POST, PUT, PATCH, and DELETE; tests visit only public pages with missing or forged tokens.
- The workflow is **manual-only**, gated behind repository variable `OPOS_E2E_TEST_ENV_READY=true`, and requires an explicit preview URL.
- Results are uploaded only on failure. Do not paste signed customer access links into the workflow input.

## Operator setup
1. Prepare a non-production Vercel preview deployment with separate database/notification sandbox and confirm it is not connected to real client systems.
2. Set GitHub Actions repository variable `OPOS_E2E_TEST_ENV_READY` to `true` only once isolation is verified.
3. Open GitHub → Actions → **OPOS Playwright Read-only Smoke** → Run workflow, supplying the Vercel preview deployment URL.
4. Review run status and, on failure, download `opos-playwright-smoke-failures`.

These are baseline public-route smoke checks. Protected workspace paths, genuine quote acceptance, vendor review and Project 360 transitions require dedicated seeded fixtures and safe synthetic email/payment adapters before adding destructive E2E suites.
