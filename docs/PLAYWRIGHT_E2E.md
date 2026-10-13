# OPOS Playwright browser testing — initial baseline

**Status:** Initial test harness only. Not yet an authenticated end-to-end business-lifecycle sign-off.

## Purpose and boundaries

- No UI redesign, workflow changes, schema changes or deployment is part of this branch.
- Browser tests are separate from the normal production build gates.
- Public/login and authenticated operator navigation tests do not create commercial records.
- **Opening** a customer intake or partner review link is **not purely read-only**: the endpoint records first/last opening and may change an invitation's status.
- **Downloading** a partner file records an access count and timestamp.
- Never run token-link tests on live client/partner records without explicit authorisation. Use dedicated test records.
- Never put passwords, secure links, signed file URLs, authentication state or real client evidence in Git.
- A Playwright report, video, screenshot or trace may include confidential data; keep local and private.

## Install / run

Requires Node 22 or later.

```bash
npm install
npx playwright install chromium

# Place a local .env.e2e file using .env.e2e.example as the template.
# On macOS/Linux, load it without printing values:
set -a; source .env.e2e; set +a

npm run test:e2e:smoke             # public homepage, login, authentication boundary
npm run test:e2e:operator          # authenticated read-only workspace route checks
npm run test:e2e:secure            # opt-in dedicated secure intake/partner records
npm run test:e2e                   # all configured browser tests
npx playwright show-report
```

The suite targets `OP_E2E_BASE_URL`; it does not automatically start a server. Use a running local Next.js application or an authorised preview/production URL. If running locally, ensure its configured Supabase points to the intended test environment. The example URL is local.

## Environment switches

| Variable | Purpose |
| --- | --- |
| `OP_E2E_BASE_URL` | Browser target origin |
| `OP_E2E_EMAIL`, `OP_E2E_PASSWORD` | Optional authorised test-operator login |
| `OP_E2E_INTAKE_URL` | Full dedicated customer intake link on the target origin |
| `OP_E2E_PARTNER_REVIEW_URL` | Full dedicated partner review link on the target origin |
| `OP_E2E_TEST_DATA_CONFIRMED=1` | Operator confirms records are dedicated disposable test data |
| `OP_E2E_ALLOW_TOKEN_OPEN=1` | Explicitly permits audit/status side effects of opening secure links |
| `OP_E2E_EXPECT_PARTNER_FILE=1` | Expects a file shared with the dedicated review and checks the signed-file redirect |
| `OP_E2E_CAPTURE_UI=1` | Save optional full-page screenshots for a later UI audit; no UI changes |

When either secure-link consent switch is absent, those tests are skipped. Tests reject secure links outside the configured origin. None of the initial tests submit forms or send messages.

## Browser coverage added

1. Public homepage and OP branding
2. Accessible login form
3. Anonymous workspace access denied
4. Authenticated Mission Control, Acquisition, Company register, Partner directory and Activity screens
5. Dedicated customer technical intake: draft versus submitted state
6. Dedicated partner review: open versus response-received state
7. Dedicated partner review: evidence link and guarded download endpoint (302)
8. Desktop Chromium and mobile Chromium

The secure-link tests validate actual browser pages and the existing authenticated file access route; they do **not** claim the commercial workflow has passed.

## Remaining full-lifecycle acceptance work

Once a disposable test tenant/database, test operator and known test records are available, add **opt-in state-changing scenarios** for:

1. Company → Contact → Opportunity records and ownership.
2. Customer invitation, delivered notification, upload and technical submission.
3. Partner invitation, file access, feasibility declaration and commercial response.
4. Internal acceptance/clarification, partner quote, margin approval and customer quote.
5. Payment evidence, Project 360, partner execution and client acceptance.
6. Activity history, email outbox, reminder schedule, permissions, record invariants and clean-up.

Use unique `E2E-` record identifiers and explicit setup/cleanup fixtures in an isolated environment. Do not fake successful mail delivery, payments, customer acceptance or state transitions. Verify database side effects with a separate permitted read-only audit mechanism when available.

## Failure severity and UI freeze

- **P0:** evidence inaccessible, incorrect permission, broken state transition, data loss, unauthorised advancement.
- **P1:** workflow can progress but important operational truth or instruction is misleading.
- **P2:** redundant copy, sizing inconsistency, typography or non-blocking layout issue.
- **P3:** aesthetic optimisation.

Capture P2/P3 issues during browser testing but do not modify the interface before the end-to-end lifecycle is verified. Escalate only genuine P0 blockers for immediate fixes.

## Current constraints

Browser tests have **not been executed** simply because files were added to GitHub. Running tests requires an accessible target, installed Chromium, and appropriate test credentials/links; never claim a pass without a real Playwright report.
