import Link from 'next/link';
import {signOut} from '@/app/login/actions';
import type {PaidPortalProject,PortalKind} from '@/lib/portal/paidProjects';

const ink='#f3f3f4',panel='#111214',border='#303238',muted='#b6b9bf';
function date(value:string|null){if(!value)return 'Not scheduled';const d=new Date(value);return Number.isNaN(d.getTime())?'Not scheduled':d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
function titleCase(value:string|null|undefined){return String(value||'Not set').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
export default function PaidProjectDashboard({kind,projects,selected}:{
 kind:PortalKind;projects:PaidPortalProject[];selected?:string
}){
 const isClient=kind==='client';
 const account=projects[0]?.account_name|| (isClient?'Client':'Execution Partner');
 const active=selected?projects.find(x=>x.project_id===selected):null;
 return <main className="op-secure-dark" style={{minHeight:'100vh',background:'#08090a',color:ink,padding:'26px 16px',fontFamily:'Arial,Helvetica,sans-serif'}}>
  <div style={{maxWidth:1060,margin:'0 auto'}}>
   <header style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:16,paddingBottom:18,borderBottom:'1px solid '+border}}>
    <div><p style={{color:'#ef6c24',fontSize:12,fontWeight:800,letterSpacing:2,margin:0}}>OVERFLOW PARTNER · WORKSPACE 2.0</p>
      <h1 style={{fontSize:30,margin:'12px 0 5px'}}>{isClient?'Your engineering projects':'Your engineering work'}</h1>
      <p style={{margin:0,color:muted}}>{account}</p></div>
    <form action={signOut}><button type="submit" className="op-secure-secondary" style={{minHeight:44,padding:'10px 18px',borderRadius:8,border:'1px solid '+border,fontWeight:650}}>Sign out</button></form>
   </header>
   <nav aria-label={isClient?'Client workspace navigation':'Partner workspace navigation'} style={{display:'flex',flexWrap:'wrap',gap:12,padding:'18px 0'}}>
    <Link href={'/portal/'+kind} className="op-secure-secondary" style={{border:'1px solid '+border,borderRadius:8,padding:'12px 16px',fontWeight:600}}>Home · My projects</Link>
    {active?<Link href={'/portal/'+kind} style={{color:muted,padding:'12px 8px'}}>Back to projects</Link>:null}
   </nav>
   {active?<section style={{padding:24,background:panel,border:'1px solid '+border,borderRadius:12}}>
     <p style={{color:muted,margin:0}}>{active.project_number} · Verified paid project</p>
     <h2 style={{fontSize:26,margin:'12px 0'}}>{active.project_title}</h2>
     <dl style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:18,margin:'24px 0'}}>
       <div><dt style={{color:muted}}>Project stage</dt><dd style={{margin:'6px 0',fontWeight:700}}>{titleCase(active.project_stage)}</dd></div>
       <div><dt style={{color:muted}}>Due date</dt><dd style={{margin:'6px 0',fontWeight:700}}>{date(active.due_date)}</dd></div>
       <div><dt style={{color:muted}}>Reference</dt><dd style={{margin:'6px 0',fontWeight:700}}>{active.reference||active.project_number}</dd></div>
       {!isClient?<div><dt style={{color:muted}}>Execution status</dt><dd style={{margin:'6px 0',fontWeight:700}}>{titleCase(active.partner_execution_state)}</dd></div>:null}
       {!isClient?<div><dt style={{color:muted}}>Work Order acceptance</dt><dd style={{margin:'6px 0',fontWeight:700}}>Accepted</dd></div>:null}
     </dl>
     <div style={{borderLeft:'3px solid #ef6c24',padding:16,background:'#181a1d'}}>
       <strong>Next action</strong>
       <p style={{lineHeight:1.6,margin:'8px 0 0',color:muted}}>Open your latest authorized secure invitation to {isClient?'review project documents, approve deliverables or make an agreed payment':'submit progress, report an issue or deliver authorized files'}. This dashboard does not bypass any document or financial release gate.</p>
     </div>
   </section>:<section>
      <p style={{color:muted,marginTop:0,lineHeight:1.6}}>Only projects with verified opening payments appear here. Other enquiries, quotations and feasibility requests remain accessible exclusively through their secure invitation links.</p>
      <h2 style={{fontSize:20,margin:'24px 0 14px'}}>{isClient?'My paid projects':'My assigned paid projects'}</h2>
      <div style={{display:'grid',gap:12}}>{projects.map(p=><article key={p.project_id} style={{padding:20,background:panel,border:'1px solid '+border,borderRadius:12}}>
       <p style={{color:muted,fontSize:12,margin:'0 0 10px'}}>{p.project_number}</p>
       <h3 style={{fontSize:19,margin:'0 0 12px'}}>{p.project_title}</h3>
       <p style={{color:muted,margin:'0 0 15px'}}>{titleCase(p.project_stage)} · Due {date(p.due_date)}</p>
       <Link className="op-secure-primary" href={'/portal/'+kind+'/projects/'+p.project_id} style={{display:'inline-block',padding:'12px 17px',borderRadius:8,background:'#ef6c24',color:'#101113',fontWeight:700}}>Open project</Link>
      </article>)}</div>
   </section>}
   <footer style={{color:muted,marginTop:30,paddingTop:18,borderTop:'1px solid '+border,fontSize:13}}>Access is limited to explicitly authorized paid projects. Keep all secure invitation links private.</footer>
  </div>
 </main>
}
