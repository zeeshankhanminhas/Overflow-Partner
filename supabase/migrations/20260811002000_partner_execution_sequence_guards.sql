begin;

alter table public.partner_commencement_declarations
  drop constraint if exists partner_commencement_confirmations_check;
alter table public.partner_commencement_declarations
  add constraint partner_commencement_confirmations_check check (
    scope_reviewed and inputs_received and capacity_confirmed and no_unresolved_blocker
  );

create or replace function public.guard_partner_execution_after_commencement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.partner_commencement_declarations d
    where d.assignment_id = new.assignment_id
      and d.project_id = new.project_id
      and d.partner_id = new.partner_id
  ) then
    raise exception 'Partner commencement must be declared before progress or delivery can be submitted.';
  end if;
  return new;
end;
$$;

drop trigger if exists partner_progress_requires_commencement on public.partner_progress_updates;
create trigger partner_progress_requires_commencement
before insert on public.partner_progress_updates
for each row execute function public.guard_partner_execution_after_commencement();

drop trigger if exists partner_delivery_requires_commencement on public.partner_delivery_submissions;
create trigger partner_delivery_requires_commencement
before insert on public.partner_delivery_submissions
for each row execute function public.guard_partner_execution_after_commencement();

commit;
