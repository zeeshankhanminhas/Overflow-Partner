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
const mobileMissionControl=read('components/workspace/MobileMissionControl.tsx');
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
expect((layout.match(/\.css';/g)||[]).length===5 && layout.indexOf("import './opos-dark-system.css';")>layout.indexOf("import './focus-first.css';"),'Focus layer loads after the three shared workspace stylesheets');
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
expect(!mobileMissionControl.includes('mobile-mission__work-grid')&&mobileMissionControl.includes('<h2>Other open work</h2>'),'Mobile Mission Control avoids a second set of overlapping work-count cards');
expect(templateReview.includes('className="tr-email-action-preview"')&&!templateReview.includes('disabled title="Preview only'),'Email template preview presents inactive CTA art as non-interactive content');


// Controller navigation release gates: role-neutral presentation only.
// No payments, project creation or server-side business lifecycle transitions.
const controllerNav=read('lib/presentation/navigationContract.ts');
const controllerSidebar=read('app/workspace/LifecycleSidebar.tsx');
const controllerMobile=read('components/workspace/MobileWorkspaceNav.tsx');
const controllerOpportunities=read('app/workspace/opportunities/page.tsx');
const controllerMore=read('app/workspace/more/page.tsx');
const controllerAttention=read('app/workspace/attention/page.tsx');
const controllerLayout=read('app/workspace/layout.tsx');
for (const name of ['linkedinFunnel','missionControl','opportunities','projects','finance','documents']) {
  const section=controllerNav.slice(controllerNav.indexOf('  '+name+': {'),controllerNav.indexOf('  },',controllerNav.indexOf('  '+name+': {')));
  expect(section.includes("placement: 'primary'"), 'Controller primary navigation includes '+name);
}
expect(controllerSidebar.includes('lifecycle-nav--simplified') &&
  controllerSidebar.includes('href={n.opportunities.href}') &&
  controllerSidebar.includes('href={n.finance.href}') &&
  controllerSidebar.includes('href={n.more.href}'),
  'Desktop uses six main destinations and supporting More');
expect(controllerSidebar.includes("aria-current={opportunitiesActive?'page':undefined}") &&
  controllerSidebar.includes("aria-current={financeActive?'page':undefined}"),
  'Desktop indicates active navigation to assistive technology');
expect(controllerMobile.includes("href:'/workspace/opportunities'") &&
  controllerMobile.includes("href:'/workspace/more'") &&
  controllerMobile.includes("href:'/outreach'"),
  'Mobile five-tab navigation matches simplified IA');
expect(['/workspace/attention','/workspace/tasks','/workspace/exceptions',
  '/workspace/commercial-control','/workspace/communications',
  '/workspace/partners','/workspace/intelligence','/workspace/risk']
  .every(route=>controllerMobile.includes("'"+route+"'")),
  'Mobile More active state includes supporting routes');
expect(controllerOpportunities.includes("from('prospects')") &&
  controllerOpportunities.includes("rpc('op_case_queue'") &&
  controllerOpportunities.includes("from('projects')") &&
  !controllerOpportunities.includes('.insert(') &&
  !controllerOpportunities.includes('.update('),
  'Unified Opportunities is read-only over governed existing records');
expect(controllerMore.includes('href:n.contacts.href') &&
  controllerMore.includes('href:n.partners.href') &&
  controllerMore.includes('href:n.finance.href'),
  'More retains access to contextual registers');
expect(controllerAttention.includes('buildMissionPriorityQueue') &&
  controllerAttention.includes('const filtered=') &&
  controllerAttention.includes('item.kind===view'),
  'My Work filters existing priority order without changing authority');
expect(controllerLayout.includes('<MobileWorkspaceNav />') &&
  command.includes('title:n.opportunities.label') &&
  command.includes('title:n.finance.label') &&
  command.includes('title:n.more.label'),
  'Workspace shell and command palette use the same destinations');
expect(focusCss.includes('op-unified-page__directory') &&
  focusCss.includes('op-mobile-nav--clear'),
  'Unified pages and mobile navigation have styles');

const dark=read('app/workspace/opos-dark-system.css');
const baseDark=read('app/workspace/workspace-base.css');
const mobileDark=read('app/workspace/workspace-surfaces.css');
const signInDark=read('app/login/page.tsx');
const outreachDark=read('app/outreach/outreach.module.css');
const clientDark=read('app/client-portal/page.tsx');
expect(dark.includes('color-scheme: dark') && dark.includes('--op-bg:#08090a'),'Dark theme uses canonical black canvas');
expect(baseDark.includes('--op-sidebar:#0c0d0e') && baseDark.includes('--op-panel:#111214'),'Desktop shell defaults are dark');
expect(mobileDark.includes('--m-bg:#08090a') && mobileDark.includes('--m-surface:#111214'),'Mobile shell defaults are dark');
expect(signInDark.includes('bg-[#08090a]')&&!signInDark.includes('bg-white'),'OPOS Sign In does not show light surfaces');
expect(outreachDark.includes('background:#08090a')&&outreachDark.includes('color-scheme:dark'),'Outreach remains dark outside CRM');
expect(clientDark.includes("background:'#08090a'"),'Client portal uses dark canvas');


const secureCSS=read('app/globals.css');
const securePartner=read('app/partner-review/[token]/page.tsx');
const secureIntake=read('app/intake/[token]/page.tsx');
const secureExecution=read('components/execution/PartnerWorkSurface.tsx');
expect(secureCSS.includes('main.op-secure-dark')&&secureCSS.includes('color-scheme:dark'),
  'Secure product journeys inherit the dark palette');
for(const [source,name] of [[securePartner,'Partner review'],[secureIntake,'Technical intake'],[secureExecution,'Partner execution']]){
  expect(source.includes('op-secure-dark')&&!source.includes('bg-[#f5f4ef]')&&!source.includes('bg-white/50'),
    name+' uses dark product surfaces');
}


const visualSpec=read('docs/VISUAL_FOUNDATION_SPECIFICATION.md');
const journalStyles=read('app/workspace/acquisition/LinkedInFlow.module.css');
expect(visualSpec.includes('Current OPOS monochrome foundation') &&
  !visualSpec.includes('background: white'),'Visual contract no longer mandates white panels');
expect(!journalStyles.includes('background:#fff;color:var(--op-ink'),
  'Outreach conversation textarea has no old white surface');


/* Full Workspace 2.0 dark-theme regression coverage.
   White is intentionally retained ONLY inside printable/document preview content. */
const missionVisual=read('app/workspace/mission-control-v2.css');
const projectDesktopVisual=read('app/workspace/project-desktop-canonical.css');
const projectMobileVisual=read('app/workspace/project-mobile-reference.css');
const registerVisual=read('app/workspace/document-register-canonical.css');
const templateVisual=read('app/workspace/template-review/template-review.css');
const acquisitionVisual=read('app/workspace/acquisition-layout.css');
expect(!/background:#(?:fff|fafaf7)\b/.test(missionVisual),
  'Mission Control panels and metrics no longer restore light cards');
expect(projectDesktopVisual.includes('--pd-bg: #08090a') &&
       projectDesktopVisual.includes('--pd-surface: #111214') &&
       !projectDesktopVisual.includes('--pd-text: #171717'),
  'Desktop Project 360 inherits the dark page, panels and readable text');
expect(projectMobileVisual.includes('--op-mobile-bg: #08090a') &&
       projectMobileVisual.includes('--op-mobile-surface: #111214') &&
       !projectMobileVisual.includes('background: rgba(255,255,255,.97)'),
  'Mobile Project 360 header, dock and cards use dark surfaces');
expect(!registerVisual.includes('background:#fff') &&
       !registerVisual.includes('background:rgba(255,255,255,.97)'),
  'Document register chrome and popovers are dark, not the documents');
expect(templateVisual.includes('background: #fff;') &&
       templateVisual.includes('color: #1b251e;') &&
       templateVisual.includes('.tr-template-list > button{color:var(--op-text);}') &&
       templateVisual.includes('.tr-document-card,.tr-email-layout,.tr-template-meta{color:var(--op-text);}'),
  'Only the email/document preview remains white in template review');
expect(dark.includes('.opds-document,.document-a4-preview,.midts-document-page,.tr-email-frame') &&
       dark.includes('--opds-ink:#111815;') && dark.includes('color-scheme:light;'),
  'White document sheets keep dark ink without making their surrounding UI light');
expect(!acquisitionVisual.includes('background:#f7f7f3'),
  'Acquisition duplicate confirmation does not restore a light panel');
expect(css.includes('.workspace-overlay{color-scheme:dark;') &&
       css.includes('--op-text:#f3f3f4;--op-muted:#b6b9bf;') &&
       css.includes('background:#e5e7eb;color:#101113;'),
  'Portal-mounted dialogs, popovers and actions have explicit dark-theme contrast');


let failed=0;
for(const check of checks){
  console.log(`${check.pass?'PASS':'FAIL'} ${check.label}`);
  if(!check.pass)failed+=1;
}
console.log(`Workspace interaction checks: ${checks.length-failed}/${checks.length} passed`);
if(failed)process.exit(1);
