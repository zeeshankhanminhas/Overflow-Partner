begin;

alter table public.companies add column if not exists lifecycle_status text not null default 'active';
alter table public.companies drop constraint if exists companies_lifecycle_status_check;
alter table public.companies add constraint companies_lifecycle_status_check check (lifecycle_status in ('active','dormant','archived'));

alter table public.contacts add column if not exists lifecycle_status text not null default 'active';
alter table public.contacts add column if not exists is_primary boolean not null default false;
alter table public.contacts add column if not exists communication_status text not null default 'marketable';
alter table public.contacts drop constraint if exists contacts_lifecycle_status_check;
alter table public.contacts add constraint contacts_lifecycle_status_check check (lifecycle_status in ('active','inactive','archived'));
alter table public.contacts drop constraint if exists contacts_communication_status_check;
alter table public.contacts add constraint contacts_communication_status_check check (communication_status in ('marketable','do_not_contact','bounced'));

create index if not exists idx_companies_org_lifecycle on public.companies(organisation_id,lifecycle_status,name);
create index if not exists idx_contacts_org_company_lifecycle on public.contacts(organisation_id,company_id,lifecycle_status,full_name);
create unique index if not exists contacts_one_primary_per_company on public.contacts(organisation_id,company_id) where is_primary and lifecycle_status='active';

create or replace function public.op_global_search(p_organisation_id uuid,p_query text,p_limit integer default 30)
returns table(entity_type text,entity_id uuid,title text,subtitle text,href text,rank numeric)
language sql stable security invoker set search_path=public as $$
with q as(select trim(coalesce(p_query,'')) term),results(entity_type,entity_id,title,subtitle,href,rank) as(
 select 'company'::text,c.id,c.name,concat_ws(' · ',c.industry,c.country,c.lifecycle_status),'/workspace/companies/'||c.id::text,case when c.name ilike (select term from q)||'%' then 4 else 2 end::numeric from public.companies c,q where c.organisation_id=p_organisation_id and q.term<>'' and (c.name ilike '%'||q.term||'%' or coalesce(c.industry,'') ilike '%'||q.term||'%')
 union all select 'contact',c.id,c.full_name,concat_ws(' · ',co.name,c.email,c.job_title),'/workspace/contacts/'||c.id::text,case when c.full_name ilike (select term from q)||'%' then 4 else 2 end::numeric from public.contacts c left join public.companies co on co.id=c.company_id,q where c.organisation_id=p_organisation_id and q.term<>'' and (c.full_name ilike '%'||q.term||'%' or coalesce(c.email,'') ilike '%'||q.term||'%' or coalesce(co.name,'') ilike '%'||q.term||'%')
 union all select 'prospect',p.id,coalesce(p.company_name,p.contact_name,'Prospect'),concat_ws(' · ',p.contact_name,p.project_type,p.status::text),'/workspace/acquisition/'||p.id::text,case when coalesce(p.company_name,'') ilike (select term from q)||'%' then 3 else 1 end::numeric from public.prospects p,q where p.organisation_id=p_organisation_id and q.term<>'' and (coalesce(p.company_name,'') ilike '%'||q.term||'%' or coalesce(p.contact_name,'') ilike '%'||q.term||'%' or coalesce(p.email,'') ilike '%'||q.term||'%')
 union all select 'case',l.id,coalesce(l.title,l.company_name),concat_ws(' · ',l.company_name,l.contact_name,l.status::text),'/workspace/leads/'||l.id::text,case when lower(coalesce(l.title,'')) like lower((select term from q))||'%' then 3 else 1 end::numeric from public.leads l,q where l.organisation_id=p_organisation_id and q.term<>'' and (coalesce(l.title,'') ilike '%'||q.term||'%' or coalesce(l.company_name,'') ilike '%'||q.term||'%' or coalesce(l.contact_name,'') ilike '%'||q.term||'%')
 union all select 'project',p.id,concat_ws(' · ',p.project_number,p.title),concat_ws(' · ',p.status::text,p.project_stage::text),'/workspace/projects/'||p.id::text,case when p.project_number ilike (select term from q)||'%' then 3 else 1 end::numeric from public.projects p,q where p.organisation_id=p_organisation_id and q.term<>'' and (p.project_number ilike '%'||q.term||'%' or p.title ilike '%'||q.term||'%')
 union all select 'document',d.id,concat_ws(' · ',d.reference,d.title),concat_ws(' · ',d.document_type,d.status::text),'/workspace/documents/'||d.id::text,1::numeric from public.documents d,q where d.organisation_id=p_organisation_id and q.term<>'' and (d.reference ilike '%'||q.term||'%' or d.title ilike '%'||q.term||'%')
 union all select 'partner',p.id,p.company_name,concat_ws(' · ',p.services,p.status::text),'/workspace/partners',1::numeric from public.partners p,q where p.organisation_id=p_organisation_id and q.term<>'' and (p.company_name ilike '%'||q.term||'%' or coalesce(p.services,'') ilike '%'||q.term||'%')
 union all select 'invoice',i.id,i.invoice_number,concat_ws(' · ',i.status,i.currency||' '||i.total::text),'/workspace/commercial-control?invoice='||i.id::text,2::numeric from public.invoices i,q where i.organisation_id=p_organisation_id and q.term<>'' and (i.invoice_number ilike '%'||q.term||'%' or coalesce(i.external_reference,'') ilike '%'||q.term||'%')
 union all select 'risk',r.id,r.title,concat_ws(' · ',r.category,r.status,'Score '||(r.likelihood*r.impact)::text),'/workspace/risk?risk='||r.id::text,1::numeric from public.risk_register r,q where r.organisation_id=p_organisation_id and q.term<>'' and (r.title ilike '%'||q.term||'%' or coalesce(r.mitigation,'') ilike '%'||q.term||'%')
 union all select 'knowledge',k.id,k.title,concat_ws(' · ',k.knowledge_type,k.summary),'/workspace/knowledge?entry='||k.id::text,greatest(1,ts_rank(to_tsvector('english',coalesce(k.title,'')||' '||coalesce(k.summary,'')||' '||coalesce(k.body,'')),plainto_tsquery('english',q.term))*10)::numeric from public.knowledge_entries k,q where k.organisation_id=p_organisation_id and q.term<>'' and (to_tsvector('english',coalesce(k.title,'')||' '||coalesce(k.summary,'')||' '||coalesce(k.body,''))@@plainto_tsquery('english',q.term) or k.title ilike '%'||q.term||'%')
) select * from results order by rank desc,title limit greatest(1,least(coalesce(p_limit,30),100));
$$;

revoke execute on function public.op_global_search(uuid,text,integer) from public,anon;
grant execute on function public.op_global_search(uuid,text,integer) to authenticated;

commit;
