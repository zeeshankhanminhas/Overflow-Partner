begin;

create or replace function public.op_guard_prospect_qualification()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.status::text = 'qualified'
     and coalesce(old.status::text, '') <> 'qualified' then
    if not exists (
      select 1
      from public.partner_review_requests r
      join public.partner_review_responses s
        on s.partner_review_request_id = r.id
      join public.partner_review_internal_decisions d
        on d.partner_review_request_id = r.id
       and d.partner_review_response_id = s.id
      join public.partner_quotes q
        on q.partner_review_request_id = r.id
       and q.partner_review_response_id = s.id
      where r.organisation_id = new.organisation_id
        and r.prospect_id = new.id
        and r.status::text in ('approved','approved_with_conditions')
        and s.feasibility::text in ('feasible','feasible_with_conditions')
        and d.decision::text in ('approved','approved_with_conditions')
        and q.status::text in ('received','selected','approved')
        and q.price > 0
    ) then
      raise exception 'OS_INTEGRITY: Prospect cannot be qualified before governed partner response, pricing and Go / No-Go approval.';
    end if;
  end if;
  return new;
end $$;

commit;
