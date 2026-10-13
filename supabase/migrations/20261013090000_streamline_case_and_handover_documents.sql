begin;

-- Technical Intake approval is the Case's approved technical scope. Do not
-- generate a second Scope of Work document; keep the Partner assessment report
-- as controlled evidence for the commercial decision.
create or replace function public.op_approve_technical_intake(
  p_organisation_id uuid,
  p_user_id uuid,
  p_intake_id uuid
) returns public.technical_intakes
language plpgsql security definer set search_path=public
as $$
declare
  v_intake public.technical_intakes;
  v_ref text;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  select * into v_intake
  from public.technical_intakes
  where organisation_id=p_organisation_id and id=p_intake_id
  for update;
  if not found then raise exception 'Technical intake not found.'; end if;
  if v_intake.status not in ('submitted','under_review','clarification_required','draft') then
    raise exception 'Technical intake is not in an approvable state.';
  end if;
  if nullif(trim(v_intake.description),'') is null then raise exception 'Technical description is required.'; end if;
  if nullif(trim(coalesce(v_intake.deliverables,'')),'') is null then raise exception 'Deliverables are required.'; end if;
  if nullif(trim(coalesce(v_intake.project_type,'')),'') is null then raise exception 'Project type is required.'; end if;
  if not exists(
    select 1 from public.documents d
    where d.organisation_id=p_organisation_id and d.lead_id=v_intake.lead_id
      and d.document_type='client-requirements'
      and d.status::text in ('approved','issued','published') and d.is_current_revision=true
  ) then raise exception 'Approved Client Requirements are required before Technical Scope approval.'; end if;
  if not exists(
    select 1 from public.partner_review_requests r
    where r.organisation_id=p_organisation_id and r.lead_id=v_intake.lead_id
      and r.status::text in ('approved','approved_with_conditions')
  ) then raise exception 'OS_INTEGRITY: Case 360 is missing the approved Partner Review inherited from Acquisition.'; end if;

  update public.technical_intakes
  set status='approved',reviewed_by=p_user_id,reviewed_at=now(),updated_at=now()
  where id=p_intake_id returning * into v_intake;
  update public.leads
  set status='qualified',next_action='Approve Partner Technical Assessment evidence',updated_at=now()
  where organisation_id=p_organisation_id and id=v_intake.lead_id;

  if not exists(
    select 1 from public.documents
    where organisation_id=p_organisation_id and lead_id=v_intake.lead_id
      and document_type='partner-technical-assessment-report' and status::text<>'superseded'
  ) then
    v_ref:=public.op_next_reference(p_organisation_id,'document',null);
    insert into public.documents(organisation_id,lead_id,technical_intake_id,created_by,document_type,reference,title,status,version)
    values(p_organisation_id,v_intake.lead_id,v_intake.id,p_user_id,'partner-technical-assessment-report',v_ref,'Partner Technical Assessment Report','draft',1);
  end if;
  perform public.op_record_activity(
    p_organisation_id,p_user_id,'technical_intake',v_intake.id,'technical_intake_approved',
    jsonb_build_object('leadId',v_intake.lead_id,'canonicalLifecycle',true)
  );
  return v_intake;
end $$;

-- The approved Technical Intake plus the inherited Partner Assessment Report
-- replace the duplicate Case Scope of Work document as commercial prerequisites.
create or replace function public.op_create_commercial_review(
  p_organisation_id uuid,
  p_user_id uuid,
  p_partner_quote_id uuid,
  p_markup_percent numeric
) returns public.commercial_reviews
language plpgsql security definer set search_path=public
as $$
declare
  v_quote public.partner_quotes;
  v_request public.partner_review_requests;
  v_response public.partner_review_responses;
  v_decision public.partner_review_internal_decisions;
  v_review public.commercial_reviews;
  v_cost numeric;
  v_client_price numeric;
  v_margin numeric;
  v_margin_percent numeric;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_markup_percent is null or p_markup_percent<0 or p_markup_percent>500 then
    raise exception 'Markup must be between 0 and 500.';
  end if;
  select * into v_quote from public.partner_quotes
  where id=p_partner_quote_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Partner pricing not found.'; end if;
  if v_quote.lead_id is null or v_quote.prospect_id is not null then
    raise exception 'Commercial margin can only be created after the opportunity is owned by Case 360.';
  end if;
  if v_quote.status::text not in ('received','selected') then
    raise exception 'Commercial review requires received governed partner pricing.';
  end if;
  if coalesce(v_quote.price,0)<=0 then raise exception 'A positive governed partner cost is required before margin can be set.'; end if;
  if v_quote.partner_review_request_id is null or v_quote.partner_review_response_id is null then
    raise exception 'Commercial review requires the inherited governed partner response.';
  end if;

  select * into v_request from public.partner_review_requests
  where id=v_quote.partner_review_request_id and organisation_id=p_organisation_id
    and lead_id=v_quote.lead_id and partner_id=v_quote.partner_id;
  if not found or v_request.status::text not in ('approved','approved_with_conditions') then
    raise exception 'The inherited partner review must have an approved Go / No-Go decision before margin can be set.';
  end if;
  select * into v_response from public.partner_review_responses
  where id=v_quote.partner_review_response_id and partner_review_request_id=v_request.id;
  if not found or v_response.feasibility::text not in ('feasible','feasible_with_conditions') then
    raise exception 'A feasible governed partner response is required before margin can be set.';
  end if;
  select * into v_decision from public.partner_review_internal_decisions
  where partner_review_request_id=v_request.id and partner_review_response_id=v_response.id
    and decision::text in ('approved','approved_with_conditions')
  order by created_at desc limit 1;
  if not found then raise exception 'Internal Go / No-Go approval is required before margin can be set.'; end if;
  if not exists(
    select 1 from public.technical_intakes
    where organisation_id=p_organisation_id and lead_id=v_quote.lead_id and status='approved'
  ) then raise exception 'Approved Technical Scope is required before Commercial Review.'; end if;
  if not exists(
    select 1 from public.documents
    where organisation_id=p_organisation_id and lead_id=v_quote.lead_id
      and document_type='partner-technical-assessment-report'
      and status::text in ('approved','issued','published') and is_current_revision=true
  ) then raise exception 'Approved Partner Technical Assessment is required before Commercial Review.'; end if;
  if exists(
    select 1 from public.commercial_reviews
    where organisation_id=p_organisation_id and lead_id=v_quote.lead_id
      and status::text in ('draft','pending_approval','approved')
  ) then raise exception 'An active Commercial Review already exists for this Case.'; end if;

  v_cost:=v_quote.price;
  v_client_price:=round(v_cost*(1+p_markup_percent/100.0),2);
  v_margin:=round(v_client_price-v_cost,2);
  v_margin_percent:=case when v_client_price>0 then round((v_margin/v_client_price)*100.0,4) else 0 end;
  insert into public.commercial_reviews(
    organisation_id,lead_id,partner_quote_id,cost_price,client_price,margin_amount,margin_percent,status,created_by
  ) values (
    p_organisation_id,v_quote.lead_id,v_quote.id,v_cost,v_client_price,v_margin,v_margin_percent,'pending_approval',p_user_id
  ) returning * into v_review;
  update public.leads
  set status='pricing',next_action='Approve commercial position and generate controlled Client Quote',updated_at=now()
  where organisation_id=p_organisation_id and id=v_quote.lead_id;
  perform public.op_record_activity(
    p_organisation_id,p_user_id,'lead',v_quote.lead_id,'commercial_margin_created',
    jsonb_build_object('commercialReviewId',v_review.id,'partnerQuoteId',v_quote.id,'costPrice',v_cost,
      'markupPercent',p_markup_percent,'clientPrice',v_client_price,'canonicalLifecycle',true)
  );
  return v_review;
end $$;

-- Keep the established readiness checks and later closeout controls while
-- removing only the redundant Scope of Work prerequisite.
alter function public.op_project_stage_readiness(uuid)
  rename to op_project_stage_readiness_with_duplicate_scope_gate;

create or replace function public.op_project_stage_readiness(p_project_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  v_base jsonb;
  v_reasons jsonb;
begin
  v_base:=public.op_project_stage_readiness_with_duplicate_scope_gate(p_project_id);
  select coalesce(jsonb_agg(reason.value order by reason.ordinality),'[]'::jsonb)
  into v_reasons
  from jsonb_array_elements(coalesce(v_base->'reasons','[]'::jsonb)) with ordinality as reason(value,ordinality)
  where reason.value #>> '{}' not in (
    'Approved Scope of Work is required.',
    'An approved Scope of Work is required.',
    'Approved execution scope is required.'
  );
  return v_base||jsonb_build_object('reasons',v_reasons,'ready',jsonb_array_length(v_reasons)=0);
end $$;

revoke all on function public.op_project_stage_readiness(uuid) from public,anon;
grant execute on function public.op_project_stage_readiness(uuid) to authenticated,service_role;

-- New partner releases use the single approved Statement of Work.
create or replace function public.op_guard_project_execution_assignment()
returns trigger language plpgsql set search_path=public
as $$
declare
  v_commercial_partner_id uuid;
  v_partner public.partners;
  v_doc public.documents;
begin
  select pq.partner_id into v_commercial_partner_id
  from public.projects p
  join public.quotes q on q.id=p.quote_id
  join public.commercial_reviews cr on cr.id=q.commercial_review_id
  join public.partner_quotes pq on pq.id=cr.partner_quote_id
  where p.id=new.project_id and p.organisation_id=new.organisation_id;
  if v_commercial_partner_id is null then raise exception 'OS_INTEGRITY: Project has no commercially selected Execution Partner lineage.'; end if;
  if new.partner_id is distinct from v_commercial_partner_id then raise exception 'Execution Partner must match the Partner approved in the accepted commercial position.'; end if;
  select * into v_partner from public.partners where id=new.partner_id and organisation_id=new.organisation_id;
  if not found or v_partner.status<>'approved' or not coalesce(v_partner.nda_signed,false) then raise exception 'Execution Partner must be approved and NDA-ready.'; end if;
  if new.scope_document_id is null then raise exception 'An approved Statement of Work is required before Partner release.'; end if;
  select * into v_doc from public.documents
  where id=new.scope_document_id and organisation_id=new.organisation_id and project_id=new.project_id;
  if not found or v_doc.document_type<>'statement-of-work'
    or v_doc.status::text not in ('approved','issued','published') or not v_doc.is_current_revision then
    raise exception 'Execution release must link the current approved Statement of Work.';
  end if;
  return new;
end $$;

revoke all on function public.op_guard_project_execution_assignment() from public,anon,authenticated;

commit;
