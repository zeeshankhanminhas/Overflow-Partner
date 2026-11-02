-- OPOS isolated QA: real partner onboarding controls.
-- This does NOT promote a fictional QA simulation to legal NDA evidence.
-- Partner attestations are independent, current, attributable and auditable.
create table if not exists public.op_partner_nda_verifications (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id),
 partner_id uuid not null references public.partners(id),
 evidence_reference text not null check(length(trim(evidence_reference)) between 8 and 300),
 signed_by_name text not null check(length(trim(signed_by_name)) between 3 and 200),
 signed_at timestamptz not null,
 verified_by uuid not null references public.profiles(id),
 verified_at timestamptz not null default now(),
 is_current boolean not null default true,
 created_at timestamptz not null default now(),
 check(signed_at<=verified_at)
);
create unique index if not exists op_partner_one_current_nda on public.op_partner_nda_verifications(partner_id) where is_current;
alter table public.op_partner_nda_verifications enable row level security;
revoke all on public.op_partner_nda_verifications from public,anon,authenticated;
grant select,insert,update on public.op_partner_nda_verifications to service_role;

create table if not exists public.op_partner_internal_approvals (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id),
 partner_id uuid not null references public.partners(id),
 nda_verification_id uuid not null references public.op_partner_nda_verifications(id),
 capability_evidence_reference text not null check(length(trim(capability_evidence_reference)) between 8 and 300),
 decision_note text not null check(length(trim(decision_note)) between 15 and 1000),
 approved_by uuid not null references public.profiles(id),
 approved_at timestamptz not null default now(),
 is_current boolean not null default true,
 created_at timestamptz not null default now()
);
create unique index if not exists op_partner_one_current_approval on public.op_partner_internal_approvals(partner_id) where is_current;
alter table public.op_partner_internal_approvals enable row level security;
revoke all on public.op_partner_internal_approvals from public,anon,authenticated;
grant select,insert,update on public.op_partner_internal_approvals to service_role;

create or replace function public.op_verify_partner_nda(
  p_organisation_id uuid,p_partner_id uuid,p_evidence_reference text,
  p_signed_by_name text,p_signed_at timestamptz
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_partner public.partners%rowtype; v_id uuid;
begin
 if v_actor is null then raise exception 'Signed-in reviewer required'; end if;
 perform public.op_assert_workspace_role(p_organisation_id,v_actor,array['owner','admin']);
 select * into v_partner from public.partners
  where id=p_partner_id and organisation_id=p_organisation_id for update;
 if not found then raise exception 'Partner not found for organisation'; end if;
 if v_partner.company_name like 'QA - %' or v_partner.company_name like 'OP QA TEST%' then
   raise exception 'Fictional QA partner cannot be marked as legally NDA-signed. Use the separate simulation record.';
 end if;
 if nullif(trim(coalesce(p_evidence_reference,'')),'') is null or
     length(trim(p_evidence_reference))<8 or length(trim(p_evidence_reference))>300 or
     length(trim(coalesce(p_signed_by_name,'')))<3 or
     length(trim(p_signed_by_name))>200 or p_signed_at is null
     or p_signed_at>now() then
   raise exception 'Verified signed NDA evidence, named signatory, and valid signature date are required';
 end if;
 if exists(select 1 from public.op_partner_nda_verifications where partner_id=p_partner_id and is_current) then
   raise exception 'A current NDA verification already exists. Use the governed revocation and renewal process.';
 end if;
 insert into public.op_partner_nda_verifications(
    organisation_id,partner_id,evidence_reference,signed_by_name,signed_at,verified_by
 ) values (p_organisation_id,p_partner_id,trim(p_evidence_reference),trim(p_signed_by_name),p_signed_at,v_actor)
 returning id into v_id;
 update public.partners set nda_signed=true,nda_signed_at=p_signed_at,updated_at=now()
   where id=p_partner_id and organisation_id=p_organisation_id;
 insert into public.activity_events (organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(p_organisation_id,'partner',p_partner_id,v_actor,'partner.nda_evidence_verified',
 jsonb_build_object('evidenceId',v_id,'evidenceReference',trim(p_evidence_reference),
   'legalEvidenceRequired',true,'fictional',false));
 return jsonb_build_object('evidenceId',v_id,'verified',true);
end;
$$;
revoke all on function public.op_verify_partner_nda(uuid,uuid,text,text,timestamptz) from public,anon;
grant execute on function public.op_verify_partner_nda(uuid,uuid,text,text,timestamptz) to authenticated;

create or replace function public.op_approve_partner_governed(
  p_organisation_id uuid,p_partner_id uuid,p_capability_evidence_reference text,p_decision_note text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_partner public.partners%rowtype; v_nda uuid; v_id uuid;
begin
 if v_actor is null then raise exception 'Signed-in reviewer required'; end if;
 perform public.op_assert_workspace_role(p_organisation_id,v_actor,array['owner','admin']);
 select * into v_partner from public.partners where id=p_partner_id and organisation_id=p_organisation_id for update;
 if not found then raise exception 'Partner not found'; end if;
 if v_partner.company_name like 'QA - %' or v_partner.company_name like 'OP QA TEST%' then
   raise exception 'Fictional QA partners cannot receive a real approval status.';
 end if;
 if v_partner.email is null or length(trim(v_partner.email))<5 or
   v_partner.services is null or length(trim(v_partner.services))<3 then
   raise exception 'Named partner contact and capabilities are required.';
 end if;
 if not v_partner.nda_signed or v_partner.nda_signed_at is null then
   raise exception 'Verified signed NDA required before partner approval.';
 end if;
 select n.id into v_nda from public.op_partner_nda_verifications n
 where n.partner_id=p_partner_id and n.organisation_id=p_organisation_id and n.is_current
 and n.signed_at<=n.verified_at and n.verified_at<=now();
 if v_nda is null then raise exception 'Current verified NDA record missing'; end if;
 if length(trim(coalesce(p_capability_evidence_reference,'')))<8
    or length(trim(p_capability_evidence_reference))>300
    or length(trim(coalesce(p_decision_note,'')))<15
    or length(trim(p_decision_note))>1000 then
  raise exception 'Capability evidence and substantive approval rationale are required.';
 end if;
 if exists(select 1 from public.op_partner_internal_approvals a where a.partner_id=p_partner_id and a.is_current) then
   raise exception 'Current partner approval already exists.';
 end if;
 insert into public.op_partner_internal_approvals (
  organisation_id,partner_id,nda_verification_id,capability_evidence_reference,decision_note,approved_by
 ) values (
  p_organisation_id,p_partner_id,v_nda,trim(p_capability_evidence_reference),trim(p_decision_note),v_actor
 ) returning id into v_id;
 update public.partners set status='approved',updated_at=now()
  where id=p_partner_id and organisation_id=p_organisation_id;
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(p_organisation_id,'partner',p_partner_id,v_actor,'partner.governed_approval_recorded',
  jsonb_build_object('approvalId',v_id,'ndaVerificationId',v_nda,'fictional',false));
 return jsonb_build_object('approvalId',v_id,'approved',true);
end;
$$;
revoke all on function public.op_approve_partner_governed(uuid,uuid,text,text) from public,anon;
grant execute on function public.op_approve_partner_governed(uuid,uuid,text,text) to authenticated;

-- New projects must have partner evidence from BEFORE the client quotation.
-- Historical Northfield approvals cannot be backdated by changing current flags.
create or replace function public.op_partner_prequote_governance_ready(
  p_organisation_id uuid,p_partner_id uuid,p_quoted_at timestamptz
) returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
   select 1 from public.partners p
   join public.op_partner_nda_verifications n on n.partner_id=p.id
       and n.organisation_id=p_organisation_id and n.is_current
   join public.op_partner_internal_approvals a on a.partner_id=p.id
       and a.organisation_id=p_organisation_id and a.nda_verification_id=n.id and a.is_current
   where p.id=p_partner_id and p.organisation_id=p_organisation_id
     and p.status::text='approved' and p.nda_signed=true
     and n.signed_at<=n.verified_at
     and n.verified_at<=a.approved_at and a.approved_at<=p_quoted_at
     and p_quoted_at is not null
 )
$$;
revoke all on function public.op_partner_prequote_governance_ready(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.op_partner_prequote_governance_ready(uuid,uuid,timestamptz) to service_role;
