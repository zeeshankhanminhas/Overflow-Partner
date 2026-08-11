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

-- Service-role-only atomic delivery transaction. The external Partner API is the
-- caller. The declaration, current-cycle file attachment, execution state and
-- audit event either commit together or not at all.
create or replace function public.op_record_partner_delivery_submission(
  p_assignment_id uuid,
  p_session_id uuid,
  p_revision text,
  p_delivery_summary text,
  p_deliverables_manifest text,
  p_submitted_by_name text,
  p_submitted_by_role text
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  a public.project_execution_assignments;
  p public.projects;
  s public.partner_execution_sessions;
  d public.partner_delivery_submissions;
  v_file_count integer;
  v_declaration text:='We confirm that the listed engineering outputs and attached files are submitted against the controlled project scope for Overflow Partner review. This submission does not constitute client issue or acceptance.';
begin
  select * into a from public.project_execution_assignments where id=p_assignment_id for update;
  if not found then raise exception 'Execution assignment not found.'; end if;
  if a.execution_state in ('closed','cancelled') then raise exception 'Execution assignment is not active.'; end if;
  select * into s from public.partner_execution_sessions where id=p_session_id and assignment_id=a.id and project_id=a.project_id;
  if not found or s.status in ('revoked','expired') then raise exception 'Partner Execution session is not active.'; end if;
  select * into p from public.projects where id=a.project_id for update;
  if not found then raise exception 'Project not found.'; end if;
  if p.project_stage not in ('in_progress','partner_correction') then raise exception 'Engineering delivery can be submitted only during active execution or correction.'; end if;
  if not exists(select 1 from public.partner_commencement_declarations where assignment_id=a.id) then raise exception 'Partner commencement must be declared before engineering delivery.'; end if;
  if exists(select 1 from public.partner_delivery_submissions where assignment_id=a.id and execution_cycle=a.execution_cycle) then raise exception 'This execution cycle already has a submitted engineering delivery.'; end if;

  select count(*) into v_file_count from public.partner_delivery_submission_files f
  where f.assignment_id=a.id and f.session_id=s.id and f.execution_cycle=a.execution_cycle and f.submission_id is null;
  if v_file_count<1 then raise exception 'Attach at least one engineering output file before submitting this delivery.'; end if;
  if nullif(trim(coalesce(p_delivery_summary,'')),'') is null then raise exception 'Delivery summary is required.'; end if;
  if nullif(trim(coalesce(p_deliverables_manifest,'')),'') is null then raise exception 'Deliverables manifest is required.'; end if;
  if nullif(trim(coalesce(p_submitted_by_name,'')),'') is null then raise exception 'Submitted by name is required.'; end if;

  insert into public.partner_delivery_submissions(
    organisation_id,assignment_id,project_id,partner_id,execution_cycle,revision,delivery_summary,deliverables_manifest,
    declaration_text,submitted_by_name,submitted_by_role
  ) values(
    a.organisation_id,a.id,a.project_id,a.partner_id,a.execution_cycle,nullif(trim(coalesce(p_revision,'')),''),trim(p_delivery_summary),trim(p_deliverables_manifest),
    v_declaration,trim(p_submitted_by_name),nullif(trim(coalesce(p_submitted_by_role,'')),'')
  ) returning * into d;

  update public.partner_delivery_submission_files
  set submission_id=d.id,attached_at=now()
  where assignment_id=a.id and session_id=s.id and execution_cycle=a.execution_cycle and submission_id is null;

  update public.project_execution_assignments set execution_state='delivery_submitted',updated_at=now() where id=a.id;
  insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
  values(a.organisation_id,'project',a.project_id,null,'partner_execution.delivery_submitted',
    jsonb_build_object('submissionId',d.id,'submittedAt',d.submitted_at,'revision',d.revision,'executionCycle',a.execution_cycle,
      'fileCount',v_file_count,'assignmentId',a.id,'partnerId',a.partner_id,'source','execution_partner','partnerReported',true));

  return jsonb_build_object('submissionId',d.id,'submittedAt',d.submitted_at,'executionCycle',a.execution_cycle,'fileCount',v_file_count);
end $$;

revoke all on function public.op_record_partner_delivery_submission(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.op_record_partner_delivery_submission(uuid,uuid,text,text,text,text,text) to service_role;

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
