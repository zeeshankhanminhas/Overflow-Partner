-- Bring existing delivery relationships into the account lifecycle.
with project_counts as (
  select l.company_id,
    count(*) filter (where coalesce(p.project_stage::text, '') = 'closed' or p.status::text in ('completed','closed')) as completed_count,
    count(*) as project_count
  from public.projects p
  join public.leads l on l.id = p.lead_id and l.organisation_id = p.organisation_id
  where l.company_id is not null
  group by l.company_id
)
update public.companies c
set account_status = case when pc.completed_count >= 2 then 'repeat' when pc.project_count >= 1 then 'active' else c.account_status end,
    next_account_review_at = case when pc.completed_count >= 1 and c.next_account_review_at is null then now() else c.next_account_review_at end,
    updated_at = now()
from project_counts pc
where c.id = pc.company_id;
