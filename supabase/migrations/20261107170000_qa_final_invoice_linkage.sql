-- QA ONLY: final invoices are linked to signed contractual evidence and reconciled only by the existing Stripe finalizer.
-- The live database is NOT a target of this migration.
CREATE UNIQUE INDEX IF NOT EXISTS op_qa_one_active_final_invoice_per_project
 ON public.invoices(project_id) WHERE invoice_type='final' AND status<>'cancelled';

CREATE OR REPLACE FUNCTION public.op_qa_issue_final_invoice(p_project_id uuid)
RETURNS public.invoices
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public
AS $fn$
DECLARE
 v_actor uuid := auth.uid();
 v_org uuid;
 v_role text;
 v_project public.projects%ROWTYPE;
 v_quote public.quotes%ROWTYPE;
 v_contract public.quote_release_contracts%ROWTYPE;
 v_existing public.invoices%ROWTYPE;
 v_result public.invoices%ROWTYPE;
 v_balance numeric(18,2);
 v_subtotal numeric(18,2);
 v_vat numeric(18,2);
BEGIN
 SELECT organisation_id,role::text INTO v_org,v_role FROM public.profiles
 WHERE id=v_actor AND is_active=true;
 IF v_actor IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','admin','commercial') THEN
   RAISE EXCEPTION 'An authorised commercial owner or administrator is required.';
 END IF;
 SELECT * INTO v_project FROM public.projects
 WHERE id=p_project_id AND organisation_id=v_org FOR UPDATE;
 IF NOT FOUND OR v_project.project_stage<>'completion' THEN
   RAISE EXCEPTION 'Invoice requires a current, completed engineering project.';
 END IF;
 SELECT * INTO v_quote FROM public.quotes
 WHERE id=v_project.quote_id AND organisation_id=v_org AND status='accepted';
 IF NOT FOUND OR round(v_quote.subtotal+v_quote.vat,2)<>round(v_quote.total,2) THEN
   RAISE EXCEPTION 'The current accepted quotation and tax totals must reconcile.';
 END IF;
 SELECT * INTO v_contract FROM public.quote_release_contracts
 WHERE quote_id=v_quote.id AND organisation_id=v_org AND quote_revision=v_quote.revision
 AND release_basis IN ('deposit','payment');
 IF NOT FOUND THEN RAISE EXCEPTION 'Frozen release terms not found.'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.project_client_reviews r
  WHERE r.project_id=p_project_id AND r.organisation_id=v_org
  AND r.outcome IN ('accepted','accepted_with_comments')
  AND r.recorded_at=(SELECT max(x.recorded_at) FROM public.project_client_reviews x
                     WHERE x.project_id=p_project_id AND x.organisation_id=v_org)
 ) THEN RAISE EXCEPTION 'Current accepted client review is required.'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.quote_payment_confirmations c
  WHERE c.quote_id=v_quote.id AND c.organisation_id=v_org AND c.payment_method='stripe'
  AND c.amount>=v_contract.opening_amount
 ) THEN RAISE EXCEPTION 'Opening settlement evidence is required.'; END IF;
 v_balance:=round(v_quote.total-v_contract.opening_amount,2);
 IF v_balance<=0 OR v_contract.opening_amount<0 OR v_contract.opening_amount>v_quote.total
 THEN RAISE EXCEPTION 'Invalid outstanding contractual balance.'; END IF;
 SELECT * INTO v_existing FROM public.invoices
 WHERE project_id=p_project_id AND organisation_id=v_org AND invoice_type='final'
 AND status<>'cancelled' FOR UPDATE;
 IF FOUND THEN
   IF v_existing.quote_id IS DISTINCT FROM v_quote.id OR v_existing.total<>v_balance
       OR upper(v_existing.currency)<>upper(v_quote.currency) THEN
     RAISE EXCEPTION 'Existing final invoice conflicts with frozen terms.';
   END IF;
   RETURN v_existing;
 END IF;
 v_subtotal:=round(v_quote.subtotal*(v_balance/v_quote.total),2);
 v_vat:=v_balance-v_subtotal;
 INSERT INTO public.invoices(
  organisation_id,project_id,lead_id,quote_id,invoice_number,invoice_type,status,
  description,subtotal,vat_rate,vat,total,amount_paid,currency,
  due_date,issued_at,created_by
 ) VALUES (
  v_org,p_project_id,v_project.lead_id,v_quote.id,
  'OP-FINAL-'||v_project.project_number||'-R'||lpad(v_quote.revision::text,2,'0'),
  'final','issued',
  'Final engineering balance · '||v_quote.quote_number||' · accepted revision '||v_quote.revision,
  v_subtotal,CASE WHEN v_quote.subtotal>0 THEN round(v_quote.vat/v_quote.subtotal*100,2) ELSE 0 END,
  v_vat,v_balance,0,trim(v_quote.currency),current_date+30,now(),v_actor
 ) RETURNING * INTO v_result;
 RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.op_qa_issue_final_invoice(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.op_qa_issue_final_invoice(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.op_qa_guard_final_invoice_settlement()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $fn$
DECLARE v_invoice public.invoices%ROWTYPE;
BEGIN
 SELECT * INTO v_invoice FROM public.invoices
 WHERE project_id=NEW.project_id AND organisation_id=NEW.organisation_id
 AND quote_id=NEW.quote_id AND invoice_type='final' AND status='issued'
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'A matching issued final invoice is required before settlement.'; END IF;
 IF v_invoice.total IS DISTINCT FROM NEW.amount OR v_invoice.amount_paid<>0
 OR upper(v_invoice.currency)<>upper(NEW.currency)
 THEN RAISE EXCEPTION 'Final invoice amount or currency conflicts with verified Stripe settlement.'; END IF;
 RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.op_qa_reconcile_paid_final_invoice()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $fn$
BEGIN
 UPDATE public.invoices SET status='paid',amount_paid=NEW.amount,
   paid_at=NEW.verified_at,external_reference=NEW.stripe_session_id,updated_at=now()
 WHERE project_id=NEW.project_id AND organisation_id=NEW.organisation_id
   AND quote_id=NEW.quote_id AND invoice_type='final' AND status='issued'
   AND total=NEW.amount AND amount_paid=0;
 IF NOT FOUND THEN RAISE EXCEPTION 'Verified final payment could not reconcile the issued invoice.'; END IF;
 RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS op_qa_final_invoice_settlement_guard ON public.op_project_final_settlements;
CREATE TRIGGER op_qa_final_invoice_settlement_guard BEFORE INSERT
ON public.op_project_final_settlements FOR EACH ROW
EXECUTE FUNCTION public.op_qa_guard_final_invoice_settlement();
DROP TRIGGER IF EXISTS op_qa_final_invoice_paid ON public.op_project_final_settlements;
CREATE TRIGGER op_qa_final_invoice_paid AFTER INSERT
ON public.op_project_final_settlements FOR EACH ROW
EXECUTE FUNCTION public.op_qa_reconcile_paid_final_invoice();

-- The trigger functions are not public API endpoints.
REVOKE ALL ON FUNCTION public.op_qa_guard_final_invoice_settlement() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.op_qa_reconcile_paid_final_invoice() FROM PUBLIC,anon,authenticated;
