-- QA migration contract: opt-in final settlement requires external client attestation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
select ok(to_regclass('public.op_client_review_release_policy') is not null,
 'Attested-client settlement policy is registered');
select ok(not has_table_privilege('anon','public.op_client_review_release_policy','SELECT'),
 'Anonymous requests cannot view settlement policy');
select ok(not has_table_privilege('authenticated','public.op_client_review_release_policy','UPDATE'),
 'Operator sessions cannot alter settlement policy');
select ok(exists(select 1 from pg_trigger t
  where t.tgrelid='public.op_project_final_settlements'::regclass
    and t.tgname='op_attested_client_review_settlement' and not t.tgisinternal),
 'Final settlement insert is guarded by client-attestation trigger');
select ok(exists(select 1 from pg_proc p
  where p.oid=to_regprocedure('public.op_guard_attested_client_review_before_settlement()')
   and p.prosecdef),'Settlement provenance guard is security definer');
select ok(has_table_privilege('service_role','public.op_client_review_release_policy','INSERT'),
 'Trusted service can explicitly enroll governed QA organisation');
select * from finish();
rollback;
