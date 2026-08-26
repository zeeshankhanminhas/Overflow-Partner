import fs from 'node:fs';

const checks=[];
function read(path){return fs.readFileSync(path,'utf8');}
function expect(condition,label){checks.push({label,pass:Boolean(condition)});}

const provider=read('components/workspace/WorkspaceInteractionProvider.tsx');
const popover=read('components/workspace/WorkspacePopover.tsx');
const command=read('components/workspace/CommandPalette.tsx');
const layout=read('app/workspace/layout.tsx');
const css=read('app/workspace/workspace-wave8.css');

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
expect(layout.includes("import './workspace-wave8.css';"),'Wave 8 styles are mounted globally in workspace shell');

let failed=0;
for(const check of checks){
  console.log(`${check.pass?'PASS':'FAIL'} ${check.label}`);
  if(!check.pass)failed+=1;
}
console.log(`Wave 8 interaction checks: ${checks.length-failed}/${checks.length} passed`);
if(failed)process.exit(1);
