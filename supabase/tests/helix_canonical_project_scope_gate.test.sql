-- Read-only pgTAP contract: the obsolete duplicate Scope document is
-- replaceable ONLY by genuine, tenant-matched approved lifecycle evidence.
-- The browser scenario separately exercises the positive transition end-to-end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select ok(to_regprocedure('public.op_project_stage_readiness(uuid)') is not null,
 'Canonical Project readiness RPC exists');
select ok((select prosecdef from pg_proc
 where oid=to_regprocedure('public.op_project_stage_readiness(uuid)')),
 'Readiness RPC remains security definer');
select ok(not has_function_privilege('anon','public.op_project_stage_readiness_with_duplicate_scope_gate(uuid)','EXECUTE'),
 'Anonymous clients cannot invoke the privileged core');
select ok(not has_function_privilege('authenticated','public.op_project_stage_readiness_with_duplicate_scope_gate(uuid)','EXECUTE'),
 'Operators cannot bypass the organisation-scoped readiness wrapper');

with definition as (
 select pg_get_functiondef(to_regprocedure('public.op_project_stage_readiness(uuid)')) as sql
)
select ok(position('auth.role()' in sql)>0,
 'Signed JWT role is recognised when a service-only Partner RPC invokes readiness') from definition;

with definition as (
 select pg_get_functiondef(to_regprocedure('public.op_project_stage_readiness(uuid)')) as sql
)
select ok(position('op_project_stage_readiness_with_duplicate_scope_gate' in sql)>0,
 'Existing core readiness and all its other blockers remain authoritative') from definition;

with definition as (
 select pg_get_functiondef(to_regprocedure('public.op_project_stage_readiness(uuid)')) as sql
)
select ok(
 position('v_scope_attested' in sql)>0
 and position('IF NOT v_scope_attested THEN' in sql)>0
 and position('RETURN v_base' in sql)>0,
 'Missing approved evidence preserves the original scope blocker') from definition;

with definition as (
 select pg_get_functiondef(to_regprocedure('public.op_project_stage_readiness(uuid)')) as sql
)
select ok(
 position('JOIN public.technical_intakes ti' in sql)>0
 and position('ti.status = ''approved''' in sql)>0
 and position('requirements.document_type = ''client-requirements''' in sql)>0,
 'Case Technical Scope and controlled Client Requirements must be approved') from definition;

with definition as (
 select pg_get_functiondef(to_regprocedure('public.op_project_stage_readiness(uuid)')) as sql
)
select ok(
 position('sow.document_type = ''statement-of-work''' in sql)>0
 and position('sow.is_current_revision = true' in sql)>0
 and position('sow.status::text IN' in sql)>0,
 'Current approved Project Statement of Work is mandatory') from definition;

with definition as (
 select pg_get_functiondef(to_regprocedure('public.op_project_stage_readiness(uuid)')) as sql
)
select ok(
 position('q.organisation_id = p.organisation_id' in sql)>0
 and position('q.lead_id = p.lead_id' in sql)>0
 and position('requirements.organisation_id = p.organisation_id' in sql)>0
 and position('sow.organisation_id = p.organisation_id' in sql)>0,
 'Quote, Case evidence and Project agreement must have matching tenant lineage') from definition;

select * from finish();
rollback;
