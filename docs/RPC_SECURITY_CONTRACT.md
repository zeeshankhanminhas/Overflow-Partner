# Overflow Partner RPC Security Contract

Status: Normative for database/API authority

## Principle

A database function is not safe merely because the UI hides it.

Any function exposed through PostgREST or callable by a workspace session MUST enforce the same actor, organisation, role and lifecycle invariants as the application path that owns the action.

`SECURITY DEFINER` functions are privileged entry points. Every such function MUST belong to exactly one caller class below.

## Caller classes

### 1. Public token-scoped

Use only for an intentional external journey that has no workspace login.

Requirements:
- access is bound to a high-entropy, unguessable token or token hash;
- token scope resolves exactly one intended business context;
- expiry / revocation / terminal-state rules are enforced where relevant;
- returned data is deliberately minimised for the public journey;
- no caller-supplied organisation or internal actor identity is trusted;
- `anon` EXECUTE is explicit and reviewed.

Current intentional examples:
- `op_public_invoice_by_token(uuid)` — public invoice view by invoice token; draft/cancelled invoices are excluded.
- `op_submit_partner_review_response(text,jsonb)` — Partner response by stored token hash with status and expiry checks.
- `op_submit_prospect_partner_review_response(text,jsonb)` — Prospect-stage Partner response by stored token hash with status and expiry checks.

A Supabase Security Advisor warning for one of these functions is expected only while the token contract above remains true.

### 2. Workspace-user RPC

Use for a signed-in operator action.

Requirements:
- `anon` has no EXECUTE;
- the authenticated actor is bound to `auth.uid()`;
- organisation membership is verified in PostgreSQL;
- role authority is verified in PostgreSQL for business decisions;
- lifecycle/evidence/readiness invariants remain in the canonical database implementation;
- the application may add UX-level role checks, but those checks are not the security boundary.

Pattern:
- public canonical RPC name = thin actor / role wrapper;
- mature lifecycle implementation = `<name>_core`;
- `_core` is service-role only;
- wrapper delegates to `_core` after authority checks.

This keeps one lifecycle implementation while preventing direct authenticated PostgREST calls from bypassing application authority.

### 3. Internal helper / trigger

Use for implementation machinery called by governed functions, triggers or database internals.

Requirements:
- no `anon` EXECUTE;
- no `authenticated` EXECUTE;
- service-role only where explicit execution is required;
- trigger functions remain callable by their owning trigger without being exposed as normal RPC endpoints.

Examples include reference generation, controlled-document helper functions, actor/role assertion helpers, lifecycle implementation cores and integrity trigger functions.

### 4. Backend worker

Use for a trusted server/worker process that runs with the service-role credential.

Requirements:
- service-role only;
- not callable by `anon` or ordinary authenticated sessions;
- the calling HTTP/cron surface must have its own server-side authentication.

Current example:
- notification claim / complete / fail functions called by `/api/notifications/process`, whose server-side client uses `SUPABASE_SERVICE_ROLE_KEY` and whose route is protected by `CRON_SECRET`.

## Actor rules

`op_assert_membership(organisation_id, user_id)` is an internal primitive.

For an authenticated workspace call:
- `auth.uid()` MUST equal the attributed `user_id`;
- the profile MUST be active;
- the profile MUST belong to the supplied organisation.

Anonymous callers can never satisfy workspace membership.

Business decisions use `op_assert_workspace_role(...)` or an equivalent database-side role check in addition to membership.

## Authority examples

These role sets reflect the current application authority model and are enforced in the canonical database wrappers:

- Prospect → Case conversion: owner / admin / operator / business development.
- Technical intake approval: owner / admin / operator / engineering.
- Commercial approval and quote generation: owner / admin / commercial.
- Client Quote issue: owner / admin / commercial / business development.
- Client acceptance / Project creation: owner / admin / operator / commercial / business development.
- Prospect Partner Review request: owner / admin / business development / operator / engineering.
- Prospect Partner Review decision: owner / admin / commercial / engineering.
- Project mobilisation: owner / admin / operator.
- Project delivery activities: owner / admin / operator / engineering / commercial.

Changing these sets is an authority-model change, not a copy/UI change.

## Migration release discipline

Database migrations are not deployed by `.github/workflows/deploy-supabase-functions.yml`; that workflow deploys Edge Functions only.

For production database changes:

1. Create/review the migration in Git.
2. Confirm its caller class and expected privilege matrix.
3. Apply the migration through the governed Supabase production release step.
4. Record the exact migration version returned in the live migration ledger.
5. Ensure the repository filename/version matches the live ledger exactly.
6. Query effective privileges in production; do not infer them from SQL text alone.
7. Run the Supabase Security Advisor after DDL/security changes.
8. Classify every remaining warning as intentional or unresolved; do not silently accept warnings.

The repository and live migration ledger MUST NOT be allowed to drift.

## Security Advisor interpretation

A generic `SECURITY DEFINER executable` warning is not automatically a vulnerability. It is a prompt to verify the caller contract.

Expected warnings may remain for:
- explicitly public token-scoped endpoints;
- signed-in canonical workspace RPC wrappers whose actor, organisation and role checks are intentional;
- an RLS helper that must be callable by the authenticated role.

Unexpected warnings for helpers, trigger functions, implementation cores or backend worker functions are launch blockers.

## Pre-merge checklist

For every new or changed `SECURITY DEFINER` function:

- Which caller class owns it?
- Does `anon` need EXECUTE? Why?
- Does `authenticated` need EXECUTE? Why?
- If a user UUID is accepted, is it bound to `auth.uid()`?
- Is organisation membership checked?
- Is role authority checked for business decisions?
- Are lifecycle/evidence rules enforced in PostgreSQL?
- Is `search_path` pinned?
- Are internal cores/helpers inaccessible to normal clients?
- Does the live privilege matrix match the intended contract after deployment?

If any answer is unclear, the function is not ready for production.
