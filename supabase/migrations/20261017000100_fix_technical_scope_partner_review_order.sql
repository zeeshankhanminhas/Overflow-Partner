-- Align technical scope approval with the agreed OP lifecycle:
-- Client Requirements -> Technical Scope approval -> Partner Assessment.
-- Preserves membership, populated scope fields and current approved Client Requirements.
create or replace function public.op_approve_technical_intake(
  p_organisation_id uuid, p_user_id uuid, p_intake_id uuid
) returns public.technical_intakes
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_intake public.technical_intakes;
  v_ref text;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  select * into v_intake from public.technical_intakes
  where organisation_id=p_organisation_id and id=p_intake_id for update;
  if not found then raise exception 'Technical intake not found.'; end if;
  if v_intake.status not in ('submitted','under_review','clarification_required','draft') then
    raise exception 'Technical intake is not in an approvable state.';
  end if;
  if nullif(trim(v_intake.description),'') is null then raise exception 'Technical description is required.'; end if;
  if nullif(trim(coalesce(v_intake.deliverables,'')),'') is null then raise exception 'Deliverables are required.'; end if;
  if nullif(trim(coalesce(v_intake.project_type,'')),'') is null then raise exception 'Project type is required.'; end if;
  if not exists(
    select 1 from public.documents d
    where d.organisation_id=p_organisation_id and d.lead_id=v_intake.lead_id
      and d.document_type='client-requirements'
      and d.status::text in ('approved','issued','published') and d.is_current_revision=true
  ) then raise exception 'Approved Client Requirements are required before Technical Scope approval.'; end if;
  -- Do not require an approved Partner Review: partner assessment follows scope approval.
  update public.technical_intakes
  set status='approved',reviewed_by=p_user_id,reviewed_at=now(),updated_at=now()
  where id=p_intake_id returning * into v_intake;
  update public.leads
  set status='qualified',next_action='Approve Partner Technical Assessment evidence',updated_at=now()
  where organisation_id=p_organisation_id and id=v_intake.lead_id;
  if not exists(
    select 1 from public.documents
    where organisation_id=p_organisation_id and lead_id=v_intake.lead_id
      and document_type='partner-technical-assessment-report' and status::text<>'superseded'
  ) then
    v_ref:=public.op_next_reference(p_organisation_id,'document',null);
    insert into public.documents(organisation_id,lead_id,technical_intake_id,created_by,document_type,reference,title,status,version)
    values(p_organisation_id,v_intake.lead_id,v_intake.id,p_user_id,'partner-technical-assessment-report',v_ref,'Partner Technical Assessment Report','draft',1);
  end if;
  perform public.op_record_activity(
    p_organisation_id,p_user_id,'technical_intake',v_intake.id,'technical_intake_approved',
    jsonb_build_object('leadId',v_intake.lead_id,'canonicalLifecycle',true)
  );
  return v_intake;
end;
$function$;
