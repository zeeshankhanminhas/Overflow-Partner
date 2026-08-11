begin;

-- A Partner Delivery Submission is a controlled execution-cycle event. One
-- submission belongs to one cycle; a correction request creates the next cycle.
create unique index if not exists ux_partner_delivery_submission_cycle
  on public.partner_delivery_submissions(assignment_id,execution_cycle);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'partner-delivery','partner-delivery',false,26214400,
  array[
    'application/pdf','image/png','image/jpeg','application/zip','application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/dxf','application/octet-stream','text/plain','text/csv'
  ]::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.partner_delivery_submission_files(
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  assignment_id uuid not null references public.project_execution_assignments(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete restrict,
  session_id uuid not null references public.partner_execution_sessions(id) on delete restrict,
  submission_id uuid references public.partner_delivery_submissions(id) on delete cascade,
  execution_cycle integer not null check(execution_cycle>0),
  storage_bucket text not null default 'partner-delivery',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check(size_bytes>0 and size_bytes<=26214400),
  uploaded_at timestamptz not null default now(),
  attached_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists partner_delivery_submission_files_assignment_cycle_idx
  on public.partner_delivery_submission_files(assignment_id,execution_cycle,uploaded_at);
create index if not exists partner_delivery_submission_files_submission_idx
  on public.partner_delivery_submission_files(submission_id);

alter table public.partner_delivery_submission_files enable row level security;
drop policy if exists partner_delivery_submission_files_org_access on public.partner_delivery_submission_files;
create policy partner_delivery_submission_files_org_access on public.partner_delivery_submission_files
for all using(
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=partner_delivery_submission_files.organisation_id and p.is_active=true)
) with check(
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=partner_delivery_submission_files.organisation_id and p.is_active=true)
);

create or replace function public.op_guard_partner_delivery_file_identity()
returns trigger language plpgsql set search_path=public as $$
declare
  a public.project_execution_assignments;
  s public.partner_execution_sessions;
begin
  select * into a from public.project_execution_assignments where id=new.assignment_id;
  if not found then raise exception 'Execution assignment not found.'; end if;
  select * into s from public.partner_execution_sessions where id=new.session_id and assignment_id=a.id;
  if not found then raise exception 'Partner Execution session does not belong to this assignment.'; end if;
  if new.organisation_id is distinct from a.organisation_id or new.project_id is distinct from a.project_id or new.partner_id is distinct from a.partner_id then
    raise exception 'Partner delivery file does not match the execution assignment.';
  end if;
  if new.execution_cycle is distinct from a.execution_cycle then raise exception 'Partner delivery file must belong to the current execution cycle.'; end if;
  if new.submission_id is not null and not exists(
    select 1 from public.partner_delivery_submissions d
    where d.id=new.submission_id and d.assignment_id=a.id and d.execution_cycle=a.execution_cycle
  ) then raise exception 'Partner delivery file does not match the current delivery submission.'; end if;
  return new;
end $$;

drop trigger if exists trg_op_guard_partner_delivery_file_identity on public.partner_delivery_submission_files;
create trigger trg_op_guard_partner_delivery_file_identity
before insert or update of assignment_id,session_id,submission_id,execution_cycle,organisation_id,project_id,partner_id
on public.partner_delivery_submission_files
for each row execute function public.op_guard_partner_delivery_file_identity();

-- Keep the public readiness function as the single Project gate. The previous
-- canonical implementation becomes its core and this wrapper adds the physical
-- delivery-file evidence requirement.
alter function public.op_project_stage_readiness(uuid) rename to op_project_stage_readiness_core;

create or replace function public.op_project_stage_readiness(p_project_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  v_core jsonb;
  v_stage text;
  v_mode text;
  v_assignment_id uuid;
  v_cycle integer;
  v_submission_id uuid;
  v_file_count integer:=0;
  v_reasons jsonb;
begin
  v_core:=public.op_project_stage_readiness_core(p_project_id);
  v_stage:=coalesce(v_core->>'stage','');
  v_mode:=coalesce(v_core->>'executionMode','internal');
  v_reasons:=coalesce(v_core->'reasons','[]'::jsonb);

  if v_mode='partner' and v_stage in ('in_progress','internal_review') then
    select a.id,a.execution_cycle into v_assignment_id,v_cycle
    from public.project_execution_assignments a
    where a.project_id=p_project_id and a.execution_state not in ('closed','cancelled')
    order by a.created_at desc limit 1;

    if v_assignment_id is not null then
      select d.id into v_submission_id from public.partner_delivery_submissions d
      where d.assignment_id=v_assignment_id and d.execution_cycle=v_cycle
      order by d.submitted_at desc limit 1;
      if v_submission_id is not null then
        select count(*) into v_file_count from public.partner_delivery_submission_files f
        where f.submission_id=v_submission_id and f.assignment_id=v_assignment_id and f.execution_cycle=v_cycle;
        if v_file_count=0 then
          v_reasons:=v_reasons||jsonb_build_array('Current-cycle Partner delivery must include at least one engineering output file.');
        end if;
      end if;
    end if;
  end if;

  return v_core || jsonb_build_object(
    'reasons',v_reasons,
    'ready',jsonb_array_length(v_reasons)=0,
    'partnerDeliveryFileCount',v_file_count
  );
end $$;

commit;
