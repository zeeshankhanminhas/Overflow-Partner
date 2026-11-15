import Link from 'next/link';
import { primaryNavigation as n } from '@/lib/presentation/navigationContract';

const sections=[
  {title:'Workspaces',items:[
    {label:'Finance',href:n.finance.href,detail:'Client receivables and partner payments'},
    {label:'Documents',href:n.documents.href,detail:'Controlled documents and templates'},
  ]},
  {title:'My Work',items:[
    {label:'All priorities',href:n.myWork.href,detail:'Decisions, issues and dependencies together'},
    {label:'Approvals',href:n.approvals.href,detail:'Authority decisions'},
    {label:'Tasks',href:n.actions.href,detail:'Assigned internal actions'},
    {label:'Issues',href:n.issues.href,detail:'Operational exceptions'},
  ]},
  {title:'Relationships',items:[
    {label:'Companies',href:n.companies.href,detail:'Client and partner company records'},
    {label:'People',href:n.contacts.href,detail:'Governed contact master records'},
    {label:'Delivery Partners',href:n.partners.href,detail:'Capacity and partner credentials'},
  ]},
  {title:'Commercial & operations',items:[
    {label:'Client Quotes',href:n.quotes.href,detail:'Quotation register'},
    {label:'Commercial controls',href:n.commercialControl.href,detail:'Project financial release'},
    {label:'Delivery reviews',href:n.assessments.href,detail:'Partner feasibility evidence'},
    {label:'Messages',href:n.messages.href,detail:'Business correspondence'},
  ]},
  {title:'Management & system',items:[
    {label:'Management',href:n.executive.href,detail:'Operating and financial reporting'},
    {label:'Risk & Compliance',href:n.risk.href,detail:'Assurance and controls'},
    {label:'Activity',href:'/workspace/activity',detail:'Record events'},
    {label:'Settings',href:n.settings.href,detail:'Workspace configuration'},
  ]},
];
export default function MorePage(){
  return <section className="op-unified-page">
    <header className="op-unified-page__top">
      <div><p className="op-unified-page__eyebrow">OPOS / DIRECTORY</p>
        <h1>More</h1>
        <p>Supporting registers and administration. Your primary work remains in Home, Opportunities and Projects.</p>
      </div>
    </header>
    <div className="op-unified-page__directory">
      {sections.map(group=><section key={group.title}>
        <h2>{group.title}</h2><ul>{group.items.map(item=><li key={item.href}><Link href={item.href}>
          <span><strong>{item.label}</strong><small>{item.detail}</small></span>
          <span aria-hidden="true">↗</span>
        </Link></li>)}</ul>
      </section>)}
    </div>
  </section>;
}
