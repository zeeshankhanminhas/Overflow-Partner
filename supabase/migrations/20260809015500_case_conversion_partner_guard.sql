begin;

create or replace function public.op_guard_prospect_case_conversion()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.converted_lead_id is not null and old.converted_lead_id is distinct from new.converted_lead_id then
    if not exists (
      select 1
      from public.partner_review_requests r
      join public.partner_review_responses s on s.partner_review_request_id=r.id
      join public.partner_review_internal_decisions d on d.partner_review_request_id=r.id and d.partner_review_response_id=s.id
      join public.partner_quotes q on q.partner_review_request_id=r.id and q.partner_review_response_id=s.id
      where r.organisation_id=new.organisation_id
        and r.prospect_id=new.id
        and r.status in ('approved','approved_with_conditions')
        and s.feasibility in ('feasible','feasible_with_conditions')
        and d.decision in ('approved','approved_with_conditions')
        and q.status in ('received','selected','approved')
        and q.price > 0
    ) then
      raise exception 'OS_INTEGRITY: Case 360 cannot be created before governed partner response, partner pricing and Go / No-Go approval.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_op_guard_prospect_case_conversion on public.prospects;
create trigger trg_op_guard_prospect_case_conversion
before update of converted_lead_id on public.prospects
for each row execute function public.op_guard_prospect_case_conversion();

commit;
