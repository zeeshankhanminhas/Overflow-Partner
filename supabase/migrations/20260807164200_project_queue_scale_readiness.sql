create or replace function public.op_project_queue(
  p_organisation_id uuid,
  p_view text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  project_number text,
  title text,
  project_status text,
  project_stage text,
  start_date date,
  due_date date,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      p.id,
      p.project_number,
      p.title,
      p.status::text as project_status,
      coalesce(nullif(p.project_stage::text, ''), 'mobilisation') as project_stage,
      p.start_date,
      p.due_date,
      p.created_at
    from public.projects p
    where p.organisation_id = p_organisation_id
      and (
        p_view = 'all'
        or (
          p_view = 'delivery'
          and coalesce(nullif(p.project_stage::text, ''), 'mobilisation') not in ('completion','closed')
          and p.status::text not in ('completed','closed','cancelled')
        )
        or (
          p_view = 'closeout'
          and (
            coalesce(nullif(p.project_stage::text, ''), 'mobilisation') = 'completion'
            or p.status::text = 'completed'
          )
        )
        or (
          p_view = 'closed'
          and (
            coalesce(nullif(p.project_stage::text, ''), 'mobilisation') = 'closed'
            or p.status::text = 'closed'
          )
        )
      )
  )
  select
    f.id,
    f.project_number,
    f.title,
    f.project_status,
    f.project_stage,
    f.start_date,
    f.due_date,
    f.created_at,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;
