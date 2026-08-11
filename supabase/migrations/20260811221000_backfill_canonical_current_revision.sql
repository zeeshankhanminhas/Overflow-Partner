begin;

-- Older controlled-document records predate is_current_revision. Where a
-- canonical lifecycle document has exactly one active revision, that single
-- revision is unambiguously the current one. Competing active revisions are
-- intentionally left untouched for manual review.
with candidates as (
  select
    d.id,
    count(*) over (
      partition by d.organisation_id,d.project_id,d.lead_id,d.quote_id,d.document_type
    ) as active_count,
    count(*) filter (where d.is_current_revision=true) over (
      partition by d.organisation_id,d.project_id,d.lead_id,d.quote_id,d.document_type
    ) as current_count
  from public.documents d
  where d.status::text<>'superseded'
    and d.document_type in (
      'client-requirements','scope-of-work','partner-technical-assessment-report',
      'client-quote','statement-of-work','technical-review','document-register',
      'handover-pack','completion-report','invoice'
    )
)
update public.documents d
set is_current_revision=true,updated_at=now()
from candidates c
where d.id=c.id and c.active_count=1 and c.current_count=0;

commit;
