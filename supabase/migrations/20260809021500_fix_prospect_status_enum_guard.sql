begin;

-- Correct the pre-Case partner-review guard for the existing prospect_status enum.
-- The previous function compared the enum directly with an unsupported literal ('archived'),
-- which caused PostgreSQL to fail before evaluating the actual Prospect status.
create or replace function public.op_create_prospect_partner_review_request(
  p_organisation_id uuid,
  p_user_id uuid,
  p_prospect_id uuid,
  p_intake_session_id uuid,
  p_partner_id uuid,
  p_token_hash text,
  p_response_due_at timestamptz,
  p_expires_at timestamptz,
  p_review_instructions text,
  p_scope_summary text,
  p_show_client_identity boolean default false
) returns public.partner_review_requests
language plpgsql security definer set search_path=public
as $$
declare
  v_prospect public.prospects;
  v_session public.intake_sessions;
  v_partner public.partners;
  v_request public.partner_review_requests;
  v_ref text;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Unauthorised actor';
  end if;

  select * into v_prospect
  from public.prospects
  where id=p_prospect_id and organisation_id=p_organisation_id
  for update;

  if not found then
    raise exception 'Prospect not found';
  end if;

  -- Compare as text and only against terminal values that exist in the current enum.
  if coalesce(v_prospect.status::text,'') in ('converted','not_a_fit') then
    raise exception 'Prospect is no longer active';
  end if;

  select * into v_session
  from public.intake_sessions
  where id=p_intake_session_id
    and organisation_id=p_organisation_id
    and prospect_id=p_prospect_id;

  if not found or v_session.status <> 'submitted' then
    raise exception 'A submitted Step 2 technical intake is required';
  end if;

  select * into v_partner
  from public.partners
  where id=p_partner_id and organisation_id=p_organisation_id;

  if not found or v_partner.status <> 'approved' or not coalesce(v_partner.nda_signed,false) then
    raise exception 'An approved NDA-compliant partner is required';
  end if;

  if exists (
    select 1
    from public.partner_review_requests
    where organisation_id=p_organisation_id
      and prospect_id=p_prospect_id
      and status in ('draft','invited','opened','in_progress','submitted','clarification_required','approved','approved_with_conditions')
  ) then
    raise exception 'An active partner review already exists for this Prospect';
  end if;

  v_ref := 'OP-PR-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.partner_review_requests(
    organisation_id,prospect_id,intake_session_id,partner_id,token_hash,case_reference,status,
    response_due_at,expires_at,review_instructions,scope_summary,show_client_identity,
    show_commercial_identity,sent_at,created_by
  ) values (
    p_organisation_id,p_prospect_id,p_intake_session_id,p_partner_id,p_token_hash,v_ref,'invited',
    p_response_due_at,p_expires_at,p_review_instructions,p_scope_summary,p_show_client_identity,
    false,now(),p_user_id
  ) returning * into v_request;

  insert into public.partner_review_files(
    organisation_id,partner_review_request_id,intake_file_id,display_name,created_by
  )
  select p_organisation_id,v_request.id,f.id,f.original_filename,p_user_id
  from public.intake_files f
  where f.organisation_id=p_organisation_id
    and f.intake_session_id=p_intake_session_id;

  update public.prospects
  set next_action='Await partner technical and pricing response',updated_at=now()
  where id=p_prospect_id and organisation_id=p_organisation_id;

  insert into public.activity_events(
    organisation_id,user_id,entity_type,entity_id,event_type,event_data
  ) values (
    p_organisation_id,p_user_id,'prospect',p_prospect_id,'partner_review_request_created',
    jsonb_build_object(
      'partnerReviewRequestId',v_request.id,
      'partnerId',p_partner_id,
      'reference',v_ref,
      'responseDueAt',p_response_due_at
    )
  );

  return v_request;
end $$;

commit;
