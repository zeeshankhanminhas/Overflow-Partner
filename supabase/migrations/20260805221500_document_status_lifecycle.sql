-- Extend the existing controlled-document status enum without assuming label order.
-- PostgreSQL enum order is not used for workflow enforcement; the application
-- validates permitted transitions explicitly.

alter type public.document_status add value if not exists 'in_review';
alter type public.document_status add value if not exists 'changes_requested';
alter type public.document_status add value if not exists 'signed';
alter type public.document_status add value if not exists 'archived';
