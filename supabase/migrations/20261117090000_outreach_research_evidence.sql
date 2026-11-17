-- Evidence-led manual outreach. Additive to existing pre-CRM LinkedIn outreach.
-- Never creates CRM records, sends messages, or changes governed project gates.
create table public.linkedin_outreach_research (
  outreach_id uuid primary key references public.linkedin_outreach_threads(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id),
  researched_by uuid not null references public.profiles(id),
  evidence_description text not null default '',
  engineering_evidence text not null default '',
  decision_maker_evidence text not null default '',
  workload_pressure_signal text not null default '',
  source_url text,
  observed_on date,
  confidence text not null default 'unverified' check (confidence in ('unverified','inferred','directly_confirmed')),
  evidence_state text not null default 'missing' check (evidence_state in ('missing','tentative','evidenced')),
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected','blocked')),
  review_reason text not null default '',
  next_action text not null default '',
  next_action_date date,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outreach_research_text_limits check (
    length(evidence_description)<=4000 and length(engineering_evidence)<=4000 and
    length(decision_maker_evidence)<=2000 and length(workload_pressure_signal)<=4000
    and length(review_reason)<=2000 and length(next_action)<=1000
    and (source_url is null or length(source_url)<=1500)
  ),
  constraint outreach_research_approval_evidence check (
    review_status<>'approved' or (
      evidence_state='evidenced' and confidence<>'unverified' and
      length(trim(evidence_description))>=12 and length(trim(engineering_evidence))>=12 and
      length(trim(decision_maker_evidence))>=8 and length(trim(workload_pressure_signal))>=8
      and source_url is not null and observed_on is not null and
      approved_by is not null and approved_at is not null
    )
  ),
  constraint outreach_research_approval_identity check (
    (review_status='approved')=(approved_at is not null and approved_by is not null)
  )
);
create index linkedin_outreach_research_status on public.linkedin_outreach_research
  (organisation_id,review_status,observed_on desc);
create index linkedin_outreach_research_next_action on public.linkedin_outreach_research
  (organisation_id,next_action_date) where next_action_date is not null;

-- Research must always belong to a thread in the same organisation; even a
-- privileged caller cannot cross-attach company evidence to another tenant.
create or replace function public.op_validate_outreach_research()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if not exists (
    select 1 from public.linkedin_outreach_threads t
    where t.id=new.outreach_id and t.organisation_id=new.organisation_id
  ) then raise exception 'Outreach research organisation mismatch'; end if;
  if new.source_url is not null and (
    new.source_url !~ '^https://[^[:space:]]+$' or
    new.source_url ~ '[[:cntrl:]]'
  ) then raise exception 'Evidence source must be an HTTPS URL'; end if;
  if new.observed_on > current_date then raise exception 'Observation date cannot be in the future'; end if;
  if new.review_status='approved' and (
    new.observed_on is null or new.observed_on<current_date-30
  ) then raise exception 'Refresh evidence observed over 30 days ago before approval'; end if;
  return new;
end $$;
create trigger op_validate_outreach_research_trigger
  before insert or update on public.linkedin_outreach_research
  for each row execute function public.op_validate_outreach_research();

alter table public.linkedin_outreach_research enable row level security;
revoke all on public.linkedin_outreach_research from public,anon,authenticated;
grant select,insert on public.linkedin_outreach_research to authenticated;
grant update (
  evidence_description,engineering_evidence,decision_maker_evidence,
  workload_pressure_signal,source_url,observed_on,confidence,evidence_state,
  review_status,review_reason,next_action,next_action_date,approved_at,approved_by,updated_at
) on public.linkedin_outreach_research to authenticated;

create policy "outreach research staff read" on public.linkedin_outreach_research
  for select to authenticated using (exists (
   select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.organisation_id=linkedin_outreach_research.organisation_id
     and p.is_active and p.role::text in ('owner','admin','business_development','operator')
  ));
create policy "outreach research staff create" on public.linkedin_outreach_research
  for insert to authenticated with check (
    researched_by=(select auth.uid()) and review_status in ('pending','approved','rejected','blocked')
    and (review_status<>'approved' or approved_by=(select auth.uid()))
    and exists (
     select 1 from public.profiles p
     where p.id=(select auth.uid()) and p.organisation_id=linkedin_outreach_research.organisation_id
       and p.is_active and p.role::text in ('owner','admin','business_development','operator')
    )
  );
create policy "outreach research staff revise" on public.linkedin_outreach_research
  for update to authenticated using (exists (
   select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.organisation_id=linkedin_outreach_research.organisation_id
     and p.is_active and p.role::text in ('owner','admin','business_development','operator')
  )) with check (
    (review_status<>'approved' or approved_by=(select auth.uid()))
    and exists (
     select 1 from public.profiles p
     where p.id=(select auth.uid()) and p.organisation_id=linkedin_outreach_research.organisation_id
       and p.is_active and p.role::text in ('owner','admin','business_development','operator')
    )
  );
