// Disposable Supabase fixture. Always isolated and synthetic; NEVER remote keys.
import {createClient} from '@supabase/supabase-js';
import {spawnSync} from 'node:child_process';
if(process.env.OP_ISOLATED_QA_BACKEND!=='true' ||
   process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:54321' ||
   !process.env.SUPABASE_SERVICE_ROLE_KEY ||
   process.env.OP_PAID_EXTERNAL_PORTALS_ENABLED!=='true'){
 throw Error('Browser fixture requires disposable local Supabase only.');
}
const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
 auth:{persistSession:false,autoRefreshToken:false}
});
const password='isolated-qa-Browser-2026!';
const identities={
 controller:'controller.qa@example.invalid',
 client:'client.qa@example.invalid',
 unpaid:'unpaid.qa@example.invalid',
 partner:'partner.qa@example.invalid'
};
const users={};
for(const [role,email] of Object.entries(identities)){
 const {data,error}=await supabase.auth.admin.createUser({email,password,email_confirm:true});
 if(error||!data?.user?.id)throw Error('Local synthetic auth user creation failed: '+role);
 users[role]=data.user.id;
}
const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
if(Object.values(users).some(id=>!isUuid(id)))throw Error('Synthetic identity is invalid');
const parts=[
 "begin;",
 "insert into public.organisations(id,name) values ('__ORG__','OPOS isolated visual CI');",
 "insert into public.profiles(id,organisation_id,role,full_name,is_active) values ('__CONTROLLER__','__ORG__','operator','Synthetic Controller',true);",
 "insert into public.companies(id,organisation_id,name,created_by) values ('__COMPANY_PAID__','__ORG__','QA Browser Paid Client','__CONTROLLER__'), ('__COMPANY_UNPAID__','__ORG__','QA Browser Unpaid Client','__CONTROLLER__');",
 "insert into public.leads(id,organisation_id,created_by,company_name,company_id) values ('__LEAD_PAID__','__ORG__','__CONTROLLER__','QA Browser Paid Client','__COMPANY_PAID__'), ('__LEAD_UNPAID__','__ORG__','__CONTROLLER__','QA Browser Unpaid Client','__COMPANY_UNPAID__'), ('__LEAD_ARCHIVED__','__ORG__','__CONTROLLER__','QA Browser Paid Client','__COMPANY_PAID__');",
 "insert into public.quotes(id,organisation_id,lead_id,created_by,quote_number,total) values ('__QUOTE_PAID__','__ORG__','__LEAD_PAID__','__CONTROLLER__','OP-QA-BROWSER-PAID',720), ('__QUOTE_UNPAID__','__ORG__','__LEAD_UNPAID__','__CONTROLLER__','OP-QA-BROWSER-UNPAID',480), ('__QUOTE_ARCHIVED__','__ORG__','__LEAD_ARCHIVED__','__CONTROLLER__','OP-QA-BROWSER-CLOSED',360);",
 "alter table public.projects disable trigger user;",
 "insert into public.projects(id,organisation_id,lead_id,quote_id,created_by,project_number,title,project_stage) values ('__PROJECT_PAID__','__ORG__','__LEAD_PAID__','__QUOTE_PAID__','__CONTROLLER__','OP-QA-BROWSER-01','Synthetic Paid Engineering Project','mobilisation'), ('__PROJECT_UNPAID__','__ORG__','__LEAD_UNPAID__','__QUOTE_UNPAID__','__CONTROLLER__','OP-QA-BROWSER-02','Synthetic Unpaid Engineering Project','mobilisation'), ('__PROJECT_ARCHIVED__','__ORG__','__LEAD_ARCHIVED__','__QUOTE_ARCHIVED__','__CONTROLLER__','OP-QA-BROWSER-03','Synthetic Closed Engineering Project','closed');",
 "alter table public.projects enable trigger user;",
 "insert into public.quote_payment_confirmations(organisation_id,quote_id,lead_id,amount,currency,payment_method,payment_reference,confirmed_at,recorded_by) values ('__ORG__','__QUOTE_PAID__','__LEAD_PAID__',216,'GBP','bank_transfer','SYNTHETIC-CI-RECEIPT',now(),'__CONTROLLER__'), ('__ORG__','__QUOTE_ARCHIVED__','__LEAD_ARCHIVED__',108,'GBP','bank_transfer','SYNTHETIC-CI-CLOSED',now(),'__CONTROLLER__');",
 "insert into public.partners(id,organisation_id,company_name,status) values ('__PARTNER__','__ORG__','QA Browser Execution Partner','approved');",
 "insert into public.external_portal_memberships(organisation_id,auth_user_id,portal_kind,company_id,is_active) values ('__ORG__','__CLIENT__','client','__COMPANY_PAID__',true), ('__ORG__','__UNPAID__','client','__COMPANY_UNPAID__',true);",
 "insert into public.external_portal_memberships(organisation_id,auth_user_id,portal_kind,partner_id,is_active) values ('__ORG__','__PARTNER_USER__','partner','__PARTNER__',true);",
 "commit;"
];
const values={
 __ORG__:'00000000-0000-4000-8000-000000007100',
 __COMPANY_PAID__:'00000000-0000-4000-8000-000000007101',
 __COMPANY_UNPAID__:'00000000-0000-4000-8000-000000007102',
 __LEAD_PAID__:'00000000-0000-4000-8000-000000007103',
 __LEAD_UNPAID__:'00000000-0000-4000-8000-000000007104',
 __QUOTE_PAID__:'00000000-0000-4000-8000-000000007105',
 __QUOTE_UNPAID__:'00000000-0000-4000-8000-000000007106',
 __PROJECT_PAID__:'00000000-0000-4000-8000-000000007107',
 __PROJECT_UNPAID__:'00000000-0000-4000-8000-000000007108',
 __PARTNER__:'00000000-0000-4000-8000-000000007109',
 __LEAD_ARCHIVED__:'00000000-0000-4000-8000-000000007110',
 __QUOTE_ARCHIVED__:'00000000-0000-4000-8000-000000007111',
 __PROJECT_ARCHIVED__:'00000000-0000-4000-8000-000000007112',
 __CONTROLLER__:users.controller,
 __CLIENT__:users.client,
 __UNPAID__:users.unpaid,
 __PARTNER_USER__:users.partner
};
let sql=parts.join('\n');
for(const [name,value] of Object.entries(values))sql=sql.replaceAll(name,value);
if(/__[A-Z_]+__/.test(sql))throw Error('Unresolved synthetic fixture token');
const result=spawnSync('docker',['exec','-i','supabase_db_opos_ephemeral_ci','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:90000});
if(result.status!==0)throw Error('Local fixture SQL failed: '+String(result.stderr).slice(-1300));
console.log('Isolated Controller, paid Client, unpaid Client and Partner fixtures created.');
