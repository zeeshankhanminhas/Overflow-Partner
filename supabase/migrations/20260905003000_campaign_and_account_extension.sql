-- Overflow Partner: campaign outreach and recurring-account extension.
-- Outreach remains independent from governed Prospect qualification.

alter table public.prospects
  add column if not exists outreach_status text not null default 'not_contacted'
    check (outreach_status in ('not_contacted','message_sent','follow_up_due','replied','no_response','paused')),
  add column if not exists outreach_message text,
  add column if not exists response_outcome text
    check (response_outcome is null or response_outcome in ('interested','later','referred','not_interested','no_response')),
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists last_reply_at timestamptz;

create index if not exists prospects_outreach_queue_idx
  on public.prospects (organisation_id, outreach_status, next_follow_up_at)
  where status <> 'converted';

alter table public.companies
  add column if not exists account_status text not null default 'new'
    check (account_status in ('new','active','repeat','retained','dormant')),
  add column if not exists account_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists next_account_review_at timestamptz,
  add column if not exists future_workload text,
  add column if not exists preferred_services text,
  add column if not exists relationship_notes text;

create index if not exists companies_account_review_idx
  on public.companies (organisation_id, account_status, next_account_review_at);

comment on column public.prospects.outreach_status is 'Manual campaign engagement state; does not control technical or commercial qualification.';
comment on column public.companies.next_account_review_at is 'Next commercial relationship review after delivery or account activity.';
