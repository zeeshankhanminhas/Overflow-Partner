begin;

-- OS integrity correction:
-- once a commercial quote is issued/accepted, a draft controlled client-quote
-- shell for the same quote or Case can no longer be operational truth.

-- Canonicalise legacy alias first.
update public.documents
set document_type = 'client-quote',
    updated_at = now()
where document_type = 'client_quote';

-- Retire drafts directly linked to an already-issued/accepted quote.
update public.documents d
set status = 'superseded',
    updated_at = now()
from public.quotes q
where d.organisation_id = q.organisation_id
  and d.quote_id = q.id
  and d.document_type = 'client-quote'
  and d.status::text = 'draft'
  and q.status::text in ('issued','accepted');

-- Retire legacy draft shells which were created without quote_id but belong
-- to a Case that already owns an issued/accepted client quote.
update public.documents d
set status = 'superseded',
    updated_at = now()
where d.document_type = 'client-quote'
  and d.status::text = 'draft'
  and d.lead_id is not null
  and exists (
    select 1
    from public.quotes q
    where q.organisation_id = d.organisation_id
      and q.lead_id = d.lead_id
      and q.status::text in ('issued','accepted')
  );

commit;
