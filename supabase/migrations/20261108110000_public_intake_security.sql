-- OPOS public website intake hardening / isolated QA first
-- Do not apply to production until Cloudflare Turnstile and email delivery are configured and verified.
create table if not exists public.public_intake_pending (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null,
 owner_id uuid not null,
 token_hash text not null unique,
 email_normalized text not null,
 payload jsonb not null,
 source_origin text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '24 hours'),
 verified_at timestamptz,
 processing_at timestamptz,
 finalised_at timestamptz,
 prospect_id uuid,
 constraint public_intake_pending_token_length check (length(token_hash)=64)
);
create index if not exists public_intake_pending_expiry_idx on public.public_intake_pending(expires_at);
create index if not exists public_intake_pending_email_idx on public.public_intake_pending(email_normalized,created_at desc);
alter table public.public_intake_pending enable row level security;
revoke all on public.public_intake_pending from public, anon, authenticated;
grant select, insert, update, delete on public.public_intake_pending to service_role;

create table if not exists public.public_intake_rate_events (
 id bigint generated always as identity primary key,
 key_hash text not null,
 occurred_at timestamptz not null default now()
);
create index if not exists public_intake_rate_events_lookup on public.public_intake_rate_events(key_hash,occurred_at desc);
alter table public.public_intake_rate_events enable row level security;
revoke all on public.public_intake_rate_events from public, anon, authenticated;
grant select, insert, delete on public.public_intake_rate_events to service_role;

-- Atomic quotas, using advisory locks on the hashed identifiers to avoid parallel-request races.
create or replace function public.op_public_intake_claim_quota(p_ip_hash text,p_email_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare ip_count int; email_count int;
begin
 if length(p_ip_hash)<>64 or length(p_email_hash)<>64 then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,0));
 perform pg_advisory_xact_lock(hashtextextended(p_email_hash,0));
 select count(*) into ip_count from public.public_intake_rate_events where key_hash=p_ip_hash and occurred_at>now()-interval '1 hour';
 select count(*) into email_count from public.public_intake_rate_events where key_hash=p_email_hash and occurred_at>now()-interval '24 hours';
 if ip_count>=12 or email_count>=2 then return false; end if;
 insert into public.public_intake_rate_events(key_hash) values(p_ip_hash),(p_email_hash);
 return true;
end $$;
revoke all on function public.op_public_intake_claim_quota(text,text) from public,anon,authenticated;
grant execute on function public.op_public_intake_claim_quota(text,text) to service_role;

-- The confirmation link is intentionally NOT a GET mutation (email scanners follow GETs).
create or replace function public.op_public_intake_claim_confirmation(p_token_hash text)
returns setof public.public_intake_pending language plpgsql security definer set search_path=public,pg_temp as $$
begin
 return query update public.public_intake_pending
 set verified_at=coalesce(verified_at,now()),processing_at=now()
 where token_hash=p_token_hash and expires_at>now() and finalised_at is null
 and (processing_at is null or processing_at<now()-interval '10 minutes')
 returning *;
end $$;
revoke all on function public.op_public_intake_claim_confirmation(text) from public,anon,authenticated;
grant execute on function public.op_public_intake_claim_confirmation(text) to service_role;

create or replace function public.op_public_intake_complete(p_id uuid,p_prospect_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.public_intake_pending set finalised_at=now(),prospect_id=p_prospect_id,
 payload='{}'::jsonb where id=p_id and finalised_at is null and processing_at is not null;
end $$;
revoke all on function public.op_public_intake_complete(uuid,uuid) from public,anon,authenticated;
grant execute on function public.op_public_intake_complete(uuid,uuid) to service_role;

-- Operational cleanup: schedule after deployment, do not run automatically in application requests:
-- delete from public.public_intake_pending where finalised_at < now()-interval '30 days' or expires_at < now()-interval '7 days';
-- delete from public.public_intake_rate_events where occurred_at < now()-interval '8 days';
