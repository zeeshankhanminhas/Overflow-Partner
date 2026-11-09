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
expect((layout.match(/\.css';/g)||[]).length===5 && layout.indexOf("import './focus-first.css';")>layout.indexOf("import './workspace-surfaces.css';") && layout.indexOf("import './opos-dark-system.css';")>layout.indexOf("import './focus-first.css';"),'Focus layer loads after the three shared workspace stylesheets');
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

let failed=0;
for(const check of checks){
  console.log(`${check.pass?'PASS':'FAIL'} ${check.label}`);
  if(!check.pass)failed+=1;
}
console.log(`Workspace interaction checks: ${checks.length-failed}/${checks.length} passed`);
if(failed)process.exit(1);
