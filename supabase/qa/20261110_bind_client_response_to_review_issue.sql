-- Applied only to OPOS-QA, which owns the protected review tables and RPC.
create or replace function public.op_qa_record_client_review_decision(
  p_project_id uuid, p_issue_id uuid, p_outcome text, p_comments text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_issue_id is null then
    raise exception 'Reopen the current drawing revision before submitting a response.';
  end if;

  -- The existing command authenticates the client and locks the current project
  -- and issue. A mismatch aborts the decision and its audit event together.
  result := public.op_qa_record_client_review_decision(p_project_id, p_outcome, p_comments);
  if not exists (
    select 1 from public.op_qa_client_review_decisions d
    where d.id = (result->>'decisionId')::uuid
      and d.project_id = p_project_id and d.issue_id = p_issue_id
  ) then
    raise exception 'This drawing review has changed. Reopen the current revision before responding.';
  end if;
  return result;
end;
$$;
revoke execute on function public.op_qa_record_client_review_decision(uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.op_qa_record_client_review_decision(uuid,uuid,text,text)
  from public, anon;
grant execute on function public.op_qa_record_client_review_decision(uuid,uuid,text,text)
  to authenticated;
