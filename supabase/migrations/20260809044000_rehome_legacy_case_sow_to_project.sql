begin;

-- Repair the legacy ownership mutation created before Project 360 became the
-- sole owner of delivery-stage evidence. A Statement of Work that belongs to
-- an accepted Case must live under the Project, not remain Case-owned.
with candidates as (
  select
    d.id as document_id,
    p.id as project_id,
    p.quote_id as project_quote_id,
    row_number() over (
      partition by d.id
      order by p.created_at desc
    ) as rn,
    count(*) over (partition by d.id) as project_matches
  from public.documents d
  join public.projects p
    on p.organisation_id = d.organisation_id
   and p.lead_id = d.lead_id
  where d.document_type in ('statement-of-work','statement_of_work')
    and d.project_id is null
    and d.lead_id is not null
    and d.status::text <> 'superseded'
    and not exists (
      select 1
      from public.documents existing
      where existing.organisation_id = d.organisation_id
        and existing.project_id = p.id
        and existing.document_type in ('statement-of-work','statement_of_work')
        and existing.status::text <> 'superseded'
    )
)
update public.documents d
set project_id = c.project_id,
    lead_id = null,
    quote_id = coalesce(d.quote_id, c.project_quote_id),
    document_type = 'statement-of-work',
    updated_at = now()
from candidates c
where d.id = c.document_id
  and c.rn = 1
  and c.project_matches = 1;

-- Project-owned controlled documents must not retain simultaneous Case ownership.
update public.documents
set lead_id = null,
    updated_at = now()
where project_id is not null
  and lead_id is not null;

commit;
