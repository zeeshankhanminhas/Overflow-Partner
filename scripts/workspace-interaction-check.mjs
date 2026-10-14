import fs from 'node:fs';

const checks=[];
function read(path){return fs.readFileSync(path,'utf8');}
function expect(condition,label){checks.push({label,pass:Boolean(condition)});}

const provider=read('components/workspace/WorkspaceInteractionProvider.tsx');
const popover=read('components/workspace/WorkspacePopover.tsx');
const command=read('components/workspace/CommandPalette.tsx');
const layout=read('app/workspace/layout.tsx');
const css=read('app/workspace/workspace-interaction-system.css');
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
expect(layout.includes("import './workspace-interaction-system.css';"),'Canonical interaction styles are mounted globally in workspace shell');
expect(productContracts.includes('# 7. System Feedback & Accessibility Contract'),'Seven-contract product standard is present');
expect(!layout.includes('commercial-saas-ui.css'),'Legacy commercial SaaS layer is not loaded');
expect(recordWorkspace.includes('showStatus={false}')&&recordWorkspace.includes('showActionSummary={false}')&&!recordWorkspace.includes('href={primaryHref}'),'Record state summary does not repeat its status badge or next-action control');
expect(missionControl.includes('priorityQueue.slice(1,6)')&&missionControl.includes('title="Other open work"')&&!missionControl.includes('<NextActionRail'),'Mission Control lists work once after its current priority');
expect(!mobileMissionControl.includes('mobile-mission__work-grid')&&mobileMissionControl.includes('<h2>Other open work</h2>'),'Mobile Mission Control avoids a second set of overlapping work-count cards');
expect(templateReview.includes('className="tr-email-action-preview"')&&!templateReview.includes('disabled title="Preview only'),'Email template preview presents inactive CTA art as non-interactive content');

let failed=0;
for(const check of checks){
  console.log(`${check.pass?'PASS':'FAIL'} ${check.label}`);
  if(!check.pass)failed+=1;
}
console.log(`Workspace interaction checks: ${checks.length-failed}/${checks.length} passed`);
if(failed)process.exit(1);
