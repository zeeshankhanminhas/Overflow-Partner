import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';

const QA_ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';

export default async function PartnerDetail({params}:{params:Promise<{id:string}>}){
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
    <section style={{marginTop:32}}>
      <h2 style={{fontSize:20,marginBottom:18}}>Readiness checklist</h2>
      <div style={{display:'grid',gap:10}}>
        {steps.map((step,index)=><div key={step.name} style={{border:'1px solid #4446',borderRadius:12,padding:18,display:'flex',gap:16}}>
          <span aria-label={step.complete?'Complete':'Pending'} style={{fontSize:16}}>{step.complete?'✓':'○'}</span>
          <div><strong>{String(index+1).padStart(2,'0')} · {step.name}</strong><p style={{opacity:.7,fontSize:13,marginTop:6}}>{step.description}</p></div>
        </div>)}
      </div>
    </section>
    <section style={{border:'1px solid #4446',borderRadius:12,padding:20,marginTop:26}}>
      <h2 style={{fontSize:18,marginBottom:10}}>Capabilities and controlled context</h2>
      <p style={{fontSize:14}}>{partner.services||'Capabilities not recorded'}</p>
      <p style={{fontSize:13,opacity:.7,marginTop:10}}>Country: {partner.country||'Not recorded'}</p>
      {qa?<p style={{fontSize:13,opacity:.7,marginTop:12}}>For QA: simulated confidentiality and internal approval require a separate auditable test flow. The existing production NDA field is not changed automatically.</p>:null}
      <p style={{fontSize:13,opacity:.7,marginTop:12}}>Governed readiness edits are not yet enabled in OPOS 2.0. No legacy workspace redirect is provided.</p>
    </section>
  </article>;
}
