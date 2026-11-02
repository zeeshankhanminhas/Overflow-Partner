-- Isolated QA only: align finalizer with explicit Northfield sandbox permission.
-- No live payment, no new client/quote; only exact fictional QA IDs are accepted.
-- Do not apply to production; existing production allowlist remains unchanged.
do $qa$
declare
 v_org constant uuid:='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
 v_quote constant uuid:='c5b894db-ccdd-47e2-a58a-c38005bcaa99';
 v_lead constant uuid:='671883d9-8cf2-4433-9848-65ec37e4e312';
 v_src text;
 v_old text:='and l.organisation_id=v_quote.organisation_id and l.company_name like ''OP QA TEST%''';
 v_new text:='and l.organisation_id=v_quote.organisation_id and (l.company_name like ''OP QA TEST%'' or (l.id='''||v_lead::text||'''::uuid and l.company_name=''QA - Northfield Demonstration Engineering'' and v_quote.id='''||v_quote::text||'''::uuid and v_quote.organisation_id='''||v_org::text||'''::uuid and exists(select 1 from public.op_qa_northfield_replay r where r.quote_id=v_quote.id and r.organisation_id=v_quote.organisation_id and r.expires_at>now()) and exists(select 1 from public.op_qa_northfield_addendum_acceptances a where a.quote_id=v_quote.id and a.organisation_id=v_quote.organisation_id)))';
begin
 -- A disposable local fixture or any production DB without the exact fictional
 -- records must never receive the additional sandbox exception.
 if to_regclass('public.op_qa_northfield_replay') is null then return; end if;
 if not exists(select 1 from public.leads l join public.quotes q on q.lead_id=l.id
   join public.op_qa_northfield_replay r on r.quote_id=q.id
   where l.id=v_lead and l.organisation_id=v_org and q.id=v_quote
     and l.company_name='QA - Northfield Demonstration Engineering'
     and r.scenario='explicit_sandbox_simulation' and r.expires_at>now()) then return; end if;
 select pg_get_functiondef('public.op_finalize_verified_stripe_quote_payment(text)'::regprocedure) into v_src;
 if position(v_old in v_src)=0 then
  raise exception 'Finalizer allowlist differs from reviewed QA contract; no changes applied';
 end if;
 v_src:=replace(v_src,v_old,v_new);
 -- The QA recovery is independently verified against the Stripe test account.
 -- Do not claim the audit event originated from a signed webhook replay.
 v_src:=replace(v_src,'''source'',''signed_stripe_webhook''',
   '''source'',case when v_quote.id='''||v_quote::text||
   '''::uuid then ''stripe_test_api_verified_qa_recovery'' else ''signed_stripe_webhook'' end');
 execute v_src;
end;$qa$;