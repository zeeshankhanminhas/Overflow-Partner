begin;

alter table public.intake_submissions
  add column if not exists timeline text,
  add column if not exists complexity text,
  add column if not exists files_availability text;

comment on column public.intake_submissions.timeline is
  'Customer-selected delivery window used for qualification and planning.';
comment on column public.intake_submissions.complexity is
  'Customer-selected initial complexity classification.';
comment on column public.intake_submissions.files_availability is
  'Customer-selected status of source files, drawings or physical references.';

commit;
