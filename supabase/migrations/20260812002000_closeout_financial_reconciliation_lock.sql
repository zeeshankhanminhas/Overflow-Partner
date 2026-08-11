begin;

-- Final closeout reconciliation layer. A Project cannot appear financially
-- complete merely because finance tables are empty or under-recorded.
alter function public.op_project_stage_readiness(uuid) rename to op_project_stage_readiness_evidence_core;

create or replace function public.op_project_stage_readiness(p_project_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  v_base jsonb;
  v_stage text;
  v_reasons jsonb;
  v_project public.projects;
  v_quote_total numeric:=0;
  v_invoiced_total numeric:=0;
  v_invoice_issued boolean:=false;
  v_partner_cost numeric:=0;
  v_partner_payable_total numeric:=0;
  v_partner_payable_evidence boolean:=false;
begin
  v_base:=public.op_project_stage_readiness_evidence_core(p_project_id);
  v_stage:=coalesce(v_base->>'stage','');
  v_reasons:=coalesce(v_base->'reasons','[]'::jsonb);

  if v_stage='completion' then
    select * into v_project from public.projects where id=p_project_id;
    if found then
      select coalesce(q.total,0) into v_quote_total
      from public.quotes q where q.id=v_project.quote_id;

      if v_quote_total>0 then
        select coalesce(sum(i.total),0) into v_invoiced_total
        from public.invoices i
        where i.organisation_id=v_project.organisation_id
          and i.project_id=v_project.id
          and i.status not in ('cancelled','refunded');

        if v_invoiced_total + 0.01 < v_quote_total then
          v_reasons:=v_reasons||jsonb_build_array(
            'Client billing must cover the accepted Quote before closeout.'
          );
        end if;

        select exists(
          select 1 from public.documents d
          where d.organisation_id=v_project.organisation_id
            and d.project_id=v_project.id
            and d.document_type='invoice'
            and d.status::text in ('issued','published')
            and d.is_current_revision=true
        ) into v_invoice_issued;

        if not v_invoice_issued then
          v_reasons:=v_reasons||jsonb_build_array(
            'Issued controlled Invoice evidence is required before closeout.'
          );
        end if;
      end if;

      select coalesce(pq.price,0) into v_partner_cost
      from public.quotes q
      join public.commercial_reviews cr on cr.id=q.commercial_review_id
      join public.partner_quotes pq on pq.id=cr.partner_quote_id
      where q.id=v_project.quote_id;

      if v_partner_cost>0 then
        select coalesce(sum(pp.total),0),coalesce(bool_or(coalesce(pp.evidence_confirmed,false)),false)
        into v_partner_payable_total,v_partner_payable_evidence
        from public.partner_payables pp
        join public.quotes q on q.id=v_project.quote_id
        join public.commercial_reviews cr on cr.id=q.commercial_review_id
        where pp.organisation_id=v_project.organisation_id
          and pp.project_id=v_project.id
          and pp.partner_quote_id=cr.partner_quote_id
          and pp.status not in ('cancelled','disputed');

        if v_partner_payable_total + 0.01 < v_partner_cost then
          v_reasons:=v_reasons||jsonb_build_array(
            'Recorded Execution Partner liability must cover the accepted Partner cost before closeout.'
          );
        end if;

        if not v_partner_payable_evidence then
          v_reasons:=v_reasons||jsonb_build_array(
            'Execution Partner payable evidence must be confirmed before closeout.'
          );
        end if;
      end if;
    end if;
  end if;

  return v_base || jsonb_build_object(
    'reasons',v_reasons,
    'ready',jsonb_array_length(v_reasons)=0,
    'acceptedQuoteTotal',v_quote_total,
    'clientInvoicedTotal',v_invoiced_total,
    'issuedInvoiceEvidence',v_invoice_issued,
    'acceptedPartnerCost',v_partner_cost,
    'partnerPayableRecordedTotal',v_partner_payable_total,
    'partnerPayableEvidenceConfirmed',v_partner_payable_evidence
  );
end $$;

commit;
