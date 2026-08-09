begin;

-- A controlled quotation cannot remain an active Draft once the commercial
-- quote it belongs to has already been issued/accepted. Such rows are legacy
-- mutation shells and must be historical only.
update public.documents d
set status = 'superseded',
    updated_at = now()
from public.quotes q
where d.quote_id = q.id
  and d.organisation_id = q.organisation_id
  and d.document_type in ('client-quote','client_quote')
  and d.status::text = 'draft'
  and q.status::text in ('issued','accepted','declined','expired','superseded')
  and exists (
    select 1
    from public.documents stronger
    where stronger.organisation_id = d.organisation_id
      and stronger.id <> d.id
      and stronger.document_type in ('client-quote','client_quote')
      and (
        (d.quote_id is not null and stronger.quote_id = d.quote_id)
        or (d.quote_id is null and stronger.lead_id = d.lead_id)
      )
      and stronger.status::text in ('signed','approved','issued','published')
  );

-- Canonicalise any remaining legacy alias for routing/resolver consistency.
update public.documents
set document_type = 'client-quote',
    updated_at = now()
where document_type = 'client_quote';

commit;
