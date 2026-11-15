'use client';

import {useState} from 'react';
import {OverflowPartnerMark} from '@/components/brand/OverflowPartnerBrand';
import {
  assuranceIdentity,capabilityServices,capabilitySteps,capabilityControls,capabilityRecords,
  handoverIndex,drawingRegister,sampleBOM,sampleReview,releaseChecklist,templateSafetyNote
} from '@/lib/assurance-template-data';

type TemplateKind = 'capability' | 'handover';

const pdfLinks: Record<TemplateKind,string> = {
  capability:'/api/public/capability-statement',
  handover:'/api/public/sample-handover',
};

function DocumentHeading({series,reference,page,total}:{series:string;reference:string;page:number;total:number}) {
  return <header className="op-doc-header">
    <div className="op-doc-ident">
      <OverflowPartnerMark className="op-doc-logo" />
      <div className="op-doc-wordmark"><strong>OVERFLOW</strong><span>PARTNER</span></div>
    </div>
    <div className="op-doc-meta">
      <span>{series}</span>
      <strong>{reference}</strong>
      <span>PAGE {String(page).padStart(2,'0')} / {String(total).padStart(2,'0')}</span>
    </div>
  </header>;
}
function DocumentFooter({reference,page,total}:{reference:string;page:number;total:number}) {
  return <footer className="op-doc-footer">
    <span>{assuranceIdentity.positioning}</span>
    <span>{reference} · {page} / {total}</span>
    <span>{assuranceIdentity.site}</span>
  </footer>;
}
function Sheet({children,series,reference,page,total}:{children:React.ReactNode;series:string;reference:string;page:number;total:number}) {
  return <section className="op-doc-sheet" aria-label={`${series}, page ${page} of ${total}`}>
    <div className="op-doc-sheet-inner">
      <DocumentHeading series={series} reference={reference} page={page} total={total}/>
      <div className="op-doc-content">{children}</div>
      <DocumentFooter reference={reference} page={page} total={total}/>
    </div>
  </section>;
}
function Eyebrow({children}:{children:React.ReactNode}) {
  return <p className="op-doc-eyebrow">{children}</p>;
}
function StatementPages() {
  return <>
    <Sheet series="ENGINEERING CAPABILITY STATEMENT" reference="OP-CAP-001 / R00" page={1} total={2}>
      <div className="op-doc-hero">
        <Eyebrow>ENGINEERING EXECUTION CAPACITY</Eyebrow>
        <h2>Engineering support.<br/><span>Organised around your team.</span></h2>
        <p>Additional engineering execution capacity for defined design, CAD, drawing and documentation work packages—with clear scope, review responsibilities and controlled handover.</p>
      </div>
      <div className="op-doc-section-head"><Eyebrow>01 / OUR CAPABILITIES</Eyebrow><span>Defined work packages</span></div>
      <div className="op-doc-services">
        {capabilityServices.map((s,i)=><div key={s.name} className="op-doc-service">
          <span className="op-doc-number">{String(i+1).padStart(2,'0')}</span>
          <h3>{s.name}</h3><p>{s.detail}</p>
        </div>)}
      </div>
      <div className="op-doc-section-head"><Eyebrow>02 / ENGAGEMENT STRUCTURE</Eyebrow><span>From enquiry to handover</span></div>
      <div className="op-doc-steps">{capabilitySteps.map(x=><div key={x.title}><strong>{x.title}</strong><p>{x.detail}</p></div>)}</div>
    </Sheet>
    <Sheet series="ENGINEERING CAPABILITY STATEMENT" reference="OP-CAP-001 / R00" page={2} total={2}>
      <div className="op-doc-hero op-doc-hero-compact">
        <Eyebrow>OUR DELIVERY APPROACH</Eyebrow>
        <h2>Clear accountability.<br/><span>Controlled documentation.</span></h2>
        <p>Technical standards, review responsibility and release requirements are confirmed for the specific engineering work package.</p>
      </div>
      <div className="op-doc-section-head"><Eyebrow>03 / DELIVERY CONTROLS</Eyebrow><span>Five-stage traceability</span></div>
      <div className="op-doc-control-grid">{capabilityControls.map((item,i)=><div key={item.title}>
        <span className="op-doc-number">{String(i+1).padStart(2,'0')}</span><h3>{item.title}</h3><p>{item.detail}</p>
      </div>)}</div>
      <div className="op-doc-section-head"><Eyebrow>04 / SAMPLE HANDOVER RECORDS</Eyebrow><span>Subject to project scope</span></div>
      <table className="op-doc-table"><thead><tr><th scope="col">Record</th><th scope="col">Expected purpose</th></tr></thead>
        <tbody>{capabilityRecords.map(row=><tr key={row.name}><th scope="row">{row.name}</th><td>{row.detail}</td></tr>)}</tbody>
      </table>
      <div className="op-doc-contact"><span>LET'S DEFINE THE WORK PACKAGE</span><strong>{assuranceIdentity.contact}</strong></div>
      <p className="op-doc-disclaimer">{templateSafetyNote}</p>
    </Sheet>
  </>;
}
function HandoverPages() {
  return <>
    <Sheet series="CONTROLLED HANDOVER / TEMPLATE" reference="OP-SAMPLE-001 / R00" page={1} total={3}>
      <div className="op-doc-hero">
        <Eyebrow>EXAMPLE DELIVERY DOCUMENTATION</Eyebrow>
        <h2>Controlled handover.<br/><span>Every file accounted for.</span></h2>
        <p>A practical sample of the documentation structure associated with a defined engineering work package. Every reference and record below is fictional.</p>
      </div>
      <div className="op-doc-warning">SAMPLE ONLY — NOT CLIENT WORK OR APPROVED FOR MANUFACTURE</div>
      <div className="op-doc-section-head"><Eyebrow>01 / HANDOVER INDEX</Eyebrow><span>Document register · illustrative</span></div>
      <table className="op-doc-table"><thead><tr><th scope="col">Reference</th><th scope="col">Document</th><th scope="col">Status</th></tr></thead>
        <tbody>{handoverIndex.map(row=><tr key={row.ref}><th scope="row">{row.ref}</th><td>{row.title}</td><td>{row.status}</td></tr>)}</tbody>
      </table>
      <div className="op-doc-section-head"><Eyebrow>02 / RELEASE INFORMATION</Eyebrow><span>Mandatory fields for real work</span></div>
      <div className="op-doc-field-grid">
        {['Work package reference','Client / organisation','Issue date','Document revision','Prepared by','Checked by','Release authority','Outstanding exclusions'].map(label=><div key={label}><span>{label}</span><strong>—</strong></div>)}
      </div>
      <p className="op-doc-disclaimer">{templateSafetyNote}</p>
    </Sheet>
    <Sheet series="CONTROLLED HANDOVER / TEMPLATE" reference="OP-SAMPLE-001 / R00" page={2} total={3}>
      <div className="op-doc-hero op-doc-hero-compact">
        <Eyebrow>TECHNICAL RECORDS</Eyebrow><h2>Drawing register.<br/><span>Bill of materials.</span></h2>
        <p>Sample field structures for traceable drawings, parts and technical records. No actual engineered assembly is represented.</p>
      </div>
      <div className="op-doc-section-head"><Eyebrow>03 / DRAWING REGISTER</Eyebrow><span>All references are fictional</span></div>
      <table className="op-doc-table"><thead><tr><th scope="col">Drawing no.</th><th scope="col">Title</th><th scope="col">Rev.</th><th scope="col">Status</th></tr></thead>
        <tbody>{drawingRegister.map(row=><tr key={row.ref}><th scope="row">{row.ref}</th><td>{row.title}</td><td>{row.rev}</td><td>{row.status}</td></tr>)}</tbody>
      </table>
      <div className="op-doc-section-head"><Eyebrow>04 / BILL OF MATERIALS</Eyebrow><span>Sample BOM, not a product design</span></div>
      <table className="op-doc-table"><thead><tr><th scope="col">Item</th><th scope="col">Part number</th><th scope="col">Description</th><th scope="col">Qty</th></tr></thead>
        <tbody>{sampleBOM.map(row=><tr key={row.ref}><th scope="row">{row.item}</th><td>{row.ref}</td><td>{row.description}</td><td>{row.qty}</td></tr>)}</tbody>
      </table>
      <div className="op-doc-muted-panel"><strong>Required before an actual issue</strong><p>Confirm material and specifications, part release status, revision compatibility, file formats, inspection requirements and the issuing authority.</p></div>
      <p className="op-doc-disclaimer">{templateSafetyNote}</p>
    </Sheet>
    <Sheet series="CONTROLLED HANDOVER / TEMPLATE" reference="OP-SAMPLE-001 / R00" page={3} total={3}>
      <div className="op-doc-hero op-doc-hero-compact">
        <Eyebrow>QUALITY & RELEASE CONTROL</Eyebrow><h2>Review recorded.<br/><span>Exceptions visible.</span></h2>
        <p>Review requirements are kept open until a responsible person records adequate evidence. This example contains no completed checks.</p>
      </div>
      <div className="op-doc-section-head"><Eyebrow>05 / TECHNICAL REVIEW LOG</Eyebrow><span>No fabricated sign-offs</span></div>
      <table className="op-doc-table"><thead><tr><th scope="col">Ref.</th><th scope="col">Review item</th><th scope="col">Status</th></tr></thead>
        <tbody>{sampleReview.map(row=><tr key={row.ref}><th scope="row">{row.ref}</th><td>{row.requirement}</td><td>{row.status}</td></tr>)}</tbody>
      </table>
      <div className="op-doc-section-head"><Eyebrow>06 / HANDOVER READINESS CHECKLIST</Eyebrow><span>Blank example only</span></div>
      <div className="op-doc-checklist">{releaseChecklist.map((item,i)=><div key={item}><span className="op-doc-empty-box" aria-hidden="true"/><span>{String(i+1).padStart(2,'0')} — {item}</span></div>)}</div>
      <div className="op-doc-warning">ILLUSTRATIVE ONLY — NO APPROVAL, SIGNATURE OR TEST RESULT IMPLIED</div>
      <p className="op-doc-disclaimer">{templateSafetyNote}</p>
    </Sheet>
  </>;
}
export default function BrandedTemplates(){
  const [active,setActive]=useState<TemplateKind>('capability');
  return <div className="op-template-builder" id="branded-documents">
    <div className="op-template-toolbar" role="group" aria-label="Choose engineering document template">
      <div className="op-template-switch">
        <button type="button" aria-pressed={active==='capability'} className={active==='capability'?'is-selected':''} onClick={()=>setActive('capability')}>Capability statement <small>2 pages</small></button>
        <button type="button" aria-pressed={active==='handover'} className={active==='handover'?'is-selected':''} onClick={()=>setActive('handover')}>Handover templates <small>3 pages</small></button>
      </div>
      <div className="op-template-actions">
        <button type="button" onClick={()=>window.print()}>Print / Save PDF</button>
        <a href={pdfLinks[active]} download>Download PDF ↓</a>
      </div>
    </div>
    <p className="op-template-helper">A4 React document preview · Scroll to inspect pages · Print / Save PDF uses your browser’s PDF option · Download PDF provides a ready-made file.</p>
    <div className="op-template-scroll">
      <div className="op-template-print-root">
        {active==='capability'?<StatementPages/>:<HandoverPages/>}
      </div>
    </div>
    <p className="op-template-under-note">Sample documents are illustrative. Design specifications, insurance, certifications and independent approvals are not asserted.</p>
  </div>;
}
