begin;

-- Phase A: database authority must match the business decision being made.
-- Preserve mature lifecycle implementations as internal cores and expose thin
-- canonical wrappers that bind the actor and require an appropriate workspace
-- role. This keeps evidence/readiness logic singular while preventing a signed-
-- in low-authority account from calling privileged SECURITY DEFINER RPCs
-- directly through PostgREST.

create or replace function public.op_assert_workspace_role(
  p_organisation_id uuid,
  p_user_id uuid,
  p_allowed_roles text[]
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_role text;
begin
  perform public.op_assert_membership(p_organisation_id, p_user_id);

  select role::text into v_role
  from public.profiles
  where id = p_user_id
    and organisation_id = p_organisation_id
    and is_active = true;

  if v_role is null or not (v_role = any(p_allowed_roles)) then
    raise exception 'Your role is not authorised to perform this workspace action.';
  end if;
end;
$$;

revoke all on function public.op_assert_workspace_role(uuid,uuid,text[])
  from public, anon, authenticated;
grant execute on function public.op_assert_workspace_role(uuid,uuid,text[])
  to service_role;

-- G05 -> G06: Acquisition conversion to Case 360.
alter function public.op_convert_prospect(uuid,uuid,uuid)
  rename to op_convert_prospect_core;
revoke all on function public.op_convert_prospect_core(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.op_convert_prospect_core(uuid,uuid,uuid)
  to service_role;

create function public.op_convert_prospect(
  p_organisation_id uuid,
  p_user_id uuid,
  p_prospect_id uuid
)
returns public.leads
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','operator','business_development']
  );
  return public.op_convert_prospect_core(p_organisation_id,p_user_id,p_prospect_id);
end;
$$;
revoke all on function public.op_convert_prospect(uuid,uuid,uuid) from public,anon;
grant execute on function public.op_convert_prospect(uuid,uuid,uuid) to authenticated,service_role;

-- G06: technical authority.
alter function public.op_approve_technical_intake(uuid,uuid,uuid)
  rename to op_approve_technical_intake_core;
revoke all on function public.op_approve_technical_intake_core(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.op_approve_technical_intake_core(uuid,uuid,uuid)
  to service_role;

create function public.op_approve_technical_intake(
  p_organisation_id uuid,
  p_user_id uuid,
  p_intake_id uuid
)
returns public.technical_intakes
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','operator','engineering']
  );
  return public.op_approve_technical_intake_core(p_organisation_id,p_user_id,p_intake_id);
end;
$$;
revoke all on function public.op_approve_technical_intake(uuid,uuid,uuid) from public,anon;
grant execute on function public.op_approve_technical_intake(uuid,uuid,uuid) to authenticated,service_role;

-- G07 preparation: establish the commercial position from governed Partner cost.
alter function public.op_create_commercial_review(uuid,uuid,uuid,numeric)
  rename to op_create_commercial_review_core;
revoke all on function public.op_create_commercial_review_core(uuid,uuid,uuid,numeric)
  from public, anon, authenticated;
grant execute on function public.op_create_commercial_review_core(uuid,uuid,uuid,numeric)
  to service_role;

create function public.op_create_commercial_review(
  p_organisation_id uuid,
  p_user_id uuid,
  p_partner_quote_id uuid,
  p_markup_percent numeric
)
returns public.commercial_reviews
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','operator','commercial']
  );
  return public.op_create_commercial_review_core(
    p_organisation_id,p_user_id,p_partner_quote_id,p_markup_percent
  );
end;
$$;
revoke all on function public.op_create_commercial_review(uuid,uuid,uuid,numeric) from public,anon;
grant execute on function public.op_create_commercial_review(uuid,uuid,uuid,numeric) to authenticated,service_role;

-- G07 commercial approval / controlled quote generation.
alter function public.op_approve_commercial_generate_quote(uuid,uuid,uuid,text,numeric)
  rename to op_approve_commercial_generate_quote_core;
revoke all on function public.op_approve_commercial_generate_quote_core(uuid,uuid,uuid,text,numeric)
  from public, anon, authenticated;
grant execute on function public.op_approve_commercial_generate_quote_core(uuid,uuid,uuid,text,numeric)
  to service_role;

create function public.op_approve_commercial_generate_quote(
  p_organisation_id uuid,
  p_user_id uuid,
  p_review_id uuid,
  p_currency text default 'GBP',
  p_vat_rate numeric default 20
)
returns public.quotes
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','commercial']
  );
  return public.op_approve_commercial_generate_quote_core(
    p_organisation_id,p_user_id,p_review_id,p_currency,p_vat_rate
  );
end;
$$;
revoke all on function public.op_approve_commercial_generate_quote(uuid,uuid,uuid,text,numeric) from public,anon;
grant execute on function public.op_approve_commercial_generate_quote(uuid,uuid,uuid,text,numeric) to authenticated,service_role;

-- G08: commercial transmission of the controlled Client Quote.
alter function public.op_issue_quote_with_evidence(uuid,uuid,uuid,text,text,text,text,text)
  rename to op_issue_quote_with_evidence_core;
revoke all on function public.op_issue_quote_with_evidence_core(uuid,uuid,uuid,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.op_issue_quote_with_evidence_core(uuid,uuid,uuid,text,text,text,text,text)
  to service_role;

create function public.op_issue_quote_with_evidence(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_recipient_name text,
  p_recipient_email text,
  p_delivery_method text,
  p_evidence_reference text,
  p_note text default null
)
returns public.quotes
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','commercial','business_development']
  );
  return public.op_issue_quote_with_evidence_core(
    p_organisation_id,p_user_id,p_quote_id,p_recipient_name,p_recipient_email,
    p_delivery_method,p_evidence_reference,p_note
  );
end;
$$;
revoke all on function public.op_issue_quote_with_evidence(uuid,uuid,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.op_issue_quote_with_evidence(uuid,uuid,uuid,text,text,text,text,text) to authenticated,service_role;

-- G09: record written client acceptance and create Project 360.
alter function public.op_accept_quote_create_project_with_acceptance(uuid,uuid,uuid,text,text,text,text,text)
  rename to op_accept_quote_create_project_with_acceptance_core;
revoke all on function public.op_accept_quote_create_project_with_acceptance_core(uuid,uuid,uuid,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.op_accept_quote_create_project_with_acceptance_core(uuid,uuid,uuid,text,text,text,text,text)
  to service_role;

create function public.op_accept_quote_create_project_with_acceptance(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_acceptance_basis text,
  p_evidence_reference text,
  p_accepted_by_name text,
  p_accepted_by_email text default null,
  p_notes text default null
)
returns public.projects
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','operator','commercial','business_development']
  );
  return public.op_accept_quote_create_project_with_acceptance_core(
    p_organisation_id,p_user_id,p_quote_id,p_acceptance_basis,
    p_evidence_reference,p_accepted_by_name,p_accepted_by_email,p_notes
  );
end;
$$;
revoke all on function public.op_accept_quote_create_project_with_acceptance(uuid,uuid,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.op_accept_quote_create_project_with_acceptance(uuid,uuid,uuid,text,text,text,text,text) to authenticated,service_role;

-- Quotation outcomes/revisions remain Case-commercial actions.
alter function public.op_record_quote_outcome(uuid,uuid,uuid,text,text)
  rename to op_record_quote_outcome_core;
revoke all on function public.op_record_quote_outcome_core(uuid,uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.op_record_quote_outcome_core(uuid,uuid,uuid,text,text)
  to service_role;

create function public.op_record_quote_outcome(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_outcome text,
  p_note text default null
)
returns public.quotes
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','operator','commercial','business_development']
  );
  return public.op_record_quote_outcome_core(
    p_organisation_id,p_user_id,p_quote_id,p_outcome,p_note
  );
end;
$$;
revoke all on function public.op_record_quote_outcome(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.op_record_quote_outcome(uuid,uuid,uuid,text,text) to authenticated,service_role;

alter function public.op_revise_quote(uuid,uuid,uuid,text)
  rename to op_revise_quote_core;
revoke all on function public.op_revise_quote_core(uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.op_revise_quote_core(uuid,uuid,uuid,text)
  to service_role;

create function public.op_revise_quote(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_note text default null
)
returns public.quotes
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','operator','commercial','business_development']
  );
  return public.op_revise_quote_core(p_organisation_id,p_user_id,p_quote_id,p_note);
end;
$$;
revoke all on function public.op_revise_quote(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.op_revise_quote(uuid,uuid,uuid,text) to authenticated,service_role;

-- G13/G14 Project-client authority.
alter function public.op_record_client_transmittal_and_issue(uuid,uuid,uuid,text,text,text,text)
  rename to op_record_client_transmittal_and_issue_core;
revoke all on function public.op_record_client_transmittal_and_issue_core(uuid,uuid,uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.op_record_client_transmittal_and_issue_core(uuid,uuid,uuid,text,text,text,text)
  to service_role;

create function public.op_record_client_transmittal_and_issue(
  p_organisation_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_recipient_name text,
  p_recipient_email text,
  p_delivery_method text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','operator','engineering']
  );
  return public.op_record_client_transmittal_and_issue_core(
    p_organisation_id,p_user_id,p_project_id,p_recipient_name,
    p_recipient_email,p_delivery_method,p_note
  );
end;
$$;
revoke all on function public.op_record_client_transmittal_and_issue(uuid,uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.op_record_client_transmittal_and_issue(uuid,uuid,uuid,text,text,text,text) to authenticated,service_role;

alter function public.op_record_client_review_outcome(uuid,uuid,uuid,text,text,text,text)
  rename to op_record_client_review_outcome_core;
revoke all on function public.op_record_client_review_outcome_core(uuid,uuid,uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.op_record_client_review_outcome_core(uuid,uuid,uuid,text,text,text,text)
  to service_role;

create function public.op_record_client_review_outcome(
  p_organisation_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_outcome text,
  p_evidence_basis text,
  p_evidence_reference text,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','operator','engineering']
  );
  return public.op_record_client_review_outcome_core(
    p_organisation_id,p_user_id,p_project_id,p_outcome,
    p_evidence_basis,p_evidence_reference,p_comments
  );
end;
$$;
revoke all on function public.op_record_client_review_outcome(uuid,uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.op_record_client_review_outcome(uuid,uuid,uuid,text,text,text,text) to authenticated,service_role;

-- Execution exception resolution is an internal delivery decision.
alter function public.op_resolve_partner_execution_exception(uuid,uuid,uuid,text)
  rename to op_resolve_partner_execution_exception_core;
revoke all on function public.op_resolve_partner_execution_exception_core(uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.op_resolve_partner_execution_exception_core(uuid,uuid,uuid,text)
  to service_role;

create function public.op_resolve_partner_execution_exception(
  p_organisation_id uuid,
  p_user_id uuid,
  p_exception_id uuid,
  p_resolution_note text
)
returns public.partner_execution_exceptions
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','operator','engineering']
  );
  return public.op_resolve_partner_execution_exception_core(
    p_organisation_id,p_user_id,p_exception_id,p_resolution_note
  );
end;
$$;
revoke all on function public.op_resolve_partner_execution_exception(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.op_resolve_partner_execution_exception(uuid,uuid,uuid,text) to authenticated,service_role;

commit;
