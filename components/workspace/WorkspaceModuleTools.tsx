'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WorkspacePopover } from '@/components/workspace/WorkspacePopover';
import { useWorkspaceInteractions } from '@/components/workspace/WorkspaceInteractionProvider';

type RelatedLink = { label: string; href: string };
type ModuleConfig = {
  label: string;
  eyebrow: string;
  purpose: string;
  rule: string;
  related: RelatedLink[];
};

const modules: Array<[RegExp, ModuleConfig]> = [
  [/^\/workspace\/acquisition/, { label:'Enquiries', eyebrow:'Acquisition', purpose:'Qualify incoming opportunities before a governed Case exists.', rule:'Keep enquiry qualification separate from Case and Project ownership.', related:[{label:'Cases',href:'/workspace/leads'},{label:'Partner assessments',href:'/workspace/assessments'}] }],
  [/^\/workspace\/approvals/, { label:'Approvals', eyebrow:'Authority', purpose:'Review decisions that are ready for explicit authority.', rule:'Approval queues never become a second workflow; the owning record remains authoritative.', related:[{label:'Mission Control',href:'/workspace'},{label:'Cases',href:'/workspace/leads'}] }],
  [/^\/workspace\/leads/, { label:'Cases', eyebrow:'Pre-project control', purpose:'Control technical and commercial basis before Project creation.', rule:'A Case remains pre-project until quote acceptance and payment/mobilisation gates are satisfied.', related:[{label:'Approvals',href:'/workspace/approvals'},{label:'Quotes',href:'/workspace/quotes'}] }],
  [/^\/workspace\/projects/, { label:'Projects', eyebrow:'Delivery control', purpose:'Operate accepted work through governed delivery and closeout.', rule:'Project 360 owns delivery after commercial handoff; do not recreate pre-project Case logic here.', related:[{label:'Payments',href:'/workspace/payments'},{label:'Documents',href:'/workspace/documents'}] }],
  [/^\/workspace\/partners/, { label:'Execution Partners', eyebrow:'Partner network', purpose:'Inspect capability, readiness and controlled partner master data.', rule:'Partner master data is shared context; assignment and pricing decisions belong to the owning workflow.', related:[{label:'Assessments',href:'/workspace/assessments'},{label:'Commercial control',href:'/workspace/commercial-control'}] }],
  [/^\/workspace\/quotes/, { label:'Client quotes', eyebrow:'Commercial', purpose:'Control client quotation preparation, issue and outcome.', rule:'Issued quote state must remain evidence-backed and linked to the Case commercial position.', related:[{label:'Cases',href:'/workspace/leads'},{label:'Payments',href:'/workspace/payments'}] }],
  [/^\/workspace\/payments/, { label:'Payments', eyebrow:'Finance', purpose:'Track receivables, partner liabilities and settlement evidence.', rule:'Settlement actions change financial state and require explicit evidence; routine inspection should stay in context.', related:[{label:'Commercial control',href:'/workspace/commercial-control'},{label:'Approvals',href:'/workspace/approvals'}] }],
  [/^\/workspace\/commercial-control/, { label:'Commercial control', eyebrow:'Finance', purpose:'Control project commercial position and mobilisation authority.', rule:'Commercial decisions must remain traceable to governed costs, approvals and payment evidence.', related:[{label:'Payments',href:'/workspace/payments'},{label:'Projects',href:'/workspace/projects'}] }],
  [/^\/workspace\/documents/, { label:'Documents', eyebrow:'Document control', purpose:'Find, review and control governed publications.', rule:'The document registry is a controlled index; document work should stay linked to its owning workflow.', related:[{label:'Projects',href:'/workspace/projects'},{label:'Cases',href:'/workspace/leads'}] }],
  [/^\/workspace\/exceptions/, { label:'Issues', eyebrow:'Operations', purpose:'Resolve genuinely off-plan operational exceptions.', rule:'Only exceptions belong here; normal waiting states and routine workflow should stay on their owning records.', related:[{label:'Mission Control',href:'/workspace'},{label:'Actions',href:'/workspace/tasks'}] }],
  [/^\/workspace\/tasks/, { label:'Actions', eyebrow:'Operations', purpose:'Complete assigned internal work items.', rule:'Tasks support the workflow; they do not replace the authoritative Case, Project, document or financial record.', related:[{label:'Issues',href:'/workspace/exceptions'},{label:'Mission Control',href:'/workspace'}] }],
  [/^\/workspace\/communications/, { label:'Messages', eyebrow:'Operations', purpose:'Review governed business correspondence and delivery status.', rule:'Messages are evidence and communication outputs, not a parallel customer workflow.', related:[{label:'Notifications',href:'/workspace/notifications'},{label:'Cases',href:'/workspace/leads'}] }],
  [/^\/workspace\/intelligence/, { label:'Executive view', eyebrow:'Intelligence', purpose:'Review business performance and management signals.', rule:'Management views summarise authoritative operational data; drill through before taking governed action.', related:[{label:'Risk & compliance',href:'/workspace/risk'},{label:'Mission Control',href:'/workspace'}] }],
  [/^\/workspace\/risk/, { label:'Risk & compliance', eyebrow:'Intelligence', purpose:'Review risk, assurance and compliance posture.', rule:'Risk views surface assurance needs but do not duplicate operational records.', related:[{label:'Executive view',href:'/workspace/intelligence'},{label:'Issues',href:'/workspace/exceptions'}] }],
  [/^\/workspace\/knowledge/, { label:'Knowledge', eyebrow:'Reference', purpose:'Access governed operating knowledge and reference material.', rule:'Knowledge supports decisions but never overrides live workflow state.', related:[{label:'Search',href:'/workspace/search'},{label:'Mission Control',href:'/workspace'}] }],
  [/^\/workspace\/settings/, { label:'Settings', eyebrow:'Administration', purpose:'Configure controlled workspace settings.', rule:'Administrative configuration should be explicit, bounded and confirmed when consequential.', related:[{label:'Mission Control',href:'/workspace'},{label:'Notifications',href:'/workspace/notifications'}] }],
  [/^\/workspace$/, { label:'Mission Control', eyebrow:'Operations', purpose:'See the current operating position and choose the next intervention.', rule:'Mission Control summarises; authoritative work remains on the owning record.', related:[{label:'Approvals',href:'/workspace/approvals'},{label:'Issues',href:'/workspace/exceptions'}] }],
];

function resolveModule(pathname: string): ModuleConfig {
  return modules.find(([pattern]) => pattern.test(pathname))?.[1] ?? {
    label:'Workspace', eyebrow:'Operations', purpose:'Operate governed Overflow Partner work.', rule:'Stay on the authoritative record and use contextual surfaces for inspection and bounded actions.', related:[{label:'Mission Control',href:'/workspace'},{label:'Search',href:'/workspace/search'}],
  };
}

function resolveRecordLinks(pathname: string): RelatedLink[] {
  const caseMatch = pathname.match(/^\/workspace\/leads\/([^/]+)/);
  if (caseMatch) {
    const id = caseMatch[1];
    return [
      { label:'Case 360', href:`/workspace/leads/${id}` },
      { label:'Case documents', href:`/workspace/documents?lead=${id}` },
      { label:'Approvals', href:'/workspace/approvals' },
      { label:'Client quotes', href:'/workspace/quotes' },
    ];
  }

  const projectMatch = pathname.match(/^\/workspace\/projects\/([^/]+)/);
  if (projectMatch) {
    const id = projectMatch[1];
    return [
      { label:'Project 360', href:`/workspace/projects/${id}` },
      { label:'Delivery control', href:`/workspace/projects/${id}/delivery` },
      { label:'Project documents', href:`/workspace/documents?project=${id}` },
      { label:'Project finance', href:`/workspace/payments?project=${id}` },
      { label:'Issues', href:'/workspace/exceptions' },
    ];
  }

  const companyMatch = pathname.match(/^\/workspace\/companies\/([^/]+)/);
  if (companyMatch) {
    const id = companyMatch[1];
    return [
      { label:'Company 360', href:`/workspace/companies/${id}` },
      { label:'Contacts', href:'/workspace/contacts' },
      { label:'Cases', href:'/workspace/leads' },
      { label:'Projects', href:'/workspace/projects' },
    ];
  }

  return [];
}

export default function WorkspaceModuleTools() {
  const pathname = usePathname();
  const moduleConfig = resolveModule(pathname);
  const recordLinks = resolveRecordLinks(pathname);
  const { openDrawer, openModal, closeSurface } = useWorkspaceInteractions();

  const links = <div className="workspace-module-links">{moduleConfig.related.map(item => <Link key={item.href} href={item.href} onClick={closeSurface}>{item.label}<span>→</span></Link>)}</div>;
  const recordContext = recordLinks.length ? <div className="workspace-module-record"><small>Current record</small><div className="workspace-module-record__links">{recordLinks.map(item => <Link key={item.href} href={item.href} onClick={closeSurface}>{item.label}<span>→</span></Link>)}</div></div> : null;

  return <div className="workspace-module-tools" aria-label={`${moduleConfig.label} tools`}>
    <button type="button" className="workspace-module-tool" onClick={() => openDrawer({
      eyebrow: moduleConfig.eyebrow,
      title: `${moduleConfig.label} context`,
      description: moduleConfig.purpose,
      content: <div className="workspace-module-context"><div className="workspace-module-rule"><small>Operating rule</small><strong>{moduleConfig.rule}</strong></div>{recordContext}<div><small className="workspace-module-section-label">Related work</small>{links}</div></div>,
    })}>Context</button>

    <WorkspacePopover label="Module actions" trigger={<span>Actions ···</span>}>
      <button type="button" onClick={() => openModal({
        eyebrow: moduleConfig.eyebrow,
        title: `${moduleConfig.label} operating rule`,
        description: 'Use this check before a consequential action or when the current screen feels ambiguous.',
        content: <div className="workspace-module-rule workspace-module-rule--modal"><small>Authority boundary</small><strong>{moduleConfig.rule}</strong><p>{moduleConfig.purpose}</p></div>,
        footer: <button type="button" className="button" onClick={closeSurface}>Understood</button>,
      })}>Review operating rule</button>
      {recordLinks.map(item => <Link key={`record-${item.href}`} href={item.href}>{item.label}</Link>)}
      {moduleConfig.related.map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}
    </WorkspacePopover>
  </div>;
}
