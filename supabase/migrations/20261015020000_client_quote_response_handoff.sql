begin;

-- A public client response is a customer decision, not payment confirmation.
-- Synchronise the commercial next action and retire obsolete quote reminders.
create or replace function public.op_on_client_quote_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_response is null or new.client_response is not distinct from old.client_response then
    return new;
  end if;

  update public.notification_outbox
     set status = 'cancelled', updated_at = now()
   where organisation_id = new.organisation_id
     and entity_type = 'quote'
     and entity_id = new.quote_id
     and event_key in ('quote.followup', 'quote.expiry')
     and status = 'pending';

  update public.leads
     set next_action = case new.client_response
       when 'accepted' then 'Confirm the release condition stated in the issued Client Quote (payment, purchase order or no advance due)'
       when 'declined' then 'Review client decline and decide whether a revised quotation is appropriate'
       when 'more_time' then 'Agree a revised quotation validity date with the client'
       else next_action end,
       updated_at = now()
   where organisation_id = new.organisation_id and id = new.lead_id
     and not exists (
       select 1 from public.projects p
        where p.organisation_id = new.organisation_id and p.lead_id = new.lead_id
     );

  return new;
end;
$$;

revoke all on function public.op_on_client_quote_response() from public, anon, authenticated;
grant execute on function public.op_on_client_quote_response() to service_role;

drop trigger if exists trg_op_on_client_quote_response on public.quote_issue_records;
create trigger trg_op_on_client_quote_response
after update of client_response on public.quote_issue_records
for each row
when (new.client_response is distinct from old.client_response)
execute function public.op_on_client_quote_response();

-- Reconcile earlier decisions without sending emails or creating projects.
update public.notification_outbox o
   set status = 'cancelled', updated_at = now()
  from public.quote_issue_records i
 where o.organisation_id = i.organisation_id
   and o.entity_type = 'quote' and o.entity_id = i.quote_id
   and o.event_key in ('quote.followup','quote.expiry')
   and o.status = 'pending'
   and i.client_response is not null;

update public.leads l
   set next_action = case i.client_response
     when 'accepted' then 'Confirm the release condition stated in the issued Client Quote (payment, purchase order or no advance due)'
     when 'declined' then 'Review client decline and decide whether a revised quotation is appropriate'
     when 'more_time' then 'Agree a revised quotation validity date with the client'
     else l.next_action end,
     updated_at = now()
  from public.quote_issue_records i
 where l.organisation_id = i.organisation_id and l.id = i.lead_id
   and i.client_response is not null
   and not exists (select 1 from public.projects p where p.organisation_id=l.organisation_id and p.lead_id=l.id);

commit;
