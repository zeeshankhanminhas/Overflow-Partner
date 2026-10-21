-- OPOS final-settlement and owner-release gates. ISOLATED QA FIRST.
-- Requires quote_release_contracts and the staged verified-deposit finalizer.
-- Do not apply to the shared production OPOS database before schema migration dry-run.
create table if not exists public.op_project_final_settlements (
  project_id uuid primary key references public.projects(id) on delete restrict,
  organisation_id uuid not null references public.organisations(id),
  quote_id uuid not null references public.quotes(id),
  quote_revision integer not null,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null,
  stripe_event_id text not null unique,
  stripe_session_id text not null unique,
  verified_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.op_project_final_settlements enable row level security;
revoke all on public.op_project_final_settlements from public,anon,authenticated;
grant select,insert on public.op_project_final_settlements to service_role;

-- Stripe signature is verified at the trusted HTTP boundary. This RPC
-- independently re-checks the persisted paid event, the project, the accepted
-- client review, the opening-payment receipt and the exact final amount.
create or replace function public.op_record_verified_project_final_settlement(
  p_project_id uuid,p_session_id text
) returns public.op_project_final_settlements
language plpgsql security definer set search_path=public as $$
declare
  v_project public.projects%rowtype;
  v_quote public.quotes%rowtype;
  v_contract public.quote_release_contracts%rowtype;
  v_event public.quote_stripe_payment_events%rowtype;
  v_row public.op_project_final_settlements%rowtype;
  v_required numeric(18,2);
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
     and auth.role() is distinct from 'service_role' then
    raise exception 'Only the payment-reconciliation service may confirm final settlement.';
  end if;
  if nullif(trim(coalesce(p_session_id,'')),'') is null then
    raise exception 'Verified Stripe session required.';
  end if;
  select * into v_project from public.projects where id=p_project_id for update;
  if not found then raise exception 'Project not found.'; end if;
  select * into v_quote from public.quotes where id=v_project.quote_id and organisation_id=v_project.organisation_id;
  if not found then raise exception 'Project has no valid accepted quotation.'; end if;
  select * into v_contract from public.quote_release_contracts where quote_id=v_quote.id
    and quote_revision=v_quote.revision and organisation_id=v_quote.organisation_id;
  if not found or v_contract.release_basis not in ('deposit','payment') then
    raise exception 'Frozen accepted payment terms required.'; end if;
  select * into v_event from public.quote_stripe_payment_events where stripe_session_id=p_session_id
    and stripe_payment_status='paid' and quote_id=v_quote.id and organisation_id=v_quote.organisation_id
    and quote_revision=v_quote.revision;
  if not found then raise exception 'No verified, current Stripe settlement event.'; end if;
  v_required := round(v_quote.total-v_contract.opening_amount,2);
  if v_required<=0 then raise exception 'No outstanding final payment is due.'; end if;
  if v_event.amount_total is distinct from round(v_required*100)::bigint
    or upper(v_event.currency) is distinct from upper(v_quote.currency) then
    raise exception 'Final settlement amount or currency mismatch.'; end if;
  if not exists(
    select 1 from public.quote_payment_confirmations p
    where p.quote_id=v_quote.id and p.organisation_id=v_quote.organisation_id
      and p.amount>=v_contract.opening_amount and p.payment_method='stripe'
      and exists(select 1 from public.quote_stripe_payment_events e
        where e.stripe_session_id=p.payment_reference and e.quote_id=v_quote.id
          and e.stripe_payment_status='paid'
          and e.amount_total=round(v_contract.opening_amount*100)::bigint)
  ) then raise exception 'Opening advance was not independently verified.'; end if;
  if not exists(
    select 1 from public.project_client_reviews r where r.project_id=v_project.id
      and r.organisation_id=v_project.organisation_id
      and r.outcome in ('accepted','accepted_with_comments')
      and r.recorded_at=(select max(x.recorded_at) from public.project_client_reviews x
        where x.project_id=v_project.id and x.organisation_id=v_project.organisation_id)
  ) then raise exception 'Client review has not reached accepted status.'; end if;
  select * into v_row from public.op_project_final_settlements where project_id=v_project.id;
  if found then
    if v_row.stripe_session_id is distinct from v_event.stripe_session_id
      or v_row.amount is distinct from v_required then
      raise exception 'Final payment already recorded with different evidence.'; end if;
    return v_row;
  end if;
  insert into public.op_project_final_settlements(
    project_id,organisation_id,quote_id,quote_revision,amount,currency,
    stripe_event_id,stripe_session_id,verified_at
  ) values(v_project.id,v_project.organisation_id,v_quote.id,v_quote.revision,v_required,v_quote.currency,
     v_event.stripe_event_id,v_event.stripe_session_id,v_event.verified_at)
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.op_record_verified_project_final_settlement(uuid,text) from public,anon,authenticated;
grant execute on function public.op_record_verified_project_final_settlement(uuid,text) to service_role;

create table if not exists public.op_project_final_release_approvals (
  project_id uuid primary key references public.projects(id) on delete restrict,
  organisation_id uuid not null references public.organisations(id),
  settlement_project_id uuid not null references public.op_project_final_settlements(project_id),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);
alter table public.op_project_final_release_approvals enable row level security;
revoke all on public.op_project_final_release_approvals from public,anon,authenticated;
grant select on public.op_project_final_release_approvals to service_role;

-- Explicit owner action. A successful Stripe webhook can NEVER call this RPC
-- because the authenticated owner identity must match the actor argument.
create or replace function public.op_approve_project_final_release(
  p_organisation_id uuid,p_user_id uuid,p_project_id uuid,p_note text default null
) returns public.op_project_final_release_approvals
language plpgsql security definer set search_path=public as $$
declare
  v_project public.projects%rowtype;
  v_row public.op_project_final_release_approvals%rowtype;
  v_cycle integer;
begin
  if auth.uid() is distinct from p_user_id then raise exception 'Authenticated OPOS owner approval is required.'; end if;
  perform public.op_assert_workspace_role(p_organisation_id,p_user_id,array['owner','admin']);
  select * into v_project from public.projects where id=p_project_id and organisation_id=p_organisation_id for update;
  if not found or v_project.project_stage not in ('client_review','completion') then
    raise exception 'Project is not at the approved final-review gate.'; end if;
  if not exists(select 1 from public.op_project_final_settlements s
    where s.project_id=v_project.id and s.organisation_id=p_organisation_id)
  then raise exception 'Final client settlement must be independently verified first.'; end if;
  if not exists(
    select 1 from public.project_client_reviews r where r.project_id=v_project.id
      and r.organisation_id=p_organisation_id and r.outcome in ('accepted','accepted_with_comments')
      and r.recorded_at=(select max(x.recorded_at) from public.project_client_reviews x
         where x.project_id=v_project.id and x.organisation_id=p_organisation_id)
  ) then raise exception 'Client acceptance is not current.'; end if;
  if not exists(
    select 1 from public.documents d where d.project_id=v_project.id
      and d.organisation_id=p_organisation_id and d.document_type='handover-pack'
      and d.is_current_revision and d.status::text in ('issued','published')
  ) then raise exception 'Current controlled Handover Pack is not issued.'; end if;
  select coalesce(max(execution_cycle),1) into v_cycle from public.project_execution_assignments
    where project_id=v_project.id and organisation_id=p_organisation_id;
  if not exists(
    select 1 from public.partner_delivery_submissions s where s.project_id=v_project.id
      and s.organisation_id=p_organisation_id and s.execution_cycle=v_cycle and s.review_status='accepted'
      and exists(select 1 from public.partner_delivery_submission_files f where f.submission_id=s.id
        and f.project_id=v_project.id and f.organisation_id=p_organisation_id)
  ) then raise exception 'Current partner engineering submission and senior technical review evidence are required.'; end if;
  insert into public.op_project_final_release_approvals(
    project_id,organisation_id,settlement_project_id,approved_by,note
  ) values(p_project_id,p_organisation_id,p_project_id,p_user_id,nullif(trim(coalesce(p_note,'')),''))
  on conflict (project_id) do nothing;
  select * into v_row from public.op_project_final_release_approvals where project_id=p_project_id;
  return v_row;
end;
$$;
revoke all on function public.op_approve_project_final_release(uuid,uuid,uuid,text) from public,anon,service_role;
grant execute on function public.op_approve_project_final_release(uuid,uuid,uuid,text) to authenticated;

-- Manual bank references are evidence of actual partner payment, not of button approval.
create or replace function public.op_guard_partner_payment_after_final_release()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if nullif(trim(coalesce(new.reference,'')),'') is null or new.amount<=0 then
    raise exception 'Partner payment must have amount and actual payment reference.'; end if;
  if not exists(select 1 from public.op_project_final_release_approvals a
    where a.project_id=new.project_id and a.organisation_id=new.organisation_id) then
    raise exception 'Partner payment blocked until client settles and final files are owner-released.';
  end if;
  return new;
end;$$;
drop trigger if exists op_partner_payment_after_final_release on public.partner_payments;
create trigger op_partner_payment_after_final_release
before insert on public.partner_payments for each row
execute function public.op_guard_partner_payment_after_final_release();

-- Existing project closure is already a manual operator action.
-- An additional hard guard prevents accidental closure before settlement and partner payment.
create or replace function public.op_guard_manual_voice_project_closure()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.project_stage='closed' and old.project_stage is distinct from 'closed' then
    if not exists(select 1 from public.op_project_final_release_approvals a
      where a.project_id=new.id and a.organisation_id=new.organisation_id) then
      raise exception 'Final files require explicit owner release before closure.'; end if;
    if exists(select 1 from public.partner_payables p where p.project_id=new.id
      and p.organisation_id=new.organisation_id and (p.total>p.amount_paid or p.status<>'paid')) then
      raise exception 'Partner settlement must be complete before manual closure.'; end if;
    if not exists(select 1 from public.partner_payments p
      where p.project_id=new.id and p.organisation_id=new.organisation_id
        and p.status='cleared' and nullif(trim(p.reference),'') is not null) then
      raise exception 'Evidence of actual partner settlement is required before closure.'; end if;
  end if;
  return new;
end;$$;
drop trigger if exists op_manual_voice_project_closure on public.projects;
create trigger op_manual_voice_project_closure before update of project_stage on public.projects
for each row execute function public.op_guard_manual_voice_project_closure();

-- Read-only authenticated state projection for the four questions in Project 360.
create or replace function public.op_project_voice_final_release_status(
  p_organisation_id uuid,p_user_id uuid,p_project_id uuid
) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare v_paid boolean;v_approved boolean;v_partner_paid boolean;v_review boolean;
begin
  if auth.uid() is distinct from p_user_id then raise exception 'Authenticated workspace actor required.'; end if;
  perform public.op_assert_workspace_role(p_organisation_id,p_user_id,
    array['owner','admin','operator','engineering','commercial']);
  if not exists(select 1 from public.projects where id=p_project_id and organisation_id=p_organisation_id)
  then raise exception 'Project not found in organisation.'; end if;
  select exists(select 1 from public.op_project_final_settlements s
    where s.project_id=p_project_id and s.organisation_id=p_organisation_id) into v_paid;
  select exists(select 1 from public.op_project_final_release_approvals a
    where a.project_id=p_project_id and a.organisation_id=p_organisation_id) into v_approved;
  select exists(select 1 from public.partner_payments p
    where p.project_id=p_project_id and p.organisation_id=p_organisation_id
       and p.status='cleared' and nullif(trim(p.reference),'') is not null)
    and not exists(select 1 from public.partner_payables b
       where b.project_id=p_project_id and b.organisation_id=p_organisation_id
         and (b.total>b.amount_paid or b.status<>'paid')) into v_partner_paid;
  select exists(select 1 from public.project_client_reviews r where
    r.project_id=p_project_id and r.organisation_id=p_organisation_id
    and r.outcome in ('accepted','accepted_with_comments')
    and r.recorded_at=(select max(x.recorded_at) from public.project_client_reviews x
       where x.project_id=p_project_id and x.organisation_id=p_organisation_id)) into v_review;
  return jsonb_build_object('clientAccepted',v_review,'finalPaid',v_paid,
    'ownerApproved',v_approved,'partnerPaid',v_partner_paid,
    'readyForManualClosure',v_review and v_paid and v_approved and v_partner_paid);
end;$$;
revoke all on function public.op_project_voice_final_release_status(uuid,uuid,uuid) from public,anon;
grant execute on function public.op_project_voice_final_release_status(uuid,uuid,uuid) to authenticated;
