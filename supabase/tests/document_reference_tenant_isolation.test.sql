-- Local pgTAP only: two organisations may use the same generated document
-- reference while a duplicate within one organisation remains prohibited.
-- Every synthetic row and trigger setting is rolled back, never hosted data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select ok(to_regclass('public.ux_documents_org_reference') is not null,
 'Tenant-scoped document reference index exists');
select ok(not exists (
  select 1 from pg_constraint
  where conrelid='public.documents'::regclass
    and conname='documents_reference_key' and contype='u'
 ),'Legacy global reference uniqueness constraint has been removed');

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000007701','doc-ref-a@example.invalid'),
 ('00000000-0000-4000-8000-000000007702','doc-ref-b@example.invalid');
insert into public.organisations(id,name) values
 ('00000000-0000-4000-8000-000000007703','OP QA TEST Reference Organisation A'),
 ('00000000-0000-4000-8000-000000007704','OP QA TEST Reference Organisation B');
insert into public.profiles(id,organisation_id,role,full_name) values
 ('00000000-0000-4000-8000-000000007701','00000000-0000-4000-8000-000000007703','owner','QA Owner A'),
 ('00000000-0000-4000-8000-000000007702','00000000-0000-4000-8000-000000007704','owner','QA Owner B');

-- Fixture preparation only: constraints including FK/unique stay enabled.
alter table public.documents disable trigger user;
insert into public.documents(
 organisation_id,created_by,document_type,reference,title,status,version
) values (
 '00000000-0000-4000-8000-000000007703',
 '00000000-0000-4000-8000-000000007701',
 'statement-of-work','OP-DOC-2026-0001','Isolated agreement A','draft',1
);
select lives_ok($sql$
 insert into public.documents(
  organisation_id,created_by,document_type,reference,title,status,version
 ) values (
  '00000000-0000-4000-8000-000000007704',
  '00000000-0000-4000-8000-000000007702',
  'statement-of-work','OP-DOC-2026-0001','Isolated agreement B','draft',1
 )
$sql$,'Separate organisations may each issue OP-DOC-2026-0001');

select throws_ok($sql$
 insert into public.documents(
  organisation_id,created_by,document_type,reference,title,status,version
 ) values (
  '00000000-0000-4000-8000-000000007703',
  '00000000-0000-4000-8000-000000007701',
  'statement-of-work','OP-DOC-2026-0001','Duplicate agreement A','draft',1
 )
$sql$,'23505','duplicate key value violates unique constraint "ux_documents_org_reference"',
 'Within one organisation a repeated document reference is rejected');
alter table public.documents enable trigger user;

select is((select count(*)::integer from public.documents
 where reference='OP-DOC-2026-0001' and organisation_id in (
  '00000000-0000-4000-8000-000000007703','00000000-0000-4000-8000-000000007704'
 )),2,'The same reference is present once per tenant');
select is((select count(distinct organisation_id)::integer from public.documents
 where reference='OP-DOC-2026-0001' and organisation_id in (
  '00000000-0000-4000-8000-000000007703','00000000-0000-4000-8000-000000007704'
 )),2,'Both tenant identifiers remain independent');

select * from finish();
rollback;
