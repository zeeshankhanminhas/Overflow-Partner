-- Isolated OPOS QA: enforce the approved pre-quotation technical and
-- commercially selected partner lineage before ANY new Project 360 insert.
-- Existing paid QA fixtures remain unchanged; no retroactive approval is made.
-- The client opening deposit, named acceptance, and issued-quote gates remain
-- independent BEFORE INSERT triggers.
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
begin
  select * into v_q from public.quotes
    where id=p_quote_id and organisation_id=p_organisation_id;
  if not found or v_q.status::text not in ('issued','accepted')
     or v_q.issued_at is null then
    return jsonb_build_object('ready',false,'reason','issued_quotation_missing');
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

  select * into v_partner from public.partners
    where id=v_pq.partner_id and organisation_id=p_organisation_id
      and status::text='approved' and nda_signed=true;
  if not found then
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

  return jsonb_build_object('ready',true,'reason','approved_prequotation_lineage');
end;
$$;
revoke all on function public.op_preproject_lineage_readiness(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.op_preproject_lineage_readiness(uuid,uuid)
  to service_role;

create or replace function public.op_guard_project_prequotation_lineage()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_state jsonb;
begin
  v_state:=public.op_preproject_lineage_readiness(
     new.organisation_id,new.quote_id);
  if coalesce((v_state->>'ready')::boolean,false) is not true then
    raise exception 'OS_INTEGRITY: Project 360 is blocked until approved pre-quotation lineage is complete (%)',
      coalesce(v_state->>'reason','unavailable');
  end if;
  return new;
end;
$$;
revoke all on function public.op_guard_project_prequotation_lineage()
  from public,anon,authenticated;
drop trigger if exists trg_a0_op_prequotation_lineage on public.projects;
create trigger trg_a0_op_prequotation_lineage
before insert on public.projects for each row
execute function public.op_guard_project_prequotation_lineage();