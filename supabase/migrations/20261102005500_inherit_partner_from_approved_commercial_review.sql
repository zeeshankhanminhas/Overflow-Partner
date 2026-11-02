-- The approved commercial review already freezes the chosen partner.
-- The quote-approval RPC does not mutate the partner quote's status to 'selected'.
-- Receiving a partner price and approving the named commercial position is
-- authoritative; asking for an extra "select again" action is wrong.
create or replace function public.op_guard_project_execution_assignment()
returns trigger language plpgsql set search_path=public as $$
declare
 v_selected uuid;
 v_partner public.partners%rowtype;
 v_scope public.documents%rowtype;
 v_finance jsonb;
begin
 select pq.partner_id into v_selected from public.projects pr
 join public.quotes q on q.id=pr.quote_id and q.organisation_id=pr.organisation_id
 join public.commercial_reviews cr on cr.id=q.commercial_review_id
 join public.partner_quotes pq on pq.id=cr.partner_quote_id
 where pr.id=new.project_id and pr.organisation_id=new.organisation_id
  and cr.organisation_id=new.organisation_id and cr.status::text='approved'
  and cr.approved_at is not null and pq.status::text in ('received','selected')
  and pq.organisation_id=new.organisation_id and pq.lead_id=q.lead_id;
 if v_selected is null then raise exception 'OS_INTEGRITY: No already approved commercial Execution Partner selection exists.'; end if;
 if v_selected is distinct from new.partner_id then raise exception 'Execution Partner must match the one approved before client quotation.'; end if;
 select * into v_partner from public.partners where id=new.partner_id and organisation_id=new.organisation_id;
 if not found or v_partner.status::text<>'approved' or not v_partner.nda_signed then
  raise exception 'Previously selected Execution Partner must remain approved and NDA-ready.';
 end if;
 if new.scope_document_id is null then raise exception 'Approved technical execution scope is required for Work Order issue.'; end if;
 select * into v_scope from public.documents
  where id=new.scope_document_id and organisation_id=new.organisation_id
   and project_id=new.project_id and is_current_revision
   and document_type in ('scope-of-work','statement-of-work')
   and status::text in ('approved','issued','published');
 if not found then raise exception 'Work Order must use the current approved scope inherited from the client quotation.'; end if;
 v_finance:=public.op_project_financial_gate(new.project_id);
 if coalesce((v_finance->>'authorised')::boolean,false)=false or
    v_finance->>'basis'<>'deposit' or
    coalesce((v_finance->>'required')::numeric,0)<=0 or
    coalesce((v_finance->>'received')::numeric,0)<(v_finance->>'required')::numeric then
   raise exception 'No Execution Partner assignment before a verified opening deposit.';
 end if;
 return new;
end;$$;

create or replace function public.op_guard_partner_work_order_issue()
returns trigger language plpgsql set search_path=public as $$
declare
 v_assignment public.project_execution_assignments%rowtype;
 v_quote public.quotes%rowtype;
 v_partner_quote public.partner_quotes%rowtype;
 v_project public.projects%rowtype;
 v_scope public.documents%rowtype;
 v_finance jsonb;
begin
 select * into v_assignment from public.project_execution_assignments where id=new.assignment_id;
 select * into v_project from public.projects where id=new.project_id;
 if v_assignment.id is null or v_project.id is null or
    v_assignment.project_id<>new.project_id or
    v_assignment.organisation_id<>new.organisation_id or
    v_assignment.partner_id<>new.partner_id or
    v_assignment.scope_document_id<>new.scope_document_id or
    v_project.organisation_id<>new.organisation_id or
    v_project.project_stage not in ('mobilisation','ready_for_execution') then
   raise exception 'Work Order must be attached to the controlled financially released assignment.';
 end if;
 select * into v_scope from public.documents where id=new.scope_document_id
   and organisation_id=new.organisation_id and project_id=new.project_id
   and document_type in ('scope-of-work','statement-of-work')
   and status::text in ('approved','issued','published') and is_current_revision;
 if v_scope.id is null or new.scope_reference<>v_scope.reference or
    new.scope_revision_code is distinct from v_scope.revision_code then
   raise exception 'Work Order scope must match the current approved technical scope.';
 end if;
 select * into v_quote from public.quotes where id=v_project.quote_id and organisation_id=new.organisation_id;
 select pq.* into v_partner_quote from public.commercial_reviews cr
  join public.partner_quotes pq on pq.id=cr.partner_quote_id
  where cr.id=v_quote.commercial_review_id and cr.organisation_id=new.organisation_id
   and cr.status::text='approved' and cr.approved_at is not null
   and pq.status::text in ('received','selected') and pq.lead_id=v_quote.lead_id
   and pq.organisation_id=new.organisation_id;
 if v_partner_quote.id is null or v_partner_quote.id<>new.partner_quote_id
  or v_partner_quote.partner_id<>new.partner_id
  or v_partner_quote.price<>new.partner_price
  or upper(trim(v_partner_quote.currency::text))<>upper(trim(new.currency))
  or new.reference<>v_project.project_number||'/WO-01' then
   raise exception 'Work Order pricing, currency, partner and reference must inherit the approved commercial position.';
 end if;
 v_finance:=public.op_project_financial_gate(v_project.id);
 if coalesce((v_finance->>'authorised')::boolean,false)=false or v_finance->>'basis'<>'deposit'
  or coalesce((v_finance->>'required')::numeric,0)<=0
  or coalesce((v_finance->>'received')::numeric,0)<(v_finance->>'required')::numeric then
   raise exception 'Verified paid opening deposit is required before issuing the Work Order.';
 end if;
 if new.no_partner_advance is distinct from true then raise exception 'Partner advance is prohibited.'; end if;
 return new;
end;$$;
