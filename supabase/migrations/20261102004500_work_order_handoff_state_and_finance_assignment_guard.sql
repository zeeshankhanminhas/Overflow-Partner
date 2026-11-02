-- Idempotent Work Order handoff state. A missing commercial or SOW approval
-- leaves a visible waiting-for-evidence record, never a fabricated approval.
create table if not exists public.project_work_order_handoffs (
  project_id uuid primary key references public.projects(id) on delete cascade,
  organisation_id uuid not null,
  status text not null check(status in ('awaiting_evidence','queued','retry_required')),
  assignment_id uuid references public.project_execution_assignments(id),
  work_order_id uuid references public.partner_work_orders(id),
  last_blocker text,
  attempts integer not null default 0 check(attempts>=0),
  updated_at timestamptz not null default now()
);
create index if not exists idx_op_wo_handoff_state on public.project_work_order_handoffs(organisation_id,status);
alter table public.project_work_order_handoffs enable row level security;
revoke all on public.project_work_order_handoffs from public,anon,authenticated;
grant select,insert,update on public.project_work_order_handoffs to service_role;
grant select on public.project_work_order_handoffs to authenticated;
create policy op_wo_handoff_member_read on public.project_work_order_handoffs
for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.organisation_id=project_work_order_handoffs.organisation_id and p.is_active)
);
-- Financial gate is checked at assignment creation too, not only at WO issue.
create or replace function public.op_guard_project_execution_assignment()
returns trigger language plpgsql set search_path=public as $$
declare
 v_selected uuid;
 v_partner public.partners%rowtype;
 v_scope public.documents%rowtype;
 v_finance jsonb;
begin
 select pq.partner_id into v_selected from public.projects pr
 join public.quotes q on q.id=pr.quote_id and q.organisation_id=pr.organisation_id
 join public.commercial_reviews cr on cr.id=q.commercial_review_id
 join public.partner_quotes pq on pq.id=cr.partner_quote_id
 where pr.id=new.project_id and pr.organisation_id=new.organisation_id
  and cr.organisation_id=new.organisation_id and cr.status::text='approved'
  and cr.approved_at is not null and pq.status::text='selected'
  and pq.organisation_id=new.organisation_id and pq.lead_id=q.lead_id;
 if v_selected is null then raise exception 'OS_INTEGRITY: No already approved commercial Execution Partner selection exists.'; end if;
 if v_selected is distinct from new.partner_id then raise exception 'Execution Partner must match the one approved before client quotation.'; end if;
 select * into v_partner from public.partners where id=new.partner_id and organisation_id=new.organisation_id;
 if not found or v_partner.status::text<>'approved' or not v_partner.nda_signed then
  raise exception 'Previously selected Execution Partner must remain approved and NDA-ready.';
 end if;
 if new.scope_document_id is null then raise exception 'Approved technical execution scope is required for Work Order issue.'; end if;
 select * into v_scope from public.documents
  where id=new.scope_document_id and organisation_id=new.organisation_id
   and project_id=new.project_id and is_current_revision
   and document_type in ('scope-of-work','statement-of-work')
   and status::text in ('approved','issued','published');
 if not found then raise exception 'Work Order must use the current approved scope inherited from the client quotation.'; end if;
 v_finance:=public.op_project_financial_gate(new.project_id);
 if coalesce((v_finance->>'authorised')::boolean,false)=false or
    v_finance->>'basis'<>'deposit' or
    coalesce((v_finance->>'required')::numeric,0)<=0 or
    coalesce((v_finance->>'received')::numeric,0)<(v_finance->>'required')::numeric then
   raise exception 'No Execution Partner assignment before a verified opening deposit.';
 end if;
 return new;
end;$;
