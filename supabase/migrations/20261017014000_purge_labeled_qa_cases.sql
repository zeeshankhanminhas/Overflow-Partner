-- One-time, narrowly scoped QA purge. Explicitly refuse a different cohort.
do $$
declare
  qa_leads uuid[];
  qa_projects uuid[];
  qa_quotes uuid[];
  qa_prospects uuid[];
  qa_companies uuid[];
  qa_contacts uuid[];
  qa_intakes uuid[];
begin
  select array_agg(id order by id) into qa_leads from public.leads
  where company_name in ('OP QA TEST — Northfield Engineering','OP QA TEST 02 — Sandbox Engineering Ltd');
  if coalesce(array_length(qa_leads,1),0) <> 2 then
    raise exception 'QA cleanup refused: expected exactly two labelled leads';
  end if;
  select array_agg(id) into qa_projects from public.projects where lead_id=any(qa_leads);
  select array_agg(id) into qa_quotes from public.quotes where lead_id=any(qa_leads);
  select array_agg(id) into qa_prospects from public.prospects where converted_lead_id=any(qa_leads);
  select array_agg(id) into qa_companies from public.companies
    where name in ('OP QA TEST — Northfield Engineering','OP QA TEST 02 — Sandbox Engineering Ltd');
  select array_agg(id) into qa_contacts from public.contacts
    where company_id=any(qa_companies);
  select array_agg(id) into qa_intakes from public.technical_intakes where lead_id=any(qa_leads);
  if coalesce(array_length(qa_projects,1),0)>1 or coalesce(array_length(qa_prospects,1),0)>1 then
    raise exception 'QA cleanup refused: unexpected number of dependent projects/prospects';
  end if;
  delete from public.notification_outbox where entity_id=any(qa_leads) or entity_id=any(qa_projects) or entity_id=any(qa_quotes) or entity_id=any(qa_prospects) or entity_id=any(qa_intakes);
  delete from public.activity_events where entity_id=any(qa_leads) or entity_id=any(qa_projects) or entity_id=any(qa_quotes) or entity_id=any(qa_prospects) or entity_id=any(qa_intakes);
  delete from public.tasks where entity_id=any(qa_leads) or entity_id=any(qa_projects) or entity_id=any(qa_quotes) or entity_id=any(qa_prospects);
  delete from public.workspace_pins where entity_id=any(qa_leads) or entity_id=any(qa_projects) or entity_id=any(qa_quotes);
  delete from public.compliance_register where entity_id=any(qa_leads) or entity_id=any(qa_projects) or entity_id=any(qa_quotes);
  delete from public.risk_register where entity_id=any(qa_leads) or entity_id=any(qa_projects) or entity_id=any(qa_quotes);
  delete from public.quote_acceptance_records where lead_id=any(qa_leads);
  delete from public.quote_issue_records where lead_id=any(qa_leads);
  delete from public.document_issue_records where lead_id=any(qa_leads) or project_id=any(qa_projects);
  delete from public.documents where lead_id=any(qa_leads) or project_id=any(qa_projects) or quote_id=any(qa_quotes);
  delete from public.prospects where id=any(qa_prospects);
  delete from public.projects where id=any(qa_projects);
  delete from public.leads where id=any(qa_leads);
  delete from public.contacts where id=any(qa_contacts)
    and not exists(select 1 from public.prospects p where p.contact_id=contacts.id)
    and not exists(select 1 from public.leads l where l.contact_id=contacts.id);
  delete from public.companies where id=any(qa_companies)
    and not exists(select 1 from public.prospects p where p.company_id=companies.id)
    and not exists(select 1 from public.leads l where l.company_id=companies.id);
end $$;