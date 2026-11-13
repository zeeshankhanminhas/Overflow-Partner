-- QA proposal only. Client review is a transmittal-scoped, attested portal action.
-- The server verifies a signed, expiring quote portal token before invoking this
-- service-role-only RPC. This migration is NOT deployed to any hosted database.
begin;
alter table public.project_client_reviews
 add column if not exists client_submitted_by_email text,
 add column if not exists client_authority_attested_at timestamptz;

create or replace function public.op_record_attested_client_portal_review(
 p_quote_id uuid,
 p_quote_revision integer,
 p_project_id uuid,
 p_transmittal_id uuid,
 p_client_email text,
 p_outcome text,
 p_comments text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
 v_project public.projects%rowtype;
 v_quote public.quotes%rowtype;
 v_tx public.project_client_transmittals%rowtype;
 v_cycle integer;
 v_review public.project_client_reviews%rowtype;
 v_email text:=lower(btrim(coalesce(p_client_email,'')));
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
    and auth.role() is distinct from 'service_role' then
   raise exception 'Only the verified client-portal service may submit reviews.';
 end if;
 if p_outcome not in ('accepted','accepted_with_comments') then
   raise exception 'Use the managed correction pathway for changes or rejections.';
 end if;
 if p_outcome='accepted_with_comments' and nullif(btrim(coalesce(p_comments,'')),'') is null then
   raise exception 'Review comments are required for conditional acceptance.';
 end if;
 if v_email='' or length(v_email)>254 then raise exception 'Authorised recipient email required.'; end if;
 select * into v_quote from public.quotes where id=p_quote_id and revision=p_quote_revision;
 if not found then raise exception 'Issued quotation revision not found.'; end if;
 if not exists(select 1 from public.quote_issue_records i
    where i.quote_id=p_quote_id and i.quote_revision=p_quote_revision
      and i.organisation_id=v_quote.organisation_id and i.client_response='accepted')
 then raise exception 'Accepted quotation required.'; end if;
 select * into v_project from public.projects
   where id=p_project_id and quote_id=p_quote_id and organisation_id=v_quote.organisation_id
   for update;
 if not found or v_project.project_stage<>'client_review' then
   raise exception 'Project must be at Client Review for the accepted quotation.'; end if;
 select coalesce(a.execution_cycle,1) into v_cycle
   from public.project_execution_assignments a
   where a.project_id=v_project.id and a.organisation_id=v_project.organisation_id
     and a.execution_state not in ('closed','cancelled')
   order by a.created_at desc limit 1;
 v_cycle:=coalesce(v_cycle,1);
 select * into v_tx from public.project_client_transmittals
   where id=p_transmittal_id and project_id=v_project.id
     and organisation_id=v_project.organisation_id and execution_cycle=v_cycle
   order by issued_at desc limit 1;
 if not found then raise exception 'Current-cycle controlled transmittal required.'; end if;
 if v_tx.id is distinct from (
   select t.id from public.project_client_transmittals t
   where t.project_id=v_project.id and t.organisation_id=v_project.organisation_id
    and t.execution_cycle=v_cycle order by t.issued_at desc,t.id desc limit 1
 ) then raise exception 'The review link refers to an outdated client transmittal.'; end if;
 if lower(btrim(coalesce(v_tx.recipient_email,'')))<>v_email then
   raise exception 'Review recipient does not match issued transmittal.'; end if;
 if v_tx.review_due_at is not null and v_tx.review_due_at<now() then
   raise exception 'The review window has expired; contact Overflow Partner.'; end if;
 if not exists(select 1 from public.documents d
   where d.project_id=v_project.id and d.organisation_id=v_project.organisation_id
     and d.document_type='handover-pack' and d.is_current_revision=true
     and d.status::text in ('issued','published'))
 then raise exception 'An issued controlled Handover Pack is required.'; end if;
 if exists(select 1 from public.project_client_reviews r
   where r.project_id=v_project.id and r.organisation_id=v_project.organisation_id
     and r.execution_cycle=v_cycle)
 then raise exception 'Client review already recorded for this cycle.'; end if;
 insert into public.project_client_reviews(
   organisation_id,project_id,transmittal_id,execution_cycle,outcome,
   evidence_basis,evidence_reference,comments,recorded_by,
   client_submitted_by_email,client_authority_attested_at
 ) values(
   v_project.organisation_id,v_project.id,v_tx.id,v_cycle,p_outcome,
   'client_portal','CLIENT-PORTAL-'||upper(replace(gen_random_uuid()::text,'-','')),
   nullif(btrim(coalesce(p_comments,'')),''),v_tx.issued_by,v_email,now()
 ) returning * into v_review;
 -- recorded_by is the existing non-null internal audit custodian;
 -- client_submitted_by_email records the actual external decision maker.
 perform public.op_record_activity(v_project.organisation_id,v_tx.issued_by,'project',
   v_project.id,'client_portal_review_attested',
   jsonb_build_object('reviewId',v_review.id,'transmittalId',v_tx.id,
    'outcome',p_outcome,'clientEmail',v_email,'executionCycle',v_cycle));
 return jsonb_build_object('reviewId',v_review.id,'projectId',v_project.id,
  'outcome',v_review.outcome,'executionCycle',v_cycle);
end;
$$;
revoke all on function public.op_record_attested_client_portal_review(uuid,integer,uuid,uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.op_record_attested_client_portal_review(uuid,integer,uuid,uuid,text,text,text)
 to service_role;
commit;
