import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUserContext} from '@/lib/auth/context';
import {isKnownIsolatedQaFixtureBackend} from '@/lib/qa/isolation';
import {scheduleQaAccountReviewAction} from '../actions';
import {OperatorPageIntro,OperatorRegister,type OperatorRow} from '../../OperatorViews';
import css from '../../opos.module.css';

function date(value:string|null){return value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'Europe/London'}).format(new Date(value)):'Not scheduled';}
export default async function AccountRecord({params,searchParams}:{params:Promise<{id:string}>;searchParams?:Promise<{error?:string;updated?:string}>}){
 const {id}=await params;
 const query=searchParams?await searchParams:{};
 const {supabase,organisationId,profile}=await requireUserContext();
 const [accountResult,prospectResult,leadResult]=await Promise.all([
   supabase.from('companies').select('id,name,industry,country,account_status,lifecycle_status,next_account_review_at,future_workload,preferred_services,relationship_notes').eq('organisation_id',organisationId).eq('id',id).maybeSingle(),
   supabase.from('prospects').select('id,company_name,status,next_action').eq('organisation_id',organisationId).eq('company_id',id).limit(20),
   supabase.from('leads').select('id,title,status,company_name').eq('organisation_id',organisationId).eq('company_id',id).limit(20),
 ]);
 if(accountResult.error||!accountResult.data)notFound();
 if(prospectResult.error||leadResult.error)throw new Error('Account relationships could not be loaded.');
 const a=accountResult.data;
 const canWrite=isKnownIsolatedQaFixtureBackend()&&a.name.startsWith('QA - ')&&['owner','admin','operator','business_development'].includes(String(profile.role));
 const rows:OperatorRow[]=[...(prospectResult.data||[]).map(p=>({id:p.id,title:p.company_name,subtitle:'Opportunity',state:String(p.status||'Recorded').replaceAll('_',' '),next:p.next_action||'Open Opportunity 360',href:'/opos-next/opportunities/'+p.id})),
   ...(leadResult.data||[]).map(l=>({id:l.id,title:l.title||l.company_name,subtitle:'Case',state:String(l.status||'Recorded').replaceAll('_',' '),next:'Open Case 360',href:'/opos-next/cases/'+l.id}))];
 return <article>
   <Link href="/opos-next" className={css.backLink}>← Mission Control</Link>
   <OperatorPageIntro eyebrow="CLIENT RELATIONSHIP / ACCOUNT" title={a.name} subtitle="Organisation-scoped account evidence and scheduled relationship review."/>
   {query.error?<p role="alert" className={css.empty}>{String(query.error).slice(0,400)}</p>:null}
   {query.updated?<p role="status" className={css.empty}>{String(query.updated).slice(0,400)}</p>:null}
   <section className={css.card}>
     <span className={css.overline}>ACCOUNT REVIEW POSITION</span>
     <h2 className={css.cardTitle}>Next review · {date(a.next_account_review_at)}</h2>
     <div className={css.factRow}><span>Status: <strong>{a.account_status||'Not recorded'}</strong></span><span>Lifecycle: <strong>{a.lifecycle_status||'Not recorded'}</strong></span><span>Industry: <strong>{a.industry||'Not recorded'}</strong></span><span>Country: <strong>{a.country||'Not recorded'}</strong></span></div>
     {a.future_workload?<p className={css.subhead}>Future workload: {a.future_workload}</p>:null}
     {a.preferred_services?<p className={css.subhead}>Preferred services: {a.preferred_services}</p>:null}
     {a.relationship_notes?<p className={css.subhead}>Relationship notes: {a.relationship_notes}</p>:null}
     {canWrite?<form action={scheduleQaAccountReviewAction} style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end',marginTop:24}}>
       <input type="hidden" name="company_id" value={id}/>
       <label style={{display:'grid',gap:7,fontSize:12}}>Next review date<input type="date" name="next_review_date" required defaultValue={a.next_account_review_at?.slice(0,10)||''} style={{padding:11,borderRadius:8,background:'#151619',border:'1px solid #484b52',color:'#f4f4f5'}}/></label>
       <button type="submit" className={css.action} style={{border:0,cursor:'pointer',marginTop:0}}>Schedule QA review →</button>
     </form>:<p className={css.meta} style={{marginTop:22}}>Review scheduling is available only for fictional QA accounts to authorised operators. No production relationship record can be changed here.</p>}
   </section>
   <section className={css.section}><div className={css.sectionHeading}><h2>Related operating records</h2></div>
     <OperatorRegister rows={rows} heading="Related account records" empty="No related Opportunities or Cases were found."/>
   </section>
 </article>;
}
