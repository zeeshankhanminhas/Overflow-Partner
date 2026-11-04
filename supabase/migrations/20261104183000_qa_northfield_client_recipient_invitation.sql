-- QA-only setup: prepare a genuinely distinct Client Portal identity for Northfield.
-- Owner must explicitly invite an email via Auth Admin before calling this RPC.
-- No arbitrary email->client automatic grants. Limited to fixed Northfield fixture.
create or replace function public.op_qa_northfield_client_recipient_state(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_user uuid:=auth.uid();v_org uuid;v_lead uuid;v_role text;
 v_count int:=0;v_staff int:=0;v_confirmed int:=0;
begin
 if p_project_id<>'b447f586-bf79-4839-be5e-1af607d9ca43'::uuid then
  raise exception 'This QA recipient preparation is restricted to the Northfield fixture'; end if;
 select organisation_id,lead_id into v_org,v_lead from public.projects where id=p_project_id;
 select role::text into v_role from public.profiles
   where id=v_user and organisation_id=v_org and is_active=true;
 if v_user is null or v_role not in ('owner','admin')
 then raise exception 'An authorised QA owner/admin is required'; end if;
 select count(*),count(*) filter(where exists(select 1 from public.profiles p
   where p.id=m.auth_user_id and p.organisation_id=m.organisation_id and p.is_active=true)),
   count(*) filter(where u.email_confirmed_at is not null)
 into v_count,v_staff,v_confirmed
 from public.external_portal_memberships m
 join public.leads l on l.id=v_lead and l.organisation_id=m.organisation_id
   and l.company_id=m.company_id
 join auth.users u on u.id=m.auth_user_id
 where m.organisation_id=v_org and m.portal_kind='client' and m.is_active=true;
 return jsonb_build_object('ready',v_count=1 and v_staff=0 and v_confirmed=1,
  'activeRecipients',v_count,'staffIdentityConflict',v_staff>0,
  'verifiedRecipients',v_confirmed,'setupRequired',v_count<>1 or v_staff>0 or v_confirmed<>1);
end $fn$;

create or replace function public.op_qa_assign_northfield_client_invite(
 p_project_id uuid,p_auth_user_id uuid,p_expected_email text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_user uuid:=auth.uid();v_org uuid;v_lead uuid;v_company uuid;
 v_stage text;v_role text;v_email text;v_membership uuid;
begin
 if p_project_id<>'b447f586-bf79-4839-be5e-1af607d9ca43'::uuid then
  raise exception 'Recipient setup is only enabled for the isolated Northfield QA case';end if;
 select organisation_id,lead_id,project_stage into v_org,v_lead,v_stage
   from public.projects where id=p_project_id for update;
 select role::text into v_role from public.profiles
   where id=v_user and organisation_id=v_org and is_active=true;
 if v_user is null or v_role not in ('owner','admin')
  or v_stage<>'ready_for_client_issue'
 then raise exception 'Owner/admin must set the QA recipient before any controlled client issue';end if;
 if exists(select 1 from public.op_qa_client_review_issues where project_id=p_project_id)
  or exists(select 1 from public.project_client_transmittals where project_id=p_project_id)
 then raise exception 'A protected review already exists; its recipient cannot be switched';end if;
 select l.company_id into v_company from public.leads l where l.id=v_lead and l.organisation_id=v_org;
 if v_company is null then raise exception 'Northfield client company is not linked to this project';end if;
 select u.email into v_email from auth.users u where u.id=p_auth_user_id;
 if nullif(btrim(coalesce(v_email,'')),'') is null
   or lower(v_email)<>lower(btrim(coalesce(p_expected_email,'')))
 then raise exception 'Verified invitation identity and intended recipient email must match';end if;
 if exists(select 1 from public.profiles p
   where p.id=p_auth_user_id and p.organisation_id=v_org and p.is_active=true)
 then raise exception 'The invited Client account cannot also be an active OP operator account';end if;
 -- The owner consciously transfers this QA client company's membership only,
 -- never by user-supplied company ids or implicit email similarity.
 update public.external_portal_memberships m
  set is_active=false,updated_at=now()
 where m.organisation_id=v_org and m.company_id=v_company
  and m.portal_kind='client' and m.is_active=true and m.auth_user_id<>p_auth_user_id;
 select id into v_membership from public.external_portal_memberships
 where organisation_id=v_org and company_id=v_company
   and portal_kind='client' and auth_user_id=p_auth_user_id limit 1;
 if v_membership is null then
   insert into public.external_portal_memberships
    (organisation_id,auth_user_id,portal_kind,company_id,created_by,is_active)
   values(v_org,p_auth_user_id,'client',v_company,v_user,true)
   returning id into v_membership;
 else
   update public.external_portal_memberships set is_active=true,updated_at=now()
    where id=v_membership;
 end if;
 insert into public.activity_events
  (organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_org,'project',p_project_id,v_user,'qa.client_recipient_invited',
  jsonb_build_object('membershipId',v_membership,'recipientAuthId',p_auth_user_id,
     'invitationEmailMatch',true,'identitySeparated',true,'reviewIssued',false));
 return jsonb_build_object('assigned',true,'recipientConfigured',true,
   'membershipId',v_membership,'invitationPendingConfirmation',true);
end $fn$;

revoke all on function public.op_qa_northfield_client_recipient_state(uuid) from public,anon;
revoke all on function public.op_qa_assign_northfield_client_invite(uuid,uuid,text) from public,anon;
grant execute on function public.op_qa_northfield_client_recipient_state(uuid) to authenticated;
grant execute on function public.op_qa_assign_northfield_client_invite(uuid,uuid,text) to authenticated;
