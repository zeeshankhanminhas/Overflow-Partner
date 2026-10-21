-- Staged QA-only: exactly one included consolidated client correction per project.
-- Client change requests stay separate from partner technical defects.
create table if not exists public.op_client_correction_entitlements (
  project_id uuid primary key references public.projects(id) on delete restrict,
  organisation_id uuid not null references public.organisations(id),
  used_by uuid not null references auth.users(id),
  used_at timestamptz not null default now(),
  evidence_reference text not null,
  execution_cycle integer,
  created_at timestamptz not null default now()
);
alter table public.op_client_correction_entitlements enable row level security;
revoke all on public.op_client_correction_entitlements from public,anon,authenticated;
grant select on public.op_client_correction_entitlements to service_role;

-- A second identical active variation is never treated as a second free correction.
create unique index if not exists ux_op_active_variation_per_description
on public.project_change_requests(organisation_id,project_id,md5(lower(btrim(description))),reason)
where status in ('proposed','under_review','approved');

create or replace function public.op_record_classified_client_review(
  p_organisation_id uuid,p_user_id uuid,p_project_id uuid,p_outcome text,
  p_evidence_basis text,p_evidence_reference text,p_comments text,
  p_feedback_category text default 'in_scope_correction',
  p_partner_defect boolean default false
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_result jsonb;
  v_cycle integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Authenticated operator identity is required for client feedback classification.';
  end if;
  perform public.op_assert_workspace_role(p_organisation_id,p_user_id,
    array['owner','admin','operator','engineering']);
  if p_outcome in ('changes_requested','rejected') then
    if p_feedback_category<>'in_scope_correction' then
      raise exception 'Revision and out-of-scope changes must use the separately priced change request workflow.';
    end if;
    if nullif(trim(coalesce(p_comments,'')),'') is null then
      raise exception 'Provide the complete consolidated list of corrections with document/revision references.';
    end if;
    if not p_partner_defect then
      -- Unique project PK is an atomic entitlement constraint. Concurrent requests
      -- cannot allocate an additional included correction round.
      insert into public.op_client_correction_entitlements(
        project_id,organisation_id,used_by,evidence_reference
      ) values (p_project_id,p_organisation_id,p_user_id,p_evidence_reference);
    end if;
  end if;

  -- Existing governed RPC locks the project, writes outcome and moves partner
  -- correction stage in one transaction. If it fails, the entitlement insert
  -- above is rolled back as well, never half-recording a used round.
  v_result:=public.op_record_client_review_outcome_core(
    p_organisation_id,p_user_id,p_project_id,p_outcome,p_evidence_basis,
    p_evidence_reference,p_comments
  );
  if p_outcome in ('changes_requested','rejected') then
    v_cycle:=coalesce((v_result->'review'->>'execution_cycle')::integer,1);
    perform public.op_record_activity(
      p_organisation_id,p_user_id,'project',p_project_id,
      case when p_partner_defect then 'client.partner_defect_rework' else 'client.included_correction_round' end,
      jsonb_build_object('feedbackCategory',p_feedback_category,
        'executionCycle',v_cycle,'evidenceReference',p_evidence_reference,
        'partnerDefect',p_partner_defect,'reviewId',v_result->'review'->>'id')
    );
  end if;
  return v_result;
end;
$$;
revoke all on function public.op_record_classified_client_review(uuid,uuid,uuid,text,text,text,text,text,boolean)
from public,anon,service_role;
grant execute on function public.op_record_classified_client_review(uuid,uuid,uuid,text,text,text,text,text,boolean)
to authenticated;
