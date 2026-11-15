import { readFileSync } from 'node:fs';

const checks=[];
const expect=(condition,label)=>checks.push({pass:Boolean(condition),label});
const read=(path)=>readFileSync(path,'utf8');

const vercel=JSON.parse(read('vercel.json'));
const layout=read('app/layout.tsx');
const workspaceLayout=read('app/workspace/layout.tsx');
const workspacePage=read('app/workspace/page.tsx');
const context=read('lib/auth/context.ts');
const dashboard=read('lib/repositories/dashboard.ts');

expect(vercel.regions?.includes('dub1'),'Functions execute beside the Ireland database');
expect(context.includes('cache(async function requireUserContext'),'Authentication context is request-memoized');
expect(workspaceLayout.includes('getWorkspaceChromeData'),'Workspace shell uses shared request data');
expect(workspacePage.includes('getWorkspaceChromeData'),'Mission Control reuses workspace shell queues');
expect(!workspacePage.includes('getOperationalExceptions(supabase'),'Mission Control does not duplicate exception queries');
expect(!workspacePage.includes('getApprovalQueue(supabase'),'Mission Control does not duplicate approval queries');
expect((dashboard.match(/\.limit\(/g)||[]).length>=9,'Mission Control collections are bounded');
const consent=read('components/CookieConsent.tsx');
expect(layout.includes('<CookieConsent />') && consent.includes("choice === 'accepted'") && consent.includes('<Analytics />'),'Vercel Web Analytics loads only after public-page consent');
expect(consent.includes('<SpeedInsights />') && consent.includes('!isMarketing || !ready'),'Speed Insights excluded from workspace routes and gated by consent');
expect(!workspaceLayout.includes("'./mission-control-v2.css'"),'Mission Control CSS is route scoped');
expect(!workspaceLayout.includes("'./project-desktop-canonical.css'"),'Project CSS is route scoped');

let failed=0;
for(const check of checks){console.log(`${check.pass?'PASS':'FAIL'} ${check.label}`);if(!check.pass)failed+=1;}
console.log(`Workspace performance checks: ${checks.length-failed}/${checks.length} passed`);
if(failed)process.exit(1);
