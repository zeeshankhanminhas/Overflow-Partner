-- Document references are allocated by op_next_reference(organisation_id,...), so
-- their identity is (organisation_id, reference), not reference globally.
-- Original foundation created documents.reference UNIQUE globally. That rejects
-- a second valid tenant's first Statement of Work with the same OP-DOC-YYYY-0001.
--
-- Existing row ownership/RLS, document revision, storage and approval controls
-- are unchanged. The organisation-scoped unique index was introduced earlier.
-- Do not apply to hosted OPOS/production until the release migration gate passes.
begin;
create unique index if not exists ux_documents_org_reference
  on public.documents (organisation_id, reference);
alter table public.documents drop constraint if exists documents_reference_key;
commit;
