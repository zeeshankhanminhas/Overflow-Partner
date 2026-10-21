-- Handoff of frozen quote commercial authority into Project 360.
create or replace function public.op_inherit_quote_release_to_project()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_contract public.quote_release_contracts%rowtype;
        v_po public.quote_release_confirmations%rowtype;
        v_total numeric;
begin
  select * into v_contract from public.quote_release_contracts
    where quote_id=new.quote_id and organisation_id=new.organisation_id
      and quote_revision=(select revision from public.quotes where id=new.quote_id);

  if not found then raise exception 'Project commercial authority must be inherited from quote release.'; end if;
  select total into v_total from public.quotes where id=new.quote_id;
  if v_contract.release_basis='purchase_order' then
    select * into v_po from public.quote_release_confirmations
    where quote_id=new.quote_id and organisation_id=new.organisation_id and release_basis='purchase_order';
    if not found then raise exception 'Purchase-order release evidence is missing.'; end if;
  end if;
  insert into public.commercial_terms (
    organisation_id,project_id,quote_id,authorisation_basis,
    deposit_percent,deposit_required_amount,po_number,credit_approved,
    override_reason,authorised_by,authorised_at,created_by
  ) values (
    new.organisation_id,new.id,new.quote_id,
    case v_contract.release_basis
      when 'payment' then 'deposit'
      when 'deposit' then 'deposit'
      when 'purchase_order' then 'po'
      when 'credit' then 'credit'
      else 'none' end,
    case when v_contract.release_basis in ('payment','deposit')
      then round((v_contract.opening_amount/nullif(v_total,0))*100,2) else 0 end,
    case when v_contract.release_basis in ('payment','deposit')
      then v_contract.opening_amount else 0 end,
    case when v_contract.release_basis='purchase_order' then v_po.evidence_reference else null end,
    false,
    case when v_contract.release_basis='no_advance_payment'
      then 'No opening advance due under the authorised Client Quote revision'
      else null end,
    v_contract.approved_by,now(),new.created_by
  ) on conflict (organisation_id,project_id) do nothing;
  return new;
end;$$;
drop trigger if exists op_inherit_quote_release_after_project_creation on public.projects;
create trigger op_inherit_quote_release_after_project_creation
after insert on public.projects for each row
execute function public.op_inherit_quote_release_to_project();

-- Existing finance readiness remains authoritative but recognises approved opening
-- funds originally reconciled at quote level before the project was created.
CREATE OR REPLACE FUNCTION public.op_project_financial_gate(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_terms public.commercial_terms%rowtype;
  v_received numeric(14,2) := 0;
  v_authorised boolean := false;
  v_reason text := '';
begin
  select * into v_terms from public.commercial_terms where project_id = p_project_id limit 1;
  if not found then
    return jsonb_build_object('authorised',false,'reason','Commercial terms have not been configured.','basis',null,'required',0,'received',0);
  end if;

  select coalesce(sum(p.amount),0) into v_received
  from public.payments p
  where p.project_id = p_project_id and p.status = 'cleared';
  -- Quote opening payments are verified before the project exists and initially
  -- live in quote_payment_confirmations, not invoice-specific project payments.
  -- GREATEST prevents counting the same cleared deposit in both ledgers twice.
  select greatest(v_received,coalesce(sum(qpc.amount),0)) into v_received
  from public.quote_payment_confirmations qpc
  join public.projects pr on pr.quote_id=qpc.quote_id
  where pr.id=p_project_id and pr.organisation_id=qpc.organisation_id;

  case v_terms.authorisation_basis
    when 'deposit' then
      v_authorised := v_received >= v_terms.deposit_required_amount;
      v_reason := case when v_authorised then 'Required mobilisation deposit has been received.' else 'Mobilisation deposit is outstanding.' end;
    when 'po' then
      v_authorised := coalesce(length(trim(v_terms.po_number)),0) > 0;
      v_reason := case when v_authorised then 'Customer purchase order is recorded.' else 'Customer purchase order is required.' end;
    when 'credit' then
      v_authorised := v_terms.credit_approved;
      v_reason := case when v_authorised then 'Approved credit terms authorise mobilisation.' else 'Credit approval is required.' end;
    when 'manual' then
      v_authorised := v_terms.authorised_at is not null and coalesce(length(trim(v_terms.override_reason)),0) > 0;
      v_reason := case when v_authorised then 'Manual financial authorisation recorded.' else 'Manual authorisation requires an approver and reason.' end;
    when 'none' then
      v_authorised := v_terms.authorised_at is not null;
      v_reason := case when v_authorised then 'No pre-mobilisation payment condition applies.' else 'Commercial terms require explicit authorisation.' end;
  end case;

  return jsonb_build_object(
    'authorised',v_authorised,
    'reason',v_reason,
    'basis',v_terms.authorisation_basis,
    'required',v_terms.deposit_required_amount,
    'received',v_received,
    'paymentTermsDays',v_terms.payment_terms_days,
    'poNumber',v_terms.po_number
  );
end;
$function$;
