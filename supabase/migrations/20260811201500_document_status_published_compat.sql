-- Compatibility value for legacy document paths that can still read `published`.
-- Canonical controlled-document progression remains Draft → Review → Signed → Approved → Issued → Archived.
-- New workflow actions continue to write `issued`; this value prevents schema/code mismatch on older compatibility paths.
alter type public.document_status add value if not exists 'published' after 'issued';

notify pgrst, 'reload schema';
