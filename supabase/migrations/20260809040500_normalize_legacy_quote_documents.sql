begin;

-- Canonicalise legacy document_type aliases so all resolvers and routes
-- consume one document identity vocabulary.
update public.documents
set document_type = 'client-quote',
    updated_at = now()
where document_type = 'client_quote';

-- If a quote already has governed quotation evidence at a stronger state,
-- stale draft duplicates must not remain operationally active.
with ranked as (
  select
    id,
    organisation_id,
    quote_id,
    lead_id,
    status::text as status_text,
    row_number() over (
      partition by organisation_id, coalesce(quote_id::text, 'lead:' || coalesce(lead_id::text, 'none'))
      order by
        case status::text
          when 'published' then 6
          when 'issued' then 5
          when 'approved' then 4
          when 'signed' then 3
          when 'in_review' then 2
          when 'draft' then 1
          else 0
        end desc,
        updated_at desc nulls last,
        created_at desc
    ) as rn,
    max(case when status::text in ('approved','issued','published') then 1 else 0 end) over (
      partition by organisation_id, coalesce(quote_id::text, 'lead:' || coalesce(lead_id::text, 'none'))
    ) as has_governed
  from public.documents
  where document_type = 'client-quote'
)
update public.documents d
set status = 'superseded',
    updated_at = now()
from ranked r
where d.id = r.id
  and r.has_governed = 1
  and r.rn > 1
  and r.status_text = 'draft';

commit;
