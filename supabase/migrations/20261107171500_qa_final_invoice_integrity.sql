-- QA-only financial integrity: an issued final invoice is immutable and can become paid
-- only when the signed Stripe webhook has inserted independently verified settlement evidence.
CREATE OR REPLACE FUNCTION public.op_qa_guard_final_invoice_settlement()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$
DECLARE v_invoice public.invoices%ROWTYPE;
BEGIN
 SELECT * INTO v_invoice FROM public.invoices
 WHERE project_id=NEW.project_id AND organisation_id=NEW.organisation_id
 AND quote_id=NEW.quote_id AND invoice_type='final' AND status='issued' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'A matching issued final invoice is required before settlement.'; END IF;
 IF v_invoice.total IS DISTINCT FROM NEW.amount OR v_invoice.amount_paid<>0 OR
    upper(v_invoice.currency)<>upper(NEW.currency)
 THEN RAISE EXCEPTION 'Final invoice amount or currency conflicts with verified Stripe settlement.'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.quote_stripe_payment_events e
  WHERE e.stripe_session_id=NEW.stripe_session_id
    AND e.stripe_event_id=NEW.stripe_event_id
    AND e.quote_id=NEW.quote_id
    AND e.organisation_id=NEW.organisation_id
    AND e.quote_revision=NEW.quote_revision
    AND e.amount_total=round(NEW.amount*100)::bigint
    AND upper(e.currency)=upper(NEW.currency)
    AND e.stripe_payment_status='paid'
    AND e.livemode=false
 ) THEN RAISE EXCEPTION 'Signed sandbox Stripe payment evidence must match final invoice settlement.'; END IF;
 RETURN NEW;
END;$fn$;

CREATE OR REPLACE FUNCTION public.op_qa_protect_final_invoice()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$
BEGIN
 IF OLD.invoice_type='final' THEN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id OR
     NEW.organisation_id IS DISTINCT FROM OLD.organisation_id OR
     NEW.quote_id IS DISTINCT FROM OLD.quote_id OR
     NEW.invoice_type IS DISTINCT FROM OLD.invoice_type OR
     NEW.invoice_number IS DISTINCT FROM OLD.invoice_number OR
     NEW.total IS DISTINCT FROM OLD.total OR
     NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
     NEW.vat IS DISTINCT FROM OLD.vat OR
     upper(NEW.currency) IS DISTINCT FROM upper(OLD.currency)
  THEN RAISE EXCEPTION 'Issued final invoice terms are frozen.'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid THEN
   IF OLD.status<>'issued' OR NEW.status<>'paid' OR NEW.amount_paid IS DISTINCT FROM NEW.total OR
      NOT EXISTS(SELECT 1 FROM public.op_project_final_settlements s
       WHERE s.project_id=NEW.project_id AND s.organisation_id=NEW.organisation_id
         AND s.quote_id=NEW.quote_id AND s.amount=NEW.total
         AND s.stripe_session_id=NEW.external_reference)
   THEN RAISE EXCEPTION 'Final invoice may be settled only by verified Stripe reconciliation.'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END;$fn$;

DROP TRIGGER IF EXISTS op_qa_protect_final_invoice_updates ON public.invoices;
CREATE TRIGGER op_qa_protect_final_invoice_updates BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.op_qa_protect_final_invoice();
REVOKE ALL ON FUNCTION public.op_qa_protect_final_invoice() FROM PUBLIC,anon,authenticated;