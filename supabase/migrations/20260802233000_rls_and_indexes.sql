-- Overflow Partner OS: shared security helpers, RLS policies and timestamp triggers

create or replace function public.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id
  from public.profiles
  where id = auth.uid() and is_active = true
$$;

revoke all on function public.current_organisation_id() from public;
grant execute on function public.current_organisation_id() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enable RLS on all new operational tables.
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.technical_intakes enable row level security;
alter table public.files enable row level security;
alter table public.partners enable row level security;
alter table public.partner_quotes enable row level security;
alter table public.commercial_reviews enable row level security;
alter table public.quotes enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;

-- Profile access.
create policy "users can update own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Organisation-scoped CRM policies.
create policy "organisation members can read companies"
on public.companies for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy "organisation members can create companies"
on public.companies for insert to authenticated
with check (organisation_id = public.current_organisation_id());
create policy "organisation members can update companies"
on public.companies for update to authenticated
using (organisation_id = public.current_organisation_id())
with check (organisation_id = public.current_organisation_id());

create policy "organisation members can read contacts"
on public.contacts for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy "organisation members can create contacts"
on public.contacts for insert to authenticated
with check (organisation_id = public.current_organisation_id());
create policy "organisation members can update contacts"
on public.contacts for update to authenticated
using (organisation_id = public.current_organisation_id())
with check (organisation_id = public.current_organisation_id());

-- Engineering workflow policies.
create policy "organisation members can read technical intakes"
on public.technical_intakes for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy "organisation members can create technical intakes"
on public.technical_intakes for insert to authenticated
with check (organisation_id = public.current_organisation_id() and created_by = auth.uid());
create policy "organisation members can update technical intakes"
on public.technical_intakes for update to authenticated
using (organisation_id = public.current_organisation_id())
with check (organisation_id = public.current_organisation_id());

create policy "organisation members can read files"
on public.files for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy "organisation members can create files"
on public.files for insert to authenticated
with check (organisation_id = public.current_organisation_id() and uploaded_by = auth.uid());
create policy "organisation members can delete files"
on public.files for delete to authenticated
using (organisation_id = public.current_organisation_id());

create policy "organisation members can read partners"
on public.partners for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy "organisation members can create partners"
on public.partners for insert to authenticated
with check (organisation_id = public.current_organisation_id());
create policy "organisation members can update partners"
on public.partners for update to authenticated
using (organisation_id = public.current_organisation_id())
with check (organisation_id = public.current_organisation_id());

create policy "organisation members can read partner quotes"
on public.partner_quotes for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy "organisation members can create partner quotes"
on public.partner_quotes for insert to authenticated
with check (organisation_id = public.current_organisation_id());
create policy "organisation members can update partner quotes"
on public.partner_quotes for update to authenticated
using (organisation_id = public.current_organisation_id())
with check (organisation_id = public.current_organisation_id());

create policy "organisation members can read commercial reviews"
on public.commercial_reviews for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy "organisation members can create commercial reviews"
on public.commercial_reviews for insert to authenticated
with check (organisation_id = public.current_organisation_id() and created_by = auth.uid());
create policy "organisation members can update commercial reviews"
on public.commercial_reviews for update to authenticated
using (organisation_id = public.current_organisation_id())
with check (organisation_id = public.current_organisation_id());

create policy "organisation members can read quotes"
on public.quotes for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy "organisation members can create quotes"
on public.quotes for insert to authenticated
with check (organisation_id = public.current_organisation_id() and created_by = auth.uid());
create policy "organisation members can update quotes"
on public.quotes for update to authenticated
using (organisation_id = public.current_organisation_id())
with check (organisation_id = public.current_organisation_id());

create policy "organisation members can read projects"
on public.projects for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy "organisation members can create projects"
on public.projects for insert to authenticated
with check (organisation_id = public.current_organisation_id() and created_by = auth.uid());
create policy "organisation members can update projects"
on public.projects for update to authenticated
using (organisation_id = public.current_organisation_id())
with check (organisation_id = public.current_organisation_id());

-- Operations policies.
create policy "organisation members can read tasks"
on public.tasks for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy "organisation members can create tasks"
on public.tasks for insert to authenticated
with check (organisation_id = public.current_organisation_id() and created_by = auth.uid());
create policy "organisation members can update tasks"
on public.tasks for update to authenticated
using (organisation_id = public.current_organisation_id())
with check (organisation_id = public.current_organisation_id());

create policy "organisation members can read activity"
on public.activity_events for select to authenticated
using (organisation_id = public.current_organisation_id());
create policy "organisation members can create activity"
on public.activity_events for insert to authenticated
with check (organisation_id = public.current_organisation_id());

create policy "users can read own notifications"
on public.notifications for select to authenticated
using (organisation_id = public.current_organisation_id() and user_id = auth.uid());
create policy "users can update own notifications"
on public.notifications for update to authenticated
using (organisation_id = public.current_organisation_id() and user_id = auth.uid())
with check (organisation_id = public.current_organisation_id() and user_id = auth.uid());

-- Keep updated_at consistent.
create trigger organisations_set_updated_at before update on public.organisations
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger companies_set_updated_at before update on public.companies
for each row execute function public.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts
for each row execute function public.set_updated_at();
create trigger prospects_set_updated_at before update on public.prospects
for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads
for each row execute function public.set_updated_at();
create trigger technical_intakes_set_updated_at before update on public.technical_intakes
for each row execute function public.set_updated_at();
create trigger partners_set_updated_at before update on public.partners
for each row execute function public.set_updated_at();
create trigger partner_quotes_set_updated_at before update on public.partner_quotes
for each row execute function public.set_updated_at();
create trigger commercial_reviews_set_updated_at before update on public.commercial_reviews
for each row execute function public.set_updated_at();
create trigger quotes_set_updated_at before update on public.quotes
for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
