import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { deleteDeveloperTestRecordAction } from './actions';

export default async function DeveloperDataPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}) {
  const params = searchParams ? await searchParams : {};
  const { supabase, profile } = await requireUserContext();
  const { data: permitted, error } = await supabase.rpc('op_can_delete_test_data');

  if (error || permitted !== true) notFound();

  return <section className="vp-page">
    <header className="vp-header">
      <div>
        <p className="vp-kicker">System · Developer tools</p>
        <h1>Test data cleanup</h1>
        <p className="vp-subtitle">Destructive operational-data tools for the explicitly authorised developer/tester account only.</p>
      </div>
    </header>

    {params.deleted ? <div className="vp-callout"><strong>Record deleted</strong><p>{String(params.deleted)}</p></div> : null}
    {params.error ? <div className="vp-callout"><strong>Delete blocked</strong><p>{String(params.error)}</p></div> : null}

    <section className="vp-object vp-object--hero">
      <p className="vp-label">Authorised identity</p>
      <div className="vp-facts" style={{marginTop:0}}>
        <div className="vp-fact"><small>User</small><strong>{profile.full_name || 'Developer tester'}</strong></div>
        <div className="vp-fact"><small>Role</small><strong>{profile.role}</strong></div>
        <div className="vp-fact"><small>Delete capability</small><strong>Enabled for this identity only</strong></div>
      </div>
    </section>

    <section className="card" style={{width:'100%'}}>
      <p className="vp-label">Destructive action</p>
      <h2>Delete one test record</h2>
      <p style={{color:'var(--op-muted)',lineHeight:1.6}}>This permanently deletes the selected operational record. Database relationships still apply, so deletion will be refused when dependent records cannot be safely removed.</p>
      <form action={deleteDeveloperTestRecordAction} className="stack" style={{marginTop:18}}>
        <label>Record type
          <select name="entity_type" required defaultValue="prospect">
            <option value="prospect">Prospect</option>
            <option value="case">Case</option>
            <option value="project">Project</option>
            <option value="document">Document</option>
            <option value="company">Client company</option>
            <option value="invoice">Invoice</option>
            <option value="partner_payable">Partner payable</option>
          </select>
        </label>
        <label>Record UUID<input name="entity_id" required placeholder="00000000-0000-0000-0000-000000000000" /></label>
        <label>Confirmation
          <input name="confirmation" required placeholder="DELETE PROSPECT 00000000-0000-0000-0000-000000000000" />
        </label>
        <p style={{color:'var(--op-muted)',fontSize:13}}>Confirmation must exactly match <strong>DELETE [TYPE] [UUID]</strong>. Example: DELETE PROJECT 123e4567-e89b-12d3-a456-426614174000.</p>
        <button className="button" type="submit">Permanently delete test record</button>
      </form>
    </section>

    <section className="vp-callout">
      <strong>Safety boundary</strong>
      <p>This capability is not inherited by owners or admins. If another user is added later, they cannot access this page or invoke the delete RPC unless their exact profile is separately granted the developer capability in Supabase.</p>
    </section>
  </section>;
}
