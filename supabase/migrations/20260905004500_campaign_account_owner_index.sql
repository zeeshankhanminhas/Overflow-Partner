-- Cover the account owner foreign key used by account-development queries.
create index if not exists companies_account_owner_idx
  on public.companies (account_owner_id)
  where account_owner_id is not null;
