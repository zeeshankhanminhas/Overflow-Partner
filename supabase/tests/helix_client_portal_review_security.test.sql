-- Read-only pgTAP security regression for the client portal review boundary.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select ok(to_regprocedure('public.op_record_attested_client_portal_review(uuid,integer,uuid,uuid,text,text,text)') is not null,
 'Attested client review RPC exists');
select ok(not has_function_privilege('anon',
 'public.op_record_attested_client_portal_review(uuid,integer,uuid,uuid,text,text,text)','EXECUTE'),
 'Anonymous clients may not execute the privileged reviewer RPC');
select ok(not has_function_privilege('authenticated',
 'public.op_record_attested_client_portal_review(uuid,integer,uuid,uuid,text,text,text)','EXECUTE'),
 'Ordinary authenticated clients may not execute service-only reviewer RPC');
select ok(has_function_privilege('service_role',
 'public.op_record_attested_client_portal_review(uuid,integer,uuid,uuid,text,text,text)','EXECUTE'),
 'Only trusted service boundary may invoke reviewer RPC');
select ok(exists(select 1 from pg_proc p
 where p.oid=to_regprocedure('public.op_record_attested_client_portal_review(uuid,integer,uuid,uuid,text,text,text)')
 and p.prosecdef=true),'Reviewer RPC has security-definer execution');
select ok(exists(select 1 from information_schema.columns
 where table_schema='public' and table_name='project_client_reviews'
 and column_name='client_submitted_by_email'),
 'Review table explicitly stores actual external recipient identity');
select * from finish();
rollback;
