import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { resolveCaseQueuePresentation } from '@/lib/presentation/queueState';

type Enquiry={id:string;company_name:string;contact_name:string|null;status:string;created_at:string};
type CaseRow={id:string;title:string|null;company_name:string;contact_name:string|null;workflow_stage:string;created_at:string};
type WorkRow={id:string;title:string;person:string;kind:'Enquiry'|'Case 360';state:string;href:string;createdAt:string};

/** Unified navigation, not a duplicate CRM pipeline or new commercial state.
 * The existing Enquiry and Case records remain authoritative. */
export default async function OpportunitiesPage({searchParams}:{
  searchParams?:Promise<{q?:string}>;
}){
  const params=searchParams?await searchParams:{};
  const q=String(params.q||'').trim().slice(0,100);
  const {supabase,organisationId}=await requireUserContext();
  const [enquiriesResult,casesResult]=await Promise.all([
    supabase.from('prospects')
      .select('id,company_name,contact_name,status,created_at')
      .eq('organisation_id',organisationId)
      .neq('status','converted')
      .neq('status','not_a_fit')
      .order('created_at',{ascending:false})
      .limit(100),
    supabase.rpc('op_case_queue',{
      p_organisation_id:organisationId,p_view:'all',p_limit:100,p_offset:0,
    }),
  ]);
  if(enquiriesResult.error||casesResult.error)throw new Error('Unable to load opportunity worklist.');
  const cases=(casesResult.data||[]) as CaseRow[];
  // Projects own their commercial history after release; do not surface those
  // historical Cases as current Opportunities.
  const ids=cases.map(item=>item.id);
  const projectResult=ids.length?await supabase.from('projects').select('lead_id')
    .eq('organisation_id',organisationId).in('lead_id',ids):{data:[] as {lead_id:string}[],error:null};
  if(projectResult.error)throw new Error('Unable to resolve Project-owned Cases.');
  const projectOwned=new Set((projectResult.data||[]).map(row=>String(row.lead_id)));
  const all:WorkRow[]=[
    ...((enquiriesResult.data||[]) as Enquiry[]).map(item=>({
      id:'enquiry-'+item.id,title:item.company_name,person:item.contact_name||'Contact not recorded',
      kind:'Enquiry' as const,
      state:'Requirements and feasibility',href:'/workspace/acquisition/'+item.id,
      createdAt:item.created_at,
    })),
    ...cases.filter(item=>!projectOwned.has(item.id)).map(item=>({
      id:'case-'+item.id,title:item.title||item.company_name,
      person:item.company_name,kind:'Case 360' as const,
      state:resolveCaseQueuePresentation(item.workflow_stage).state,
      href:'/workspace/leads/'+item.id,createdAt:item.created_at,
    })),
  ];
  const needle=q.toLowerCase();
  const rows=all.filter(item=>!needle||[item.title,item.person,item.kind,item.state].some(value=>value.toLowerCase().includes(needle)))
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  return <section className="op-unified-page" aria-labelledby="opportunities-heading">
    <header className="op-unified-page__top">
      <div>
        <p className="op-unified-page__eyebrow">OPOS / CRM</p>
        <h1 id="opportunities-heading">Opportunities</h1>
        <p>Enquiries and commercial Cases in one worklist. The appropriate governed record opens when you select an item.</p>
      </div>
      <Link className="button" href="/workspace/acquisition#manual-prospect">New enquiry →</Link>
    </header>
    <form method="get" role="search" className="op-unified-page__search">
      <label htmlFor="opportunity-search">Find an opportunity</label>
      <div><input id="opportunity-search" type="search" name="q" placeholder="Search company, contact or stage…" defaultValue={q}/><button type="submit" className="button secondary">Search</button></div>
    </form>
    <section className="op-unified-page__list" aria-label="Active opportunities">
      <div className="op-unified-page__list-header"><h2>Active work</h2><small>{rows.length} shown</small></div>
      {rows.length?<ul>{rows.map(item=><li key={item.id}>
        <Link href={item.href}>
          <span className="op-unified-page__record">
            <strong>{item.title}</strong>
            <small>{item.person}</small>
          </span>
          <span className="op-unified-page__state">
            <span>{item.kind}</span><small>{item.state}</small>
          </span>
          <span aria-hidden="true" className="op-unified-page__arrow">↗</span>
        </Link>
      </li>)}</ul>:<p className="op-unified-page__empty">No matching active opportunities.</p>}
    </section>
    <details className="op-unified-page__archive">
      <summary>More opportunity tools</summary>
      <div>
        <Link href="/workspace/acquisition/prospects">Full Enquiry register ↗</Link>
        <Link href="/workspace/leads">Full Case register ↗</Link>
        <Link href="/workspace/quotes">Client quotations ↗</Link>
      </div>
      <p>Worklist shows up to 100 recent Enquiries and 100 Cases. The full registers provide additional records and filtering.</p>
    </details>
  </section>;
}
