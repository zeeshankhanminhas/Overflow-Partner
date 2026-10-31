import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {approveQaPartnerReadinessAction} from '../qa-actions';

const QA_ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';

export default async function PartnerDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<{error?:string;approved?:string}>}){
  const query=searchParams?await searchParams:{};
  const {id}=await params;
  const {supabase,organisationId}=await requireUserContext();
  const {data:partner,error}=await supabase.from('partners')
    .select('id,company_name,status,nda_signed,nda_signed_at,country,services,contact_name,email,notes')
    .eq('organisation_id',organisationId).eq('id',id).maybeSingle();
  if(error)throw new Error('Partner record could not be loaded securely.');
  if(!partner)notFound();
  const qa=organisationId===QA_ORG && partner.company_name.startsWith('QA - ');
  const nda=partner.nda_signed===true && !!partner.nda_signed_at;
  const approved=partner.status==='approved';
  const eligible=approved && nda && !!partner.email;
  const steps=[
    {name:'Contact and capability',complete:!!partner.email && !!partner.services,description:'Capture a named contact, controlled email destination and engineering capabilities.'},
    {name:'Confidentiality evidence',complete:nda,description:'Record actual NDA acceptance and its evidence. QA simulations must never represent a legally signed NDA.'},
    {name:'Authorised internal approval',complete:approved,description:'Approval requires verified evidence and an authorised operator decision.'},
    {name:'Technical assessment eligibility',complete:eligible,description:'Only approved partners with confidentiality evidence and contact details are selectable.'},
  ];
  return <article style={{maxWidth:820,margin:'0 auto',padding:'32px 0 70px'}}>
    <Link href="/opos-next/partners" style={{fontSize:13,color:'var(--muted-foreground, #999)'}}>← Back to partner register</Link>
    <p style={{fontSize:11,letterSpacing:2,marginTop:30}}>PARTNERS / EXECUTION PARTNER</p>
    <h1 style={{fontSize:30,fontWeight:650,letterSpacing:'-0.03em',margin:'12px 0 8px'}}>{partner.company_name}</h1>
    <p style={{opacity:.7,fontSize:14}}>{qa?'Isolated fictional QA record · No real partner agreement or approval is implied.':'Partner readiness and governed assessment eligibility.'}</p>
    <section style={{border:'1px solid #4446',borderRadius:16,padding:26,marginTop:28}}>
      <p style={{fontSize:11,letterSpacing:1.5,opacity:.65}}>CURRENT POSITION</p>
      <h2 style={{fontSize:23,margin:'10px 0'}}>{eligible?'Eligible for technical assessment':'Partner readiness incomplete'}</h2>
      <p style={{fontSize:14,opacity:.8}}>{eligible?'Approved and confidentiality evidence recorded.':'Partner assessment remains blocked until all readiness gates pass.'}</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:16,marginTop:22,fontSize:13}}>
        <div><strong>Status</strong><p>{partner.status}</p></div>
        <div><strong>Confidentiality</strong><p>{nda?'NDA recorded':'NDA not recorded'}</p></div>
        <div><strong>Contact</strong><p>{partner.contact_name||'Not recorded'}</p></div>
        <div><strong>Email</strong><p style={{overflowWrap:'anywhere'}}>{partner.email||'Not recorded'}</p></div>
      </div>
    </section>
    {query.error?<p role="alert" style={{color:'#ef8181',marginTop:20}}>Action failed: {String(query.error).slice(0,300)}</p>:null}
    {query.approved?<p role="status" style={{marginTop:20}}>QA simulated readiness saved. This is not evidence of a legally executed NDA.</p>:null}
    <section style={{marginTop:32}}>
      <h2 style={{fontSize:20,marginBottom:18}}>Readiness checklist</h2>
      <div style={{display:'grid',gap:10}}>
        {steps.map((step,index)=><div key={step.name} style={{border:'1px solid #4446',borderRadius:12,padding:18,display:'flex',gap:16}}>
          <span aria-label={step.complete?'Complete':'Pending'} style={{fontSize:16}}>{step.complete?'✓':'○'}</span>
          <div><strong>{String(index+1).padStart(2,'0')} · {step.name}</strong><p style={{opacity:.7,fontSize:13,marginTop:6}}>{step.description}</p></div>
        </div>)}
      </div>
    </section>
    {qa && !eligible?<section style={{border:'1px solid #4446',borderRadius:12,padding:22,marginTop:28}}><h2 style={{fontSize:20}}>QA-only simulated approval</h2><p style={{fontSize:13,margin:'12px 0',opacity:.8}}>For this fictional fixture only. This simulation marks the partner eligible inside isolated QA; it is NOT a signed legal NDA or actual supplier approval.</p><form action={approveQaPartnerReadinessAction} style={{display:'grid',gap:14}}><input type="hidden" name="partner_id" value={partner.id}/><label style={{fontSize:13}}>Approval test rationale<textarea name="rationale" required minLength={15} maxLength={1000} placeholder="Explain the fictional capability and confidentiality checks simulated for this QA fixture" style={{display:'block',width:'100%',minHeight:82,padding:12,marginTop:8,color:'#111',background:'#fff',borderRadius:8}}/></label><label style={{display:'flex',gap:10,fontSize:13}}><input type="checkbox" name="simulation_ack" value="yes" required/>I confirm this is synthetic QA readiness, not a legally executed NDA.</label><button type="submit" style={{background:'#f6f6f6',color:'#111',borderRadius:8,padding:'13px 18px',fontWeight:600,cursor:'pointer'}}>Approve fictional QA partner →</button></form></section>:null}
    <section style={{border:'1px solid #4446',borderRadius:12,padding:20,marginTop:26}}>
      <h2 style={{fontSize:18,marginBottom:10}}>Capabilities and controlled context</h2>
      <p style={{fontSize:14}}>{partner.services||'Capabilities not recorded'}</p>
      <p style={{fontSize:13,opacity:.7,marginTop:10}}>Country: {partner.country||'Not recorded'}</p>
      {qa?<p style={{fontSize:13,opacity:.7,marginTop:12}}>For QA: simulated confidentiality and internal approval require a separate auditable test flow. The existing production NDA field is not changed automatically.</p>:null}
      <p style={{fontSize:13,opacity:.7,marginTop:12}}>Governed readiness edits are not yet enabled in OPOS 2.0. No legacy workspace redirect is provided.</p>
    </section>
  </article>;
}
