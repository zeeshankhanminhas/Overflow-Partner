-- QA-only recovery patch. DO NOT place under supabase/migrations: this is
-- restricted to the isolated Northfield test backend, not production.
-- Applied solely to QA project ukcamenuxhdznxaxpyis.
-- Guarantees independent confirmed, signed-in, non-anonymous Client before
-- the privileged in-app review issue procedure creates a transmittal.
DO $qa_guard$
DECLARE
  issue_def text;
  recipient_def text;
  anchor text := 'if exists(select 1 from public.profiles pf join public.external_portal_memberships pm';
  verification text := $check$
 if not exists (
   select 1
   from public.external_portal_memberships m
   join auth.users u on u.id=m.auth_user_id
   where m.id=v_member
     and m.organisation_id=v_org
     and m.is_active=true
     and m.portal_kind='client'
     and u.email_confirmed_at is not null
     and u.last_sign_in_at is not null
     and coalesce(u.is_anonymous,false)=false
 ) then
   raise exception 'Client account must be independently confirmed and signed in before protected review issue';
 end if;
 $check$;
  old_predicate text := 'count(*) filter(where u.email_confirmed_at is not null)';
  new_predicate text := 'count(*) filter(where u.email_confirmed_at is not null and u.last_sign_in_at is not null and coalesce(u.is_anonymous,false)=false)';
BEGIN
  IF NOT EXISTS (
     SELECT 1 FROM public.projects
     WHERE id='b447f586-bf79-4839-be5e-1af607d9ca43'::uuid
       AND organisation_id='717262cb-68da-4e7b-a9fa-238dc6c5d16b'::uuid
  ) THEN
    RAISE EXCEPTION 'Not the isolated Northfield QA fixture; refuse to alter review functions';
  END IF;

  issue_def := pg_get_functiondef('public.op_qa_issue_protected_client_review(uuid,text)'::regprocedure);
  IF position('Client account must be independently confirmed and signed in' IN issue_def)=0 THEN
    IF position(anchor IN issue_def)=0 THEN
      RAISE EXCEPTION 'Issue function layout changed; stop and inspect before applying security patch';
    END IF;
    EXECUTE replace(issue_def,anchor,verification||E'\n '||anchor);
  END IF;

  recipient_def := pg_get_functiondef('public.op_qa_northfield_client_recipient_state(uuid)'::regprocedure);
  IF position(new_predicate IN recipient_def)=0 THEN
    IF position(old_predicate IN recipient_def)=0 THEN
      RAISE EXCEPTION 'Recipient state function layout changed; stop and inspect before patching';
    END IF;
    EXECUTE replace(recipient_def,old_predicate,new_predicate);
  END IF;
END
$qa_guard$;
