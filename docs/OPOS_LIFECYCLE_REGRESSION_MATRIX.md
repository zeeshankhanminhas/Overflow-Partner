# OPOS lifecycle regression matrix — release gate

This is the required acceptance matrix, **not** a completed test execution report. Run it only against a controlled QA environment after both contractual terms and identity dependencies are enforced. All payment tests must use Stripe Sandbox.

| # | Case | Expected invariant |
|---|---|---|
| 01 | Qualify prospect with missing submitted intake | Block; no Case created |
| 02 | Qualify prospect with approved feasible review | Exactly one Case created; inherited records consistent |
| 03 | Preliminary partner consultation during requirements | Permitted, cannot authorise a binding offer |
| 04 | Approve scope with valid requirements and without formal partner review | Permitted; no circular dependency |
| 05 | Approve scope without approved requirements | Block |
| 06 | Formal partner assessment submitted and approved | Evidence belongs to same Case, partner, revision |
| 07 | Try Commercial Review with partner pricing but no approved formal assessment | Block |
| 08 | Draft partner report counted as completed controlled document | Block |
| 09 | Simple low-risk job | Same stage spine; proportionate document depth |
| 10 | High-risk low-value job | Enhanced governance regardless of low value |
| 11 | Issue quotation without controlled issued PDF, terms and expiry | Block |
| 12 | Accept expired or superseded quotation revision | Block |
| 13 | Portal acceptance by non-authorised recipient | Block; do not assert identity on link possession alone |
| 14 | Accept quotation with authorised identified contact | Persist identity and accepted exact revision |
| 15 | Attempt full Stripe charge on a deposit/credit quotation | Block |
| 16 | Attempt project release under release condition absent from accepted terms | Block |
| 17 | Present pending bank-transfer proof without cleared reconciliation | No project |
| 18 | Valid authorised PO/credit release | Exactly one project, attributable OP approver |
| 19 | Stripe Sandbox event with invalid signature | No evidence, no project |
| 20 | Valid signed Stripe event, non-QA quote | Block at webhook **and database** |
| 21 | Valid signed event, QA quote not allowlisted or expired allowlist | Block |
| 22 | Valid paid Stripe event, wrong quote revision/amount/currency | Block |
| 23 | Paid event, quote accepted by wrong revision | Block |
| 24 | Valid paid event, authorised QA quote | One payment confirmation and one project |
| 25 | Retry same event/session after success | Same existing project; no duplicate payment |
| 26 | Different session for quote already released | No second project |
| 27 | Checkout cancelled or failed | No payment confirmation, no project |
| 28 | Bank/Stripe release raced concurrently | One governed release, one project |
| 29 | Approved Statement of Work and partner commitment | Mobilisation exits once prerequisites satisfied |
| 30 | Partner delivery missing required evidence | Cannot enter OP quality approval |
| 31 | OP rejects partner output | Corrective loop, no client issue |
| 32 | Client delivery before OP QA approval | Block |
| 33 | Client requests corrections | Rework and revision controls; preserve transmittal history |
| 34 | Quote issue email retried | No duplicated external action or wrong PDF revision |
| 35 | Partner/QA/client notification transition retried | Idempotent, correct recipients |
| 36 | Closure with outstanding invoices or partner payables | Block |
| 37 | Fully settled/accepted delivery | Close with audit trail; protect historical edits |

## Execution conditions

- GitHub Quality Gate must pass on the exact PR head commit.
- Unit/static wiring checks are necessary but **not** evidence that cases 01–37 ran.
- Use fixture-specific QA records. Never infer isolation from a company name prefix alone.
- Track each actual test by record ID, expected vs actual, database transaction evidence, UI snapshot, email/controlled document revision, and retest outcome.
- Do not enable Preview payment flags until all critical rows are backed by server and SQL guards and negative tests pass.
- Keep production payment configuration and real customer records unchanged.
