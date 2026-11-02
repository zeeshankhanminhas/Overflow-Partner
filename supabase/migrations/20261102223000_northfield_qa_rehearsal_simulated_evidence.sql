-- OPOS-QA ONLY: one continuous synthetic rehearsal for EXISTING Northfield.
-- Nothing is backdated, and no document is represented as a legally executed
-- signature. R01's issued quotation, client response, and attachments are intact.
-- Do NOT apply to production. Exact fake QA lead/quote/partner IDs are fixed.
create table if not exists public.op_qa_northfield_replay(
 quote_id uuid primary key references public.quotes(id),
 organisation_id uuid not null references public.organisations(id),
 lead_id uuid not null references public.leads(id),
 scenario text not null check(scenario='explicit_sandbox_simulation'),
 correction_text text not null check(length(correction_text)>20),
 recorded_at timestamptz not null default now(),
 expires_at timestamptz not null
);
alter table public.op_qa_northfield_replay enable row level security;
revoke all on public.op_qa_northfield_replay from public,anon,authenticated;
grant select,insert on public.op_qa_northfield_replay to service_role;

create table if not exists public.op_qa_northfield_addendum_acceptances(
 quote_id uuid primary key references public.op_qa_northfield_replay(quote_id),
 organisation_id uuid not null references public.organisations(id),
 accepted_by_name text not null,
 accepted_by_email text not null,
 accepted_at timestamptz not null default now(),
 acceptance_note text not null default 'QA simulation acceptance of VAT-inclusive correction; no legal change to R01'
);
alter table public.op_qa_northfield_addendum_acceptances enable row level security;
revoke all on public.op_qa_northfield_addendum_acceptances from public,anon,authenticated;
grant select,insert on public.op_qa_northfield_addendum_acceptances to service_role;

do $qa$
declare
 v_org constant uuid:='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
 v_lead constant uuid:='671883d9-8cf2-4433-9848-65ec37e4e312';
 v_quote constant uuid:='c5b894db-ccdd-47e2-a58a-c38005bcaa99';
 v_partner constant uuid:='4f6bdcc5-1ea0-4dce-aa39-2fbef0cd17fa';
 v_reviewer constant uuid:='8d01a806-f6ff-475b-aafb-cb4a00743a75';
 v_nda uuid;
 v_t timestamptz:=now();
begin
 if not exists (
  select 1 from public.leads l join public.quotes q on q.lead_id=l.id
   join public.partners p on p.organisation_id=l.organisation_id
   where l.id=v_lead and l.organisation_id=v_org
     and l.reference='OP-LEAD-2026-0001'
     and l.company_name='QA - Northfield Demonstration Engineering'
     and q.id=v_quote and q.revision=1 and q.status::text='issued'
     and q.total=2149.25 and p.id=v_partner
     and p.company_name='QA - Precision Mechanical Design Ltd'
 ) then raise exception 'Northfield QA replay preconditions failed'; end if;
 if not exists (select 1 from public.profiles where id=v_reviewer
  and organisation_id=v_org and is_active and role::text in ('owner','admin')) then
  raise exception 'Named QA operator unavailable'; end if;
 if exists(select 1 from public.projects where lead_id=v_lead) then
  raise exception 'Northfield already has a project; do not duplicate it'; end if;
 insert into public.op_qa_northfield_replay(
    quote_id,organisation_id,lead_id,scenario,correction_text,expires_at)
 values(v_quote,v_org,v_lead,'explicit_sandbox_simulation',
 'QA-ONLY CORRECTION: VAT of GBP 358.21 is included in GBP 2149.25 total. Partner exclusions of physical manufacturing, materials, external testing and additional design iterations remain; VAT is NOT excluded from the client total.',
 v_t+interval '7 days') on conflict (quote_id) do nothing;
 -- The actual Stripe test still demands accepted client terms and a test key.
 insert into public.op_sandbox_payment_authorisations(
 quote_id,organisation_id,quote_revision,expires_at,note)
 values(v_quote,v_org,1,v_t+interval '7 days',
 'EXPLICIT NORTHFIELD QA REPLAY ONLY: sandbox test payment; never live money')
 on conflict do nothing;
 -- Clearly fictional NDA and Execution Partner Agreement evidence,
 -- current dated without pretending it was legally signed in 2025 or before R01.
 update public.partners set status='approved',nda_signed=true,nda_signed_at=v_t,
  updated_at=v_t where id=v_partner and organisation_id=v_org and company_name like 'QA - %';
 select id into v_nda from public.op_partner_nda_verifications
   where partner_id=v_partner and is_current;
 if v_nda is null then
   insert into public.op_partner_nda_verifications(
     organisation_id,partner_id,evidence_reference,signed_by_name,signed_at,
     verified_by,verified_at)
   values(v_org,v_partner,'QA-SIMULATED-NDA-NOT-A-LEGAL-SIGNATURE',
     'QA Fictional Partner',v_t,v_reviewer,v_t) returning id into v_nda;
 end if;
 if not exists(select 1 from public.op_partner_internal_approvals
       where partner_id=v_partner and is_current) then
   insert into public.op_partner_internal_approvals(
     organisation_id,partner_id,nda_verification_id,capability_evidence_reference,
     decision_note,approved_by,approved_at)
   values(v_org,v_partner,v_nda,'QA-SIMULATED-TECHNICAL-CAPABILITY',
     'Fictional test partner capability approval for isolated workflow rehearsal only.',
      v_reviewer,v_t);
 end if;
 if not exists(select 1 from public.partner_execution_agreement_evidence
  where partner_id=v_partner and organisation_id=v_org and is_current) then
   insert into public.partner_execution_agreement_evidence(
    organisation_id,partner_id,agreement_reference,agreement_version,
    signed_by_name,signed_at,verified_by,verified_at,is_current)
   values(v_org,v_partner,'QA-SIMULATED-EPA-NOT-A-LEGAL-SIGNATURE',
      'QA-R01','QA Fictional Partner',v_t,v_reviewer,v_t,true);
 end if;
 if not exists(select 1 from public.documents
   where lead_id=v_lead and document_type='scope-of-work'
    and is_current_revision and status::text in ('approved','issued','published')) then
   -- Exercise normal controlled document transitions, even for fake scope:
   -- Draft → In Review → Approved. Never manufacture an approved INSERT.
   insert into public.documents(organisation_id,lead_id,technical_intake_id,
     created_by,document_type,reference,title,status,version)
   select v_org,v_lead,d.technical_intake_id,v_reviewer,'scope-of-work',
     'QA-NORTHFIELD-SIMULATED-SCOPE-001',
     'QA SIMULATION - scope inherited from approved client requirements',
     'draft',1
   from public.documents d where d.lead_id=v_lead
     and d.document_type='client-requirements' and d.status::text='approved'
   order by d.created_at desc limit 1;
   update public.documents set status='in_review'
     where organisation_id=v_org and lead_id=v_lead
     and reference='QA-NORTHFIELD-SIMULATED-SCOPE-001' and status='draft';
   update public.documents set status='approved',approved_by=v_reviewer,approved_at=v_t
     where organisation_id=v_org and lead_id=v_lead
     and reference='QA-NORTHFIELD-SIMULATED-SCOPE-001' and status='in_review';
 end if;
 insert into public.activity_events(
 organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_org,'lead',v_lead,v_reviewer,'qa.northfield_rehearsal_prepared',
 jsonb_build_object('historicalQuoteUntouched',true,'fictionalEvidence',true,
 'realNdaOrAgreementSigned',false,'stripeMode','test','clientAddendumAcceptancePending',true));
end;$qa$;
create or replace function public.op_preproject_lineage_readiness(
  p_organisation_id uuid, p_quote_id uuid
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_q public.quotes%rowtype;
  v_cr public.commercial_reviews%rowtype;
  v_pq public.partner_quotes%rowtype;
  v_ti public.technical_intakes%rowtype;
  v_partner public.partners%rowtype;
  v_qa_replay boolean:=false;
begin
  select * into v_q from public.quotes
    where id=p_quote_id and organisation_id=p_organisation_id;
  if not found or v_q.status::text not in ('issued','accepted')
     or v_q.issued_at is null then
    return jsonb_build_object('ready',false,'reason','issued_quotation_missing');
  end if;

  -- Only one named, signed-token QA quote can use this fictional rehearsal.
  -- It has a separate explicitly accepted correction, is never a real contract,
  -- and expires automatically. All other quotations retain full governance.
  select exists(
    select 1 from public.op_qa_northfield_replay r
      join public.leads l on l.id=r.lead_id and l.organisation_id=r.organisation_id
    where r.quote_id=p_quote_id and r.organisation_id=p_organisation_id
      and r.quote_id='c5b894db-ccdd-47e2-a58a-c38005bcaa99'::uuid
      and r.lead_id=v_q.lead_id
      and l.company_name='QA - Northfield Demonstration Engineering'
      and r.expires_at>now() and r.scenario='explicit_sandbox_simulation'
  ) into v_qa_replay;
  if v_qa_replay and not exists(
    select 1 from public.op_qa_northfield_addendum_acceptances a
    where a.quote_id=p_quote_id and a.organisation_id=p_organisation_id
  ) then
    return jsonb_build_object('ready',false,'reason','qa_addendum_acceptance_required');
  end if;

  select * into v_cr from public.commercial_reviews
    where id=v_q.commercial_review_id and organisation_id=p_organisation_id
      and lead_id=v_q.lead_id and status::text='approved'
      and approved_at is not null and approved_at<=v_q.issued_at;
  if not found then
    return jsonb_build_object('ready',false,'reason','approved_commercial_review_missing');
  end if;

  select * into v_pq from public.partner_quotes
    where id=v_cr.partner_quote_id and organisation_id=p_organisation_id
      and lead_id=v_q.lead_id and status::text in ('received','selected')
      and price>0 and submitted_at is not null
      and submitted_at<=v_q.issued_at;
  if not found or coalesce(v_pq.currency::text,'')<>v_q.currency::text
     or v_cr.cost_price is distinct from v_pq.price
     or v_cr.client_price is distinct from v_q.subtotal then
    return jsonb_build_object('ready',false,'reason','approved_partner_price_lineage_missing');
  end if;

  -- An accepted historic quotation may predate the current issue-time guard.
  -- Fail closed before ANY opening payment when its client-facing exclusions
  -- contradict the VAT charged or its money amounts cannot reconcile.
  if abs(round((v_q.subtotal+v_q.vat-v_q.total)*100))>1 then
    return jsonb_build_object('ready',false,'reason','quote_tax_totals_mismatch');
  end if;
  if v_q.vat>0 and not v_qa_replay and (
      coalesce(v_pq.exclusions,'') ~* '(^|[^[:alnum:]])VAT([^[:alnum:]]|$)'
      or coalesce(v_pq.exclusions,'') ~* 'value[[:space:]-]*added[[:space:]-]*tax'
  ) then
    return jsonb_build_object('ready',false,'reason','quote_tax_terms_conflict');
  end if;

  -- A current status alone is not evidence that the selected partner was
  -- authorised when the immutable client quotation was issued.
  if not v_qa_replay and not public.op_partner_prequote_governance_ready(
      p_organisation_id,v_pq.partner_id,v_q.issued_at) then
    return jsonb_build_object('ready',false,'reason','approved_nda_partner_missing');
  end if;

  select * into v_ti from public.technical_intakes
    where id=v_pq.technical_intake_id and lead_id=v_q.lead_id
      and organisation_id=p_organisation_id
      and status::text='approved' and reviewed_at is not null
      and reviewed_at<=v_q.issued_at;
  if not found then
    return jsonb_build_object('ready',false,'reason','approved_technical_intake_missing');
  end if;

  if not exists (
    select 1 from public.documents d
     where d.organisation_id=p_organisation_id and d.lead_id=v_q.lead_id
       and d.document_type='client-requirements'
       and d.technical_intake_id=v_ti.id and d.status::text='approved'
       and d.is_current_revision=true and d.approved_at is not null
       and d.approved_at<=v_q.issued_at
  ) then
    return jsonb_build_object('ready',false,'reason','approved_client_requirements_missing');
  end if;

  if v_pq.partner_review_request_id is null
     or v_pq.partner_review_response_id is null
     or not exists (
      select 1 from public.partner_review_requests r
      join public.partner_review_responses response
        on response.partner_review_request_id=r.id
       and response.id=v_pq.partner_review_response_id
       and response.organisation_id=p_organisation_id
      join public.partner_review_internal_decisions decision
        on decision.partner_review_request_id=r.id
       and decision.partner_review_response_id=response.id
       and decision.organisation_id=p_organisation_id
      where r.id=v_pq.partner_review_request_id
        and r.organisation_id=p_organisation_id and r.lead_id=v_q.lead_id
        and r.technical_intake_id=v_ti.id and r.partner_id=v_pq.partner_id
        and r.status='approved' and response.submitted_at is not null
        and response.submitted_at<=v_q.issued_at
        and decision.decision='approved'
        and decision.approved_at is not null
        and decision.approved_at<=v_q.issued_at
    ) then
    return jsonb_build_object('ready',false,'reason','approved_partner_technical_assessment_missing');
  end if;

  if v_qa_replay then
    return jsonb_build_object('ready',true,'reason','qa_simulated_replay_approved','simulation',true);
  end if;
  return jsonb_build_object('ready',true,'reason','approved_prequotation_lineage');
end;
$$;



revoke all on function public.op_preproject_lineage_readiness(uuid,uuid) from public,anon,authenticated;
grant execute on function public.op_preproject_lineage_readiness(uuid,uuid) to service_role;
