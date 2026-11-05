import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { isKnownIsolatedQaFixtureBackend } from '@/lib/qa/isolation';
import { createQaCompanyAction, createQaContactAction, createQaOpportunityAction } from '../qa-actions';
import css from './qa.module.css';

const isUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export default async function NewQaOpportunity({
  searchParams,
}: {searchParams:Promise<{company_id?:string;contact_id?:string;company_created?:string;contact_created?:string;error?:string}>}) {
  const {supabase,organisationId,profile} = await requireUserContext('/opos-next');
  const q=await searchParams;
  const unlocked=isKnownIsolatedQaFixtureBackend() && ['admin','owner','operator'].includes(profile.role);
  const companyId=isUuid(q.company_id||'')?q.company_id!:'';
  const contactId=isUuid(q.contact_id||'')?q.contact_id!:'';
  const companyRecord=companyId?await supabase.from('companies').select('id,name')
    .eq('organisation_id',organisationId).eq('id',companyId).maybeSingle():{data:null};
  const company=companyRecord.data?.name?.startsWith('QA - ')?companyRecord.data:null;
  const contactRecord=contactId&&company?await supabase.from('contacts').select('id,full_name,company_id')
    .eq('organisation_id',organisationId).eq('company_id',company.id).eq('id',contactId).maybeSingle():{data:null};
  const contact=contactRecord.data||null;

  return <section className={css.page}>
    <Link href="/opos-next/opportunities" className={css.back}>← Opportunities</Link>
    <p className={css.eyebrow}>OPOS / ISOLATED QA</p>
    <h1 className={css.title}>Create a test opportunity</h1>
    <p className={css.description}>Build a fictional company, client contact, and opportunity using real OPOS records and audit controls. No customer email, partner work order, or payment is sent by this form.</p>
    {!unlocked?<div className={css.locked} role="status">
      <strong>QA entry remains locked</strong>
      <p>This screen is prepared, but synthetic record creation needs its separate QA fixture switch. All other transactional flows and outbound emails remain disabled.</p>
    </div>:null}
    {q.error?<p className={css.error} role="alert">{String(q.error).slice(0,500)}</p>:null}
    <div className={css.steps}>
      <section className={css.step}>
        <h2><span>01</span> Fictional client company</h2>
        {company?<p className={css.done}>✓ {company.name}</p>:
          <form action={createQaCompanyAction} className={css.form}>
            <label>Company name<input className={css.input} name="company_name" minLength={2} maxLength={170}
              required placeholder="Northfield Demonstration Engineering" defaultValue="Northfield Demonstration Engineering" disabled={!unlocked}/></label>
            <p className={css.hint}>OPOS adds the “QA - ” prefix automatically, so this cannot be mistaken for a real prospect.</p>
            <button type="submit" className={css.button} disabled={!unlocked}>Create fictional company</button>
          </form>}
      </section>
      <section className={css.step}>
        <h2><span>02</span> Test client contact</h2>
        {contact?<p className={css.done}>✓ {contact.full_name} · QA Gmail +client alias</p>:
          company?<form action={createQaContactAction} className={css.form}>
            <input type="hidden" name="company_id" value={company.id}/>
            <label>Contact name<input className={css.input} name="contact_name" required minLength={2} maxLength={180}
              defaultValue="QA Engineering Manager" disabled={!unlocked}/></label>
            <p className={css.hint}>Email is set automatically to the allowed +client Gmail alias. No manual email address is accepted.</p>
            <button type="submit" className={css.button} disabled={!unlocked}>Create fictional contact</button>
          </form>:<p className={css.hint}>Complete the company step first.</p>}
      </section>
      <section className={css.step}>
        <h2><span>03</span> Governed opportunity</h2>
        {company&&contact?<form action={createQaOpportunityAction} className={css.form}>
          <input type="hidden" name="company_id" value={company.id}/>
          <input type="hidden" name="contact_id" value={contact.id}/>
          <label>Demonstration scope<textarea className={css.input} rows={4} name="scope" required minLength={12} maxLength={1000}
            defaultValue="CAD redesign of a small industrial bracket assembly, controlled drawing revisions, QA review, and documented delivery handover." disabled={!unlocked}/></label>
          <p className={css.hint}>Creates the canonical opportunity and activity evidence, without triggering the Step 2 email. That will be tested separately.</p>
          <button type="submit" className={css.button} disabled={!unlocked}>Create test opportunity →</button>
        </form>:<p className={css.hint}>Complete the client company and contact steps first.</p>}
      </section>
    </div>
    <p className={css.footer}>Synthetic data only · Isolated OPOS-QA · Production workflow unchanged</p>
  </section>;
}
