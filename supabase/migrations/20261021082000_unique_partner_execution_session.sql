-- Isolated QA first. Exactly one live secure Execution Partner session per
-- assignment. Existing sessions must be inspected before adding this index.
create unique index if not exists ux_op_one_live_partner_execution_session
on public.partner_execution_sessions(organisation_id,assignment_id)
where status in ('invited','opened','active');
