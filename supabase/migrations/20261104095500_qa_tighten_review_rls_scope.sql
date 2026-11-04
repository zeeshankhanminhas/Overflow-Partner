-- Tighten existing QA read policies: scope membership to the outer evidence row's organisation, not the profile's own column.
alter policy qa_eng_read on public.op_qa_engineering_reviews to authenticated using
 (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.organisation_id=op_qa_engineering_reviews.organisation_id and p.is_active=true));
alter policy qa_manifest_read on public.op_qa_manifest_verifications to authenticated using
 (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.organisation_id=op_qa_manifest_verifications.organisation_id and p.is_active=true));
alter policy qa_release_read on public.op_qa_release_authorisations to authenticated using
 (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.organisation_id=op_qa_release_authorisations.organisation_id and p.is_active=true));