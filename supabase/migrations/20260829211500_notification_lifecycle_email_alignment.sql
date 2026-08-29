begin;

-- Early nurture rows were scheduled with prospect UUIDs but labelled as lead-owned.
-- Re-home only unresolved nurture rows whose entity id is still a Prospect so
-- state-aware cancellation follows the actual business owner.
update public.notification_outbox n
set entity_type = 'prospect',
    event_key = case n.event_key
      when 'lead.nurture.day2' then 'enquiry.nurture.day2'
      when 'lead.nurture.day5' then 'enquiry.nurture.day5'
      when 'lead.nurture.day10' then 'enquiry.nurture.day10'
      when 'lead.nurture.day18' then 'enquiry.nurture.day18'
      when 'lead.nurture.day30' then 'enquiry.nurture.day30'
      else n.event_key
    end,
    updated_at = now()
where n.category = 'nurture'
  and n.entity_type = 'lead'
  and n.status in ('pending','failed')
  and exists (
    select 1 from public.prospects p
    where p.organisation_id = n.organisation_id
      and p.id = n.entity_id
  );

-- Cancel initial-enquiry nurture that is already obsolete because the prospect
-- has progressed beyond the prospect-owned acquisition stage. Cast the status
-- to text so this remains compatible with either text or enum status columns.
update public.notification_outbox n
set status = 'cancelled', updated_at = now()
where n.category = 'nurture'
  and n.entity_type = 'prospect'
  and n.status in ('pending','failed')
  and exists (
    select 1 from public.prospects p
    where p.organisation_id = n.organisation_id
      and p.id = n.entity_id
      and p.status::text in ('converted','qualified','disqualified','closed','lost')
  );

commit;
