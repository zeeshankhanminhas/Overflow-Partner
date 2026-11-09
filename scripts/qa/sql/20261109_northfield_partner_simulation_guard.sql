-- Isolated Northfield QA database only. This is NOT a production migration.
-- The synthetic method is deliberately distinct from bank_transfer and the
-- QA-SIM reference is never proof that funds moved.
CREATE UNIQUE INDEX IF NOT EXISTS op_qa_one_simulated_transfer_per_payable
ON public.partner_payments(payable_id) WHERE payment_method='qa_simulated_bank_transfer';

CREATE OR REPLACE FUNCTION public.op_qa_guard_synthetic_partner_payable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid:=auth.uid();
BEGIN
 IF TG_OP='DELETE' THEN
  IF coalesce(OLD.invoice_reference,'') LIKE 'QA-SIM-%' THEN
   RAISE EXCEPTION 'Synthetic QA payables cannot be deleted.';
  END IF;
  RETURN OLD;
 END IF;
 IF coalesce(NEW.invoice_reference,'') LIKE 'QA-SIM-%' OR
    (TG_OP='UPDATE' AND coalesce(OLD.invoice_reference,'') LIKE 'QA-SIM-%') THEN
  IF NEW.project_id IS DISTINCT FROM 'b447f586-bf79-4839-be5e-1af607d9ca43'::uuid OR
     NEW.organisation_id IS DISTINCT FROM '717262cb-68da-4e7b-a9fa-238dc6c5d16b'::uuid OR
     NEW.partner_quote_id IS DISTINCT FROM 'e3d90c52-b67a-4c78-8962-7bad0356501c'::uuid OR
     NEW.total IS DISTINCT FROM 1200.00::numeric OR
     NEW.currency IS DISTINCT FROM 'GBP' OR
     NEW.payable_number IS DISTINCT FROM 'QA-PP-NORTHFIELD-WO01' OR
     NEW.invoice_reference IS DISTINCT FROM 'QA-SIM-INVOICE-NORTHFIELD-WO01' OR
     NEW.partner_id IS DISTINCT FROM '4f6bdcc5-1ea0-4dce-aa39-2fbef0cd17fa'::uuid OR
     NEW.subtotal IS DISTINCT FROM 1200.00::numeric OR NEW.vat IS DISTINCT FROM 0::numeric THEN
      RAISE EXCEPTION 'Protected synthetic payable terms cannot be changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id=v_actor
     AND pr.organisation_id=NEW.organisation_id AND pr.is_active=true
     AND pr.role::text IN ('owner','admin')) THEN
     RAISE EXCEPTION 'QA owner must explicitly authorise simulated payable changes.';
  END IF;
 END IF;
 RETURN NEW;
END;$function$


CREATE OR REPLACE FUNCTION public.op_qa_guard_synthetic_partner_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
 p public.partner_payables%ROWTYPE;
 v_actor uuid:=auth.uid();
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN
  IF OLD.payment_method='qa_simulated_bank_transfer' THEN
   RAISE EXCEPTION 'QA synthetic bank records are immutable. Open a new QA replay instead.';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.payment_method='qa_simulated_bank_transfer' THEN
   RAISE EXCEPTION 'Synthetic bank records must originate from the explicit QA settlement flow.';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.project_id='b447f586-bf79-4839-be5e-1af607d9ca43'::uuid AND
    NEW.payment_method='bank_transfer'
 THEN
  RAISE EXCEPTION 'Northfield QA only permits an explicitly labelled synthetic transfer in this test database.';
 END IF;
 IF NEW.payment_method<>'qa_simulated_bank_transfer' THEN
  IF coalesce(NEW.reference,'') LIKE 'QA-SIM-%' THEN
    RAISE EXCEPTION 'QA-SIM references must use the synthetic transfer method.';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.organisation_id<>'717262cb-68da-4e7b-a9fa-238dc6c5d16b'::uuid OR
    NEW.project_id<>'b447f586-bf79-4839-be5e-1af607d9ca43'::uuid OR
    NEW.reference IS DISTINCT FROM 'QA-SIM-NORTHFIELD-WO01' OR
    NEW.status IS DISTINCT FROM 'cleared' OR
    NEW.currency IS DISTINCT FROM 'GBP' OR
    NEW.amount IS DISTINCT FROM 1200.00::numeric OR
    NEW.recorded_by IS DISTINCT FROM v_actor
 THEN
   RAISE EXCEPTION 'Synthetic partner transfer does not match the approved isolated Northfield QA scenario.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id=v_actor
  AND pr.organisation_id=NEW.organisation_id AND pr.is_active=true
  AND pr.role::text IN ('owner','admin')) THEN
  RAISE EXCEPTION 'Only the authenticated QA owner may simulate settlement.';
 END IF;
 SELECT * INTO p FROM public.partner_payables
 WHERE id=NEW.payable_id AND organisation_id=NEW.organisation_id
 AND project_id=NEW.project_id AND status='approved' FOR UPDATE;
 IF NOT FOUND OR p.total IS DISTINCT FROM 1200.00::numeric OR
   p.amount_paid<>0 OR p.invoice_reference NOT LIKE 'QA-SIM-INVOICE-%' OR
   p.partner_quote_id IS DISTINCT FROM 'e3d90c52-b67a-4c78-8962-7bad0356501c'::uuid THEN
   RAISE EXCEPTION 'Selected Work Order payable is not independently approved for simulation.';
 END IF;
 RETURN NEW;
END;$function$


DROP TRIGGER IF EXISTS op_qa_guard_synthetic_partner_payment_trigger ON public.partner_payments;
CREATE TRIGGER op_qa_guard_synthetic_partner_payment_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.partner_payments
FOR EACH ROW EXECUTE FUNCTION public.op_qa_guard_synthetic_partner_payment();

DROP TRIGGER IF EXISTS op_qa_guard_synthetic_partner_payable_trigger ON public.partner_payables;
CREATE TRIGGER op_qa_guard_synthetic_partner_payable_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.partner_payables
FOR EACH ROW EXECUTE FUNCTION public.op_qa_guard_synthetic_partner_payable();

REVOKE ALL ON FUNCTION public.op_qa_guard_synthetic_partner_payment() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.op_qa_guard_synthetic_partner_payable() FROM PUBLIC,anon,authenticated;
