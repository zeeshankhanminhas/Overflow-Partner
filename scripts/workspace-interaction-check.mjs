import fs from 'node:fs';

const checks=[];
function read(path){return fs.readFileSync(path,'utf8');}
function expect(condition,label){checks.push({label,pass:Boolean(condition)});}

const provider=read('components/workspace/WorkspaceInteractionProvider.tsx');
const popover=read('components/workspace/WorkspacePopover.tsx');
const command=read('components/workspace/CommandPalette.tsx');
const layout=read('app/workspace/layout.tsx');
const css=[
  'app/workspace/workspace-base.css',
  'app/workspace/workspace-features.css',
  'app/workspace/workspace-surfaces.css',
].map(read).join('\n');
const productContracts=read('docs/WORKSPACE_PRODUCT_CONTRACTS.md');
const recordWorkspace=read('components/workspace/RecordWorkspace.tsx');
const missionControl=read('app/workspace/page.tsx');
const templateReview=read('components/workspace/templates/TemplateReviewCentre.tsx');

expect(provider.includes('aria-labelledby={titleId}'),'Overlay has programmatic title relationship');
expect(provider.includes('restoreFocus'),'Overlay restores focus to invoking control');
expect(provider.includes("document.body.style.overflow = 'hidden'"),'Overlay prevents background scroll');
expect(provider.includes("role={toast.tone === 'error' ? 'alert' : 'status'}"),'Toast feedback has accessible live roles');
expect(popover.includes("event.key === 'Escape'"),'Popover closes with Escape');
expect(command.includes('aria-activedescendant'),'Command palette exposes active keyboard result');
expect(command.includes("event.key==='ArrowDown'"),'Command palette supports keyboard result navigation');
expect(css.includes(':focus-visible'),'Shared interaction surfaces have visible keyboard focus');
expect(css.includes('prefers-reduced-motion'),'Interaction layer respects reduced motion');
expect(css.includes('100dvh'),'Mobile work windows use viewport-safe full-screen treatment');
expect(layout.includes("import './workspace-features.css';")&&css.includes('.workspace-shell-actions'),'Shared interaction styles are mounted through the workspace feature layer');
expect(['workspace-base.css','workspace-features.css','workspace-surfaces.css'].every(file=>layout.includes("import './"+file+"';")) && (layout.match(/\.css';/g)||[]).length<=4 && layout.indexOf("import './focus-first.css';")>layout.indexOf("import './workspace-surfaces.css';"),'Shared workspace styling has no extra rescue layer; future consolidation may reduce imports');
expect(productContracts.includes('# 7. System Feedback & Accessibility Contract'),'Seven-contract product standard is present');
expect(!layout.includes('commercial-saas-ui.css'),'Legacy commercial SaaS layer is not loaded');
expect(recordWorkspace.includes('showStatus={false}')&&recordWorkspace.includes('showActionSummary={false}')&&!recordWorkspace.includes('href={primaryHref}'),'Record state summary does not repeat its status badge or next-action control');
expect(missionControl.includes('ranked.slice(1,6)')&&missionControl.includes('Up next')&&!missionControl.includes('<NextActionRail'),'Mission Control shows one priority followed by one short canonical worklist');
const case360=read('app/workspace/leads/[id]/page.tsx');
const project360=read('app/workspace/projects/[id]/page.tsx');
const projectNav=read('app/workspace/projects/[id]/layout.tsx');
const focusCss=read('app/workspace/focus-first.css');
expect(case360.includes('return <RecordWorkspace focusMode'),'Case 360 opts into simplified record presentation');
expect(project360.includes('return <RecordWorkspace focusMode'),'Project 360 opts into simplified record presentation');
expect(recordWorkspace.includes('if (focusMode)') && recordWorkspace.includes('{nextAction}') &&
       recordWorkspace.includes('{readiness}') && recordWorkspace.includes('{evidence}') &&
       recordWorkspace.includes('{stateStrip}'), 'Focus mode reuses the same governed action, readiness, evidence and state controls');
expect(recordWorkspace.includes('open={hasBlockers}') && recordWorkspace.includes('presentation?.blockers'),
       'Readiness and documents open automatically when business blockers are present');
expect(projectNav.includes('Project tools') && projectNav.includes('ProjectRealtimeRefresh') &&
       projectNav.includes('Payments') && projectNav.includes('Messages'),
       'Project tools remain accessible without persistent tabs; real-time refresh is kept');
expect(focusCss.includes('@media(max-width:680px)') && focusCss.includes(':focus-visible'),
       'Focus-first UI remains responsive with visible keyboard controls');
expect(!missionControl.includes('mobile-mission__work-grid')&&missionControl.includes('Top priority')&&missionControl.includes('Up next'),'Home remains one focused priority rather than resurrecting the old mobile dashboard contract');
expect(templateReview.includes('className="tr-email-action-preview"')&&!templateReview.includes('disabled title="Preview only'),'Email template preview presents inactive CTA art as non-interactive content');


// IA audit regression: retain authoritative routes while giving users one doorway.
const nav=read('lib/presentation/navigationContract.ts');
const sidebar=read('app/workspace/LifecycleSidebar.tsx');
const mobileNav=read('components/workspace/MobileWorkspaceNav.tsx');
const opportunities=read('app/workspace/opportunities/page.tsx');
const work=read('app/workspace/attention/page.tsx');
const more=read('app/workspace/more/page.tsx');
const acquisition=read('app/workspace/acquisition/page.tsx');
const outreachCss=read('app/outreach/outreach.module.css');
expect(nav.includes("label: 'Outreach', href: '/outreach', group: 'outreach'"),
  'Cold outreach is explicitly outside the CRM navigation contract');
expect(nav.includes("href: '/workspace/opportunities'") && nav.includes("href: '/workspace/attention'"),
  'Canonical Opportunities and My Work entrypoints are defined');
for (const key of ['approvals','enquiries','companies','contacts','quotes','payments','partners','issues','executive']) {
  const section=nav.slice(nav.indexOf('  '+key+': {'),nav.indexOf('  },',nav.indexOf('  '+key+': {')));
  expect(section.includes("placement: 'contextual'"),
    'Old permanent navigation placement retired for '+key);
}
for (const key of ['linkedinFunnel','missionControl','opportunities','projects','finance','documents']) {
  const section=nav.slice(nav.indexOf('  '+key+': {'),nav.indexOf('  },',nav.indexOf('  '+key+': {')));
  expect(section.includes("placement: 'primary'"),
    'Current primary destination remains authoritative: '+key);
}

expect(sidebar.includes("lifecycle-nav--simplified") &&
  sidebar.includes('href={n.opportunities.href}') &&
  sidebar.includes('href={n.myWork.href}') &&
  sidebar.includes('href={n.more.href}'),
  'Desktop navigation uses canonical work entrypoints and secondary More');
expect(!sidebar.includes('<NavSection title="CRM">') &&
  !sidebar.includes('<NavSection title="Commercial">') &&
  !sidebar.includes('<NavSection title="Delivery">'),
  'Desktop no longer exposes competing module groups');
expect(mobileNav.includes("href:'/workspace/opportunities'") &&
  mobileNav.includes("href:'/workspace/more'") &&
  mobileNav.includes("href:'/outreach'"),
  'Mobile uses the same primary IA with a More directory');
expect(opportunities.includes("from('prospects')") &&
  opportunities.includes("rpc('op_case_queue'") &&
  opportunities.includes("from('projects')") &&
  opportunities.includes("href:'/workspace/leads/'"),
  'Opportunities combines existing Enquiry and Case records while excluding Project-owned Cases');
expect(!opportunities.includes(".insert(") && !opportunities.includes(".update(") &&
  !opportunities.includes("CREATE TABLE"),
  'Unified Opportunities page is read-only; no duplicate CRM model');
expect(work.includes('const filtered=') && work.includes('buildMissionPriorityQueue') &&
  work.includes("item.kind===view"), 'My Work filters canonical queue without re-ranking it');
expect(more.includes("href:n.contacts.href") && more.includes("href:n.approvals.href") &&
  more.includes("href:n.partners.href") && more.includes("href:n.settings.href") &&
  more.includes("href:n.finance.href") && more.includes("href:n.documents.href"),
  'Supporting records, Finance and Documents remain discoverable from mobile More');
expect(!acquisition.includes('LinkedIn funnel') &&
  !acquisition.includes("label:'Outreach started'") &&
  acquisition.includes('href="/outreach"'),
  'Governed Acquisition no longer exposes legacy cold-Outreach controls');
expect(command.includes('title:n.opportunities.label') &&
  command.includes('title:n.finance.label') && command.includes('title:n.more.label'),
  'Command palette uses canonical destination names');
expect(focusCss.includes('op-unified-page__directory') &&
  focusCss.includes('min-height:44px') && focusCss.includes('op-mobile-nav--clear'),
  'Common readable spacing and minimum touch targets cover unified pages and mobile navigation');
expect(outreachCss.includes('color:#555b55'), 'Outreach secondary text meets improved contrast baseline');
expect(recordWorkspace.includes('op-focus__stage'), 'Case and Project 360 expose current position above next action');


// Enforce supersession of overlapping historical presentation contracts.
// These checks are UI/IA-only and never weaken business, RLS, audit, quote
// acceptance, advance-payment or partner-work-order gate assertions.
const operatorContract=read('docs/OPOS_OPERATOR_EXPERIENCE_CONTRACT.md');
const navigationContract=read('docs/PRIMARY_NAV_PRODUCT_CONTRACT.md');
const visualContract=read('docs/VISUAL_FOUNDATION_SPECIFICATION.md');
const languageContract=read('docs/UI_LANGUAGE_CONSTITUTION.md');
const interactionsContract=read('docs/WORKSPACE_INTERACTION_ARCHITECTURE.md');
const legacyArchitecture=read('docs/OVERFLOW_PARTNER_PRODUCT_ARCHITECTURE.md');
const opdsContract=read('docs/OPDS.md');
expect(operatorContract.includes('Status: ACTIVE') &&
  operatorContract.includes('OPOS_COMMERCIAL_LIFECYCLE_CONTRACT.md') &&
  operatorContract.includes('RPC_SECURITY_CONTRACT.md'),
  'One active operator contract preserves commercial and security authorities');
expect(operatorContract.includes('**Desktop:** Outreach · Home · Opportunities · Projects · Finance · Documents') &&
  operatorContract.includes('**Mobile:** Outreach · Home · Opportunities · Projects · More'),
  'Operator contract owns current desktop and mobile destinations');
expect(navigationContract.includes('old Home / Operate / Control / Reference rail') &&
  navigationContract.includes('**retired**'),
  'Prior permanent-navigation model is explicitly retired');
expect(visualContract.includes('**44px**') &&
  visualContract.includes('14–16px') &&
  visualContract.includes('Old mandatory 32/36/40px interactive control targets are retired'),
  'Older tiny UI and narrow tap-target mandates cannot supersede accessibility');
expect(productContracts.includes('not a compulsory extra hop') &&
  interactionsContract.includes('never require two clicks'),
  'Old mandatory Inspect-first double-action pattern is retired');
expect(languageContract.includes('**Outreach, Home, Opportunities, Projects, Finance, Documents**'),
  'UI language uses current IA rather than the old route vocabulary');
expect(legacyArchitecture.includes('Status: ARCHITECTURE HISTORY') &&
  opdsContract.includes('OPOS Operator Experience Contract'),
  'Historical architecture and OPDS geometry cannot override current workspace UI');
expect(!layout.includes('interaction-surfaces.css') &&
  (layout.match(/\.css';/g)||[]).length<=4,
  'Retired interaction stylesheet cannot creep back as an added global layer');

let failed=0;
for(const check of checks){
  console.log(`${check.pass?'PASS':'FAIL'} ${check.label}`);
  if(!check.pass)failed+=1;
}
console.log(`Workspace interaction checks: ${checks.length-failed}/${checks.length} passed`);
if(failed)process.exit(1);
