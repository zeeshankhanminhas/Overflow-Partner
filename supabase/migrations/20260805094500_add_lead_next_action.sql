begin;

alter table public.leads
  add column if not exists next_action text;

comment on column public.leads.next_action is
  'Current operational action recorded by governed workflow transitions. Lead 360 may still derive richer stage guidance from orchestration evidence.';

commit;
