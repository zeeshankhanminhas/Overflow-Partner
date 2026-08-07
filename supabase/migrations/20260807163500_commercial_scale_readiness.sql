-- Commercial Scale Readiness
-- Adds queue-focused indexes and a server-side paginated Case queue read model.

create index if not exists idx_leads_org_created
  on public.leads (organisation_id, created_at desc);
create index if not exists idx_leads_org_status_created
  on public.leads (organisation_id, status, created_at desc);

create index if not exists idx_technical_intakes_org_lead_created
  on public.technical_intakes (organisation_id, lead_id, created_at desc);
create index if not exists idx_technical_intakes_org_status_created
  on public.technical_intakes (organisation_id, status, created_at desc);

create index if not exists idx_partner_quotes_org_lead_status_created
  on public.partner_quotes (organisation_id, lead_id, status, created_at desc);

create index if not exists idx_commercial_reviews_org_lead_created
  on public.commercial_reviews (organisation_id, lead_id, created_at desc);

create index if not exists idx_quotes_org_lead_created
  on public.quotes (organisation_id, lead_id, created_at desc);
create index if not exists idx_quotes_org_status_created
  on public.quotes (organisation_id, status, created_at desc);

create index if not exists idx_projects_org_lead_created
  on public.projects (organisation_id, lead_id, created_at desc);
create index if not exists idx_projects_org_stage_status_created
  on public.projects (organisation_id, project_stage, status, created_at desc);

create index if not exists idx_documents_org_lead_created
  on public.documents (organisation_id, lead_id, created_at desc);
create index if not exists idx_documents_org_project_created
  on public.documents (organisation_id, project_id, created_at desc);
create index if not exists idx_documents_org_status_created
  on public.documents (organisation_id, status, created_at desc);

create index if not exists idx_notification_outbox_org_status_schedule
  on public.notification_outbox (organisation_id, status, scheduled_for, created_at);
create index if not exists idx_notification_outbox_org_entity_created
  on public.notification_outbox (organisation_id, entity_type, entity_id, created_at desc);

create or replace function public.op_case_queue(
  p_organisation_id uuid,
  p_view text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  company_name text,
  contact_name text,
  lead_status text,
  workflow_stage text,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with classified as (
    select
      l.id,
      l.title,
      l.company_name,
      l.contact_name,
      l.status::text as lead_status,
      l.created_at,
      case
        when exists (
          select 1 from public.projects p
          where p.organisation_id = l.organisation_id and p.lead_id = l.id
        ) then 'project'
        when exists (
          select 1 from public.quotes q
          where q.organisation_id = l.organisation_id and q.lead_id = l.id
        ) then 'client_quote'
        when exists (
          select 1 from public.commercial_reviews cr
          where cr.organisation_id = l.organisation_id and cr.lead_id = l.id
        ) then 'commercial_review'
        when exists (
          select 1 from public.partner_quotes pq
          where pq.organisation_id = l.organisation_id
            and pq.lead_id = l.id
            and pq.status::text in ('selected','received')
        ) then 'partner_pricing'
        when exists (
          select 1 from public.technical_intakes ti
          where ti.organisation_id = l.organisation_id and ti.lead_id = l.id
        ) then 'technical_intake'
        else 'lead'
      end as workflow_stage,
      exists (
        select 1 from public.technical_intakes ti
        where ti.organisation_id = l.organisation_id
          and ti.lead_id = l.id
          and ti.status::text = 'approved'
      ) as intake_approved
    from public.leads l
    where l.organisation_id = p_organisation_id
  ), filtered as (
    select * from classified c
    where
      p_view = 'all'
      or (p_view = 'assessment' and c.workflow_stage in ('lead','technical_intake'))
      or (p_view = 'partner-review' and c.workflow_stage = 'technical_intake' and c.intake_approved)
      or (p_view = 'partner-pricing' and c.workflow_stage = 'partner_pricing')
      or (p_view = 'commercial-review' and c.workflow_stage = 'commercial_review')
      or (p_view = 'client-quotes' and c.workflow_stage = 'client_quote')
  )
  select
    f.id,
    f.title,
    f.company_name,
    f.contact_name,
    f.lead_status,
    f.workflow_stage,
    f.created_at,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;
