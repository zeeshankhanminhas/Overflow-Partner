# OPOS integrated workflow integrity audit — 2026-10-19

Scope: nine business lifecycle stages, connected UI/server/SQL control surfaces, the existing OPOS shared database, and the Preview-only Stripe test flow. Review is read-only except the explicit hardening migration below. This is **not** an end-to-end acceptance certificate.

## Verified findings and dispositions

| ID | Severity | Dependency | Evidence and disposition |
| --- | --- | --- | --- |
| F01 | Critical | Accepted quotation terms → release → project | Current `quotes` table has no structured, frozen release-condition field. `op_accept_quote_create_project_with_release_evidence` accepts PO/no-advance assertions supplied by operator without matching them to revision-specific accepted contractual terms. **Open; block activation**. |
| F02 | Critical | Sandbox event → privileged finalizer | Installed `op_finalize_verified_stripe_quote_payment` formerly omitted quote allowlist validation. Fixed via forward-only `20261019010000_enforce_sandbox_finalization_scope.sql`, applied to shared DB. Verified function execute privileges: service_role only. **Guard installed; dynamic negative/duplicate-event tests outstanding**. |
| F03 | High | Portal identity → acceptance | Secure token is proof of link access, not independently verified named signatory authority. Acceptance action explicitly labels portal acceptance identity-unverified. **Open**. |
| F04 | High | Acquisition/technical scope → formal partner assessment → commercial | Server requires partner review approved, same case and partner; provenance across preliminary/inherited/formal paths not proven by E2E tests. **Open**. |
| F05 | High | Governance tier → required documents and gates | `classifyGovernance` is application policy but persisted authoritative per-case tier and equivalent DB enforcement not confirmed. **Open**. |
| F06 | High | Controlled document issue → email and retries | Scenarios exist for quote, payment, partner, delivery and closure; revision/idempotency across actual triggers still untested. **Open**. |
| F07 | High | Quote acceptance → project and terms | Core project creator requires approved quote PDF and uses quote-level lock; idempotency occurs on existing project, but invoice/payable/contract terms alignment and accepted signatory evidence are not end-to-end verified. **Open**. |
| F08 | High | Stripe full amount → contractual deposit/milestone | Stripe checkout charges total quote; intentionally guarded by `OP_STRIPE_FULL_PAYMENT_ONLY`. Must match frozen terms before use. **Open**. |
| F09 | High | Shared Supabase Preview use | Explicit allowlist currently empty; Preview service-role credential absent; payment flags absent; no payment tests possible. **Safely disabled**. |
| F10 | Moderate | Mobilisation → partner execution → OP QA → client release → closure | Stage machine and readiness functions exist, but their actual evidence provenance, notifications and partner acceptance need cross-system regression tests. **Open**. |

## Release blockers (all mandatory)

1. Persist and approve contractual release basis per issued quote revision; DB functions must compare requested release to the accepted revision and release amount. No manual Stripe verification.
2. Bind portal client acceptance to the named authorised contact with attestations and traceable identity evidence.
3. Complete partner-review provenance and Case 360 handoff tests before quotation issue.
4. Ensure verified bank receipt/PO/credit evidence and all payment paths use one governed release service with atomic exactly-once project creation.
5. Test error states, retried payments, webhook race/replay, quote revision/expiry, controlled document approval, email idempotency, rework and closure.
6. Explicitly configure and verify Preview-only credentials and flags after all security tests; never enable Production live Stripe payments during sandbox QA.

## Safe rollout order

F02 migration → contract terms and acceptance identity controls → consistent server/SQL guards → unit and integration tests → Preview credentials → one explicitly allowlisted labelled QA quote → sandbox E2E → internal and client review → merge and staged activation.

The previous `20261016234000_package01_verified_stripe_release.sql` migration remains unchanged because it has already been applied; the new guard is a subsequent forward migration.

## Integrated repair progress (development branch)

Implemented and built successfully in PR #102:

- Per-revision contractual release record, with issue-time capture of named authorised signatory, opening amount and release basis. The issued email PDF uses those terms rather than inheriting the offshore partner's own payment terms.
- Project insertion guard linking the accepted quote revision and signatory to verified payment or PO/no-advance evidence. Unsupported deposit and credit release pathways fail closed.
- Secure Client Portal acceptance requires the named contact to attest signing authority. The signed decision and attestation are recorded transactionally in the proposed migration.
- Checkout, signed Stripe webhook, persistent portal and internal acceptance use the same terms, with sandbox QA allowlist and Preview-only return URL.
- Project 360 automatically inherits commercial terms, and financial readiness recognises quote-level opening-payment evidence without double counting.
- CI now runs `scripts/opos-integrated-lifecycle-check.mjs` during `npm run build`. It executes policy behavior for governance, payment release, document stage requirements, billing eligibility and checks cross-layer wiring.

**Verification boundary:** GitHub Quality Gate passed for commit `ec9a62b64ef960de3430ef13255c939a832b2e91`. This is not a transaction-level test of all 37 matrix cases.

**Unapplied migrations:** `20261019023000_quote_contractual_release_gates.sql` and `20261019030000_project_financial_release_handoff.sql` are staged only. They must be reviewed and validated before applying to the shared OPOS database, because they add global quotation/project gates.

**Outstanding blockers before paid QA:**
1. Safely validate and install staged database migrations and test rollbacks and privileges. Existing zero customer/project records must remain untouched.
2. Confirm proportionate-governance threshold and its authoritative persistence; until then enhanced requirements remain default and should not be silently relaxed.
3. Complete Preview-only credential scoping and one explicit QA allowlist authorisation. No production secret should be automatically copied to Preview.
4. Execute the 37-case transactional/API integration matrix, with positive and negative evidence, including document/email idempotency, partner reviews, OP QA, settlements and closeout.
5. Verify bank-transfer settlement independently; an operator-entered bank reference is not proof of cleared funds.

**Operational decision:** PR #102 stays draft/unmerged and manual browser testing remains paused until these checks complete.
