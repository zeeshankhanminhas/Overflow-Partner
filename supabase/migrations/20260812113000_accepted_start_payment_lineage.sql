-- Operator Experience Recomposition — Wave 5
-- Make the client start-payment requirement part of the governed commercial
-- lineage before Project creation. Commercial Review owns the decision,
-- Client Quote carries the accepted term, and Project commercial_terms are
-- created automatically from that accepted Quote. Payments remains the sole
-- settlement source of truth.

alter table public.commercial_reviews
  add column if not exists start_payment_percent numeric(6,2),
  add column if not exists payment_terms_days integer;

alter table public.quotes
  add column if not exists start_payment_percent numeric(6,2),
  add column if not exists payment_terms_days integer;

alter table public.commercial_reviews
  drop constraint if exists commercial_reviews_start_payment_percent_check,
  add constraint commercial_reviews_start_payment_percent_check
    check (start_payment_percent is null or (start_payment_percent > 0 and start_payment_percent <= 100)),
  drop constraint if exists commercial_reviews_payment_terms_days_check,
  add constraint commercial_reviews_payment_terms_days_check
    check (payment_terms_days is null or payment_terms_days >= 0);

alter table public.quotes
  drop constraint if exists quotes_start_payment_percent_check,
  add constraint quotes_start_payment_percent_check
    check (start_payment_percent is null or (start_payment_percent > 0 and start_payment_percent <= 100)),
  drop constraint if exists quotes_payment_terms_days_check,
  add constraint quotes_payment_terms_days_check
    check (payment_terms_days is null or payment_terms_days >= 0);

-- Retire the old commercial-review entry point so a direct RPC call cannot
-- create a positive-value commercial position with no governed start term.
create or replace function public.op_create_commercial_review(
  p_organisation_id uuid,
  p_user_id uuid,
  p_partner_quote_id uuid,
  p_markup_percent numeric
)
returns public.commercial_reviews
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  raise exception 'OS_INTEGRITY: Use the governed Commercial Review action with an explicit client start-payment term.';
end;
$function$;

create or replace function public.op_create_commercial_review(
  p_organisation_id uuid,
  p_user_id uuid,
  p_partner_quote_id uuid,
  p_markup_percent numeric,
  p_start_payment_percent numeric,
  p_payment_terms_days integer
)
returns public.commercial_reviews
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  if p_markup_percent is null or p_markup_percent<0 or p_markup_percent>500 then raise exception 'Markup must be between 0 and 500.'; end if;
  if p_start_payment_percent is null or p_start_payment_percent<=0 or p_start_payment_percent>100 then raise exception 'Client start payment must be greater than 0% and no more than 100%.'; end if;
  if p_payment_terms_days is null or p_payment_terms_days<0 then raise exception 'Payment terms days must be zero or greater.'; end if;

  select * into v_quote from public.partner_quotes where id=p_partner_quote_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Partner pricing not found.'; end if;
  if v_quote.lead_id is null or v_quote.prospect_id is not null then raise exception 'Commercial Review can only be created after Case 360 owns the opportunity.'; end if;
  if v_quote.status::text not in ('received','selected') or coalesce(v_quote.price,0)<=0 then raise exception 'Positive governed Partner pricing is required.'; end if;

  select * into v_request from public.partner_review_requests where id=v_quote.partner_review_request_id and organisation_id=p_organisation_id and lead_id=v_quote.lead_id and partner_id=v_quote.partner_id;
  if not found or v_request.status::text not in ('approved','approved_with_conditions') then raise exception 'Inherited Partner Review must be approved before commercial progression.'; end if;
  select * into v_response from public.partner_review_responses where id=v_quote.partner_review_response_id and partner_review_request_id=v_request.id;
  if not found or v_response.feasibility::text not in ('feasible','feasible_with_conditions') then raise exception 'A feasible governed Partner response is required.'; end if;
  select * into v_decision from public.partner_review_internal_decisions where partner_review_request_id=v_request.id and partner_review_response_id=v_response.id and decision::text in ('approved','approved_with_conditions') order by created_at desc limit 1;
  if not found then raise exception 'Internal Go / No-Go approval is required.'; end if;
  if not exists(select 1 from public.technical_intakes where organisation_id=p_organisation_id and lead_id=v_quote.lead_id and status='approved') then raise exception 'Approved Technical Scope is required before Commercial Review.'; end if;
  if not exists(select 1 from public.documents where organisation_id=p_organisation_id and lead_id=v_quote.lead_id and document_type='scope-of-work' and status::text in ('approved','issued','published') and is_current_revision=true) then raise exception 'Approved Scope of Work is required before Commercial Review.'; end if;
  if not exists(select 1 from public.documents where organisation_id=p_organisation_id and lead_id=v_quote.lead_id and document_type='partner-technical-assessment-report' and status::text in ('approved','issued','published') and is_current_revision=true) then raise exception 'Approved Partner Technical Assessment is required before Commercial Review.'; end if;
  if exists(select 1 from public.commercial_reviews where organisation_id=p_organisation_id and lead_id=v_quote.lead_id and status::text in ('draft','pending_approval','approved')) then raise exception 'An active Commercial Review already exists for this Case.'; end if;

  v_cost:=v_quote.price;
  v_client_price:=round(v_cost*(1+p_markup_percent/100.0),2);
  v_margin:=round(v_client_price-v_cost,2);
  v_margin_percent:=case when v_client_price>0 then round((v_margin/v_client_price)*100.0,4) else 0 end;

  insert into public.commercial_reviews(
    organisation_id,lead_id,partner_quote_id,cost_price,client_price,margin_amount,margin_percent,
    start_payment_percent,payment_terms_days,status,created_by
  ) values(
    p_organisation_id,v_quote.lead_id,v_quote.id,v_cost,v_client_price,v_margin,v_margin_percent,
    p_start_payment_percent,p_payment_terms_days,'pending_approval',p_user_id
  ) returning * into v_review;

  update public.leads set status='pricing',next_action='Approve commercial position and generate controlled Client Quote',updated_at=now() where organisation_id=p_organisation_id and id=v_quote.lead_id;
  perform public.op_record_activity(p_organisation_id,p_user_id,'lead',v_quote.lead_id,'commercial_margin_created',jsonb_build_object(
    'commercialReviewId',v_review.id,'partnerQuoteId',v_quote.id,'costPrice',v_cost,'markupPercent',p_markup_percent,
    'clientPrice',v_client_price,'startPaymentPercent',p_start_payment_percent,'paymentTermsDays',p_payment_terms_days,
    'canonicalLifecycle',true
  ));
  return v_review;
end;
$function$;

create or replace function public.op_approve_commercial_generate_quote(
  p_organisation_id uuid,
  p_user_id uuid,
  p_review_id uuid,
  p_currency text default 'GBP'::text,
  p_vat_rate numeric default 20
)
returns public.quotes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_review public.commercial_reviews;
  v_quote public.quotes;
  v_number text;
  v_vat numeric;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_vat_rate<0 or p_vat_rate>100 then raise exception 'VAT rate must be between 0 and 100.'; end if;
  select * into v_review from public.commercial_reviews where organisation_id=p_organisation_id and id=p_review_id for update;
  if not found then raise exception 'Commercial Review not found.'; end if;
  if v_review.status::text not in ('pending_approval','draft') then raise exception 'Commercial Review is not awaiting approval.'; end if;
  if coalesce(v_review.client_price,0)<=0 then raise exception 'Client price must be greater than zero.'; end if;
  if coalesce(v_review.start_payment_percent,0)<=0 then raise exception 'A governed client start-payment percentage is required before quotation.'; end if;
  if v_review.payment_terms_days is null or v_review.payment_terms_days<0 then raise exception 'Governed payment terms are required before quotation.'; end if;

  select * into v_quote from public.quotes where organisation_id=p_organisation_id and commercial_review_id=p_review_id;
  if found then return v_quote; end if;

  update public.commercial_reviews set status='approved',approved_by=p_user_id,approved_at=now(),updated_at=now() where id=p_review_id;
  v_number:=public.op_next_reference(p_organisation_id,'quote',1);
  v_vat:=round((v_review.client_price*p_vat_rate/100.0)::numeric,2);
  insert into public.quotes(
    organisation_id,created_by,lead_id,commercial_review_id,quote_number,revision,status,subtotal,vat,total,currency,
    start_payment_percent,payment_terms_days
  ) values(
    p_organisation_id,p_user_id,v_review.lead_id,v_review.id,v_number,1,'draft',v_review.client_price,v_vat,
    v_review.client_price+v_vat,upper(p_currency),v_review.start_payment_percent,v_review.payment_terms_days
  ) returning * into v_quote;

  insert into public.documents(organisation_id,lead_id,quote_id,created_by,document_type,reference,title,status,version)
  values(p_organisation_id,v_review.lead_id,v_quote.id,p_user_id,'client-quote',v_number,'Client Quote '||v_number,'draft',1)
  on conflict(organisation_id,reference) do nothing;
  update public.leads set status='pricing',next_action='Approve controlled Client Quote for issue',updated_at=now() where organisation_id=p_organisation_id and id=v_review.lead_id;
  perform public.op_record_activity(p_organisation_id,p_user_id,'quote',v_quote.id,'client_quote_generated',jsonb_build_object(
    'commercialReviewId',p_review_id,'vatRate',p_vat_rate,'documentType','client-quote',
    'startPaymentPercent',v_review.start_payment_percent,'paymentTermsDays',v_review.payment_terms_days,'canonicalLifecycle',true
  ));
  return v_quote;
end;
$function$;

create or replace function public.op_accept_quote_create_project_with_acceptance(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_acceptance_basis text,
  p_evidence_reference text,
  p_accepted_by_name text,
  p_accepted_by_email text default null::text,
  p_notes text default null::text
)
returns public.projects
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_quote public.quotes;
  v_lead public.leads;
  v_project public.projects;
  v_number text;
  v_stw_ref text;
  v_required numeric(14,2);
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_acceptance_basis not in ('signed_quote','purchase_order','email_confirmation','client_portal','other_written') then raise exception 'Select a valid written acceptance basis.'; end if;
  if nullif(trim(coalesce(p_evidence_reference,'')),'') is null then raise exception 'Acceptance evidence reference is required.'; end if;
  if nullif(trim(coalesce(p_accepted_by_name,'')),'') is null then raise exception 'Client acceptance name is required.'; end if;

  select * into v_quote from public.quotes where organisation_id=p_organisation_id and id=p_quote_id for update;
  if not found then raise exception 'Quote not found.'; end if;
  select * into v_project from public.projects where organisation_id=p_organisation_id and quote_id=p_quote_id;
  if found then return v_project; end if;
  if v_quote.status::text<>'issued' then raise exception 'Only an issued Quote can be accepted.'; end if;
  if v_quote.valid_until is not null and v_quote.valid_until<current_date then raise exception 'Quote has expired.'; end if;
  if not exists(select 1 from public.documents where organisation_id=p_organisation_id and quote_id=p_quote_id and document_type='client-quote' and status::text in ('issued','published') and is_current_revision=true) then raise exception 'Controlled Client Quote must be issued before acceptance can create a Project.'; end if;
  if coalesce(v_quote.total,0)>0 and coalesce(v_quote.start_payment_percent,0)<=0 then raise exception 'Issued Quote is missing its governed client start-payment term.'; end if;
  if v_quote.payment_terms_days is null or v_quote.payment_terms_days<0 then raise exception 'Issued Quote is missing its governed payment terms.'; end if;

  select * into v_lead from public.leads where organisation_id=p_organisation_id and id=v_quote.lead_id;
  if not found then raise exception 'Case 360 record not found.'; end if;

  insert into public.quote_acceptance_records(organisation_id,quote_id,lead_id,acceptance_basis,evidence_reference,accepted_by_name,accepted_by_email,notes,recorded_by)
  values(p_organisation_id,v_quote.id,v_quote.lead_id,p_acceptance_basis,trim(p_evidence_reference),trim(p_accepted_by_name),nullif(trim(coalesce(p_accepted_by_email,'')),''),nullif(trim(coalesce(p_notes,'')),''),p_user_id);
  update public.quotes set status='accepted',accepted_at=now(),updated_at=now() where id=p_quote_id;
  update public.leads set status='won',next_action='Project 360 owns delivery',updated_at=now() where organisation_id=p_organisation_id and id=v_quote.lead_id;

  v_number:=public.op_next_reference(p_organisation_id,'project',null);
  insert into public.projects(organisation_id,created_by,project_manager_id,lead_id,quote_id,project_number,title,status,start_date,notes,project_stage)
  values(p_organisation_id,p_user_id,p_user_id,v_quote.lead_id,v_quote.id,v_number,coalesce(nullif(v_lead.title,''),v_lead.company_name||' engineering project'),'planning',current_date,v_lead.notes,'mobilisation') returning * into v_project;

  v_required:=case when coalesce(v_quote.total,0)<=0 then 0 else round(v_quote.total*v_quote.start_payment_percent/100.0,2) end;
  insert into public.commercial_terms(
    organisation_id,project_id,quote_id,authorisation_basis,payment_terms_days,deposit_percent,deposit_required_amount,
    po_number,credit_approved,override_reason,authorised_by,authorised_at,created_by,updated_at
  ) values(
    p_organisation_id,v_project.id,v_quote.id,'deposit',coalesce(v_quote.payment_terms_days,0),coalesce(v_quote.start_payment_percent,0),v_required,
    null,false,null,null,null,p_user_id,now()
  );

  update public.documents set project_id=v_project.id,lead_id=null,quote_id=coalesce(quote_id,v_quote.id),updated_at=now()
  where organisation_id=p_organisation_id and lead_id=v_quote.lead_id and document_type='scope-of-work'
    and status::text in ('approved','issued','published') and is_current_revision=true;
  v_stw_ref:=public.op_next_reference(p_organisation_id,'document',null);
  insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
  select p_organisation_id,v_project.id,v_quote.id,p_user_id,'statement-of-work',v_stw_ref,'Statement of Work','draft',1
  where not exists(select 1 from public.documents where organisation_id=p_organisation_id and project_id=v_project.id and document_type='statement-of-work' and status::text<>'superseded');

  perform public.op_record_activity(p_organisation_id,p_user_id,'project',v_project.id,'project_created_from_governed_client_acceptance',jsonb_build_object(
    'quoteId',p_quote_id,'acceptanceBasis',p_acceptance_basis,'evidenceReference',trim(p_evidence_reference),
    'startPaymentPercent',v_quote.start_payment_percent,'startPaymentRequired',v_required,'paymentTermsDays',v_quote.payment_terms_days,
    'canonicalLifecycle',true
  ));
  return v_project;
end;
$function$;

-- Accepted commercial terms are evidence, not a Project-stage operator control.
-- They may not be converted into PO/credit/manual/none bypasses after acceptance.
create or replace function public.op_guard_accepted_commercial_terms()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_project public.projects;
  v_quote public.quotes;
  v_expected numeric(14,2);
begin
  select * into v_project from public.projects where id=new.project_id and organisation_id=new.organisation_id;
  if not found then raise exception 'OS_INTEGRITY: Project not found for commercial terms.'; end if;
  if new.quote_id is distinct from v_project.quote_id then raise exception 'OS_INTEGRITY: Project commercial terms must come from the accepted Client Quote.'; end if;
  select * into v_quote from public.quotes where id=v_project.quote_id and organisation_id=new.organisation_id;
  if not found then raise exception 'OS_INTEGRITY: Accepted Client Quote not found.'; end if;
  if new.authorisation_basis<>'deposit' then raise exception 'OS_INTEGRITY: Cleared client payment is the only normal start authorisation for positive-value work.'; end if;
  if coalesce(v_quote.total,0)>0 then
    if coalesce(new.deposit_percent,0)<=0 then raise exception 'OS_INTEGRITY: Positive-value work requires an accepted start-payment percentage.'; end if;
    v_expected:=round(v_quote.total*new.deposit_percent/100.0,2);
    if abs(coalesce(new.deposit_required_amount,0)-v_expected)>0.01 then raise exception 'OS_INTEGRITY: Start-payment amount must derive from the accepted Quote.'; end if;
  end if;
  if tg_op='UPDATE' and (
    new.quote_id is distinct from old.quote_id or
    new.authorisation_basis is distinct from old.authorisation_basis or
    new.payment_terms_days is distinct from old.payment_terms_days or
    new.deposit_percent is distinct from old.deposit_percent or
    new.deposit_required_amount is distinct from old.deposit_required_amount or
    new.po_number is distinct from old.po_number or
    new.credit_approved is distinct from old.credit_approved or
    new.override_reason is distinct from old.override_reason or
    new.authorised_by is distinct from old.authorised_by or
    new.authorised_at is distinct from old.authorised_at
  ) then raise exception 'OS_INTEGRITY: Accepted commercial terms are immutable. Revise and re-accept the Client Quote instead.'; end if;
  return new;
end;
$function$;

drop trigger if exists trg_op_guard_accepted_commercial_terms on public.commercial_terms;
create trigger trg_op_guard_accepted_commercial_terms
before insert or update on public.commercial_terms
for each row execute function public.op_guard_accepted_commercial_terms();
