-- Isolated QA-first: require genuine attested client-portal evidence before
-- final Stripe settlement for explicitly enrolled organisations.
-- This is a staged policy: unenrolled historical tenants retain prior behaviour.
-- No production or hosted QA migration is applied by this commit.
begin;
create table if not exists public.op_client_review_release_policy (
 organisation_id uuid primary key references public.organisations(id) on delete cascade,
 require_attested_portal boolean not null default true,
 configured_at timestamptz not null default now()
);
alter table public.op_client_review_release_policy enable row level security;
revoke all on public.op_client_review_release_policy from public,anon,authenticated;
grant select,insert,update on public.op_client_review_release_policy to service_role;

create or replace function public.op_guard_attested_client_review_before_settlement()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare
  v_required boolean:=false;
  v_email text;
begin
 select coalesce(p.require_attested_portal,false) into v_required
 from public.op_client_review_release_policy p
 where p.organisation_id=new.organisation_id;
 if not coalesce(v_required,false) then return new; end if;
 if not exists (
   select 1 from public.project_client_reviews r
   join public.project_client_transmittals tx
     on tx.id=r.transmittal_id and tx.organisation_id=r.organisation_id
      and tx.project_id=r.project_id and tx.execution_cycle=r.execution_cycle
   where r.organisation_id=new.organisation_id and r.project_id=new.project_id
     and r.outcome in ('accepted','accepted_with_comments')
     and r.evidence_basis='client_portal'
     and r.client_authority_attested_at is not null
     and lower(btrim(coalesce(r.client_submitted_by_email,'')))
         =lower(btrim(coalesce(tx.recipient_email,'')))
     and r.client_submitted_by_email is not null
     and r.id=(
       select latest.id from public.project_client_reviews latest
       where latest.organisation_id=new.organisation_id
         and latest.project_id=new.project_id
       order by latest.recorded_at desc,latest.id desc limit 1
     )
     and tx.id=(
       select latest_tx.id from public.project_client_transmittals latest_tx
       where latest_tx.organisation_id=new.organisation_id
         and latest_tx.project_id=new.project_id
         and latest_tx.execution_cycle=r.execution_cycle
       order by latest_tx.issued_at desc,latest_tx.id desc limit 1
     )
 ) then
   raise exception 'Final settlement requires a genuine attested client-portal acceptance for the current controlled transmittal.';
 end if;
 return new;
end;
$$;
drop trigger if exists op_attested_client_review_settlement on public.op_project_final_settlements;
create trigger op_attested_client_review_settlement
before insert on public.op_project_final_settlements
for each row execute function public.op_guard_attested_client_review_before_settlement();
revoke all on function public.op_guard_attested_client_review_before_settlement() from public,anon,authenticated;
commit;
