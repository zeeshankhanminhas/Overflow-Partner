import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const read=(path)=>readFileSync(resolve(root,path),'utf8');
const migration=read('supabase/migrations/20261103203000_external_account_portals.sql');
const source=read('lib/portals/account.ts');
const signIn=read('app/login/actions.ts');
const dash=read('app/portal/[kind]/page.tsx');
const project=read('app/portal/[kind]/projects/[projectId]/page.tsx');
const handoff=read('app/portal/[kind]/projects/[projectId]/open/route.ts');
const quotation=read('app/portal/[kind]/quotes/[quoteId]/open/route.ts');
const partner=read('components/execution/PartnerWorkSurface.tsx');
const client=read('app/client-portal/page.tsx');
const tests=[
 ['Explicit auth user + tenant + entity membership, not email lookup',
   migration.includes('auth_user_id uuid not null references auth.users(id)') &&
   migration.includes('organisation_id uuid not null references public.organisations(id)') &&
   migration.includes('external_portal_exact_entity') &&
   !migration.includes('contact_email=auth.email()')],
 ['External entitlement cannot self-grant and anonymous reads are denied',
   migration.includes('enable row level security') &&
   migration.includes('revoke all on public.external_portal_memberships from public,anon,authenticated') &&
   migration.includes('grant select on public.external_portal_memberships to authenticated') &&
   migration.includes("using (auth_user_id=(select auth.uid()))") &&
   !migration.includes('grant insert on public.external_portal_memberships to authenticated')],
 ['All external data retrieval uses authenticated membership and role-specific commercial output',
   migration.includes("auth.role()='authenticated'") &&
   migration.includes('m.auth_user_id=(select auth.uid())') &&
   migration.includes("m.portal_kind=p_kind") &&
   migration.includes("when m.portal_kind='client' then q.total else wo.partner_price") &&
   source.includes("supabase.rpc('portal_my_projects',{p_kind:kind})")],
 ['Password sign-in validates separate client/partner entitlement, not OP staff profile',
   signIn.includes("externalKind=next==='/portal/client'") &&
   signIn.includes("supabase.rpc('portal_my_workspaces')") &&
   signIn.indexOf("if(externalKind){")<signIn.indexOf('if (profileError || !profile)')],
 ['Client and partner project screens are actual account-filtered registers',
   dash.includes('Your project register') &&
   dash.includes('Quotation register') &&
   dash.includes("href={'/portal/'+kind+'/projects/'+p.project_id}") &&
   project.includes("if(!p)notFound()")],
 ['Secure workflow redirect validates membership before the privileged lookup',
   handoff.indexOf("supabase.rpc('portal_my_projects'") <
   handoff.indexOf('createAdminClient(url,key') &&
   handoff.includes('if(!project)return new NextResponse') &&
   handoff.includes(".eq('partner_id',project.account_id)") &&
   handoff.includes('createExecutionSessionToken(session.id)') &&
   handoff.includes("!==session.token_hash")],
 ['Client quotation token remains scoped to the issued, authorised record',
   quotation.includes("db.rpc('portal_my_quotations')") &&
   quotation.includes("if(!q)return new NextResponse") &&
   quotation.includes('createClientPortalToken(q.quote_id,q.quote_revision)')],
 ['Client and Partner dashboards show one next action without redundant status counters',
   dash.includes("orderedProjects.slice(0,3)") &&
   dash.includes("YOUR NEXT STEP") &&
   dash.includes('className={css.nextAction}') &&
   !dash.includes('className={css.dashboardSnapshot}') &&
   !dash.includes('needsAttention') &&
   dash.includes("<details") &&
   dash.includes("QA environment information")],
 ['No duplicated payment, delivery, or partner workflow business logic',
   handoff.includes("new URL('/client-portal'") &&
   handoff.includes("new URL('/execution/'") &&
   partner.includes("/api/execution/") &&
   client.includes('createStripeCheckout') &&
   !dash.includes('SUPABASE_SERVICE_ROLE_KEY')],
];
for(const [label,ok] of tests){
 assert.equal(Boolean(ok),true,label);
 console.log('PASS',label);
}
console.log(`Dedicated account portals: ${tests.length} structural and access-boundary checks passed.`);
