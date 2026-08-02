import { createProspectFormAction } from '@/app/workspace/acquisition/actions';

const inputClass = 'field_input border border-black/15 bg-white px-3 py-2 text-black';
const labelClass = 'field_group grid gap-2 text-xs font-medium uppercase text-black';

export default function ProspectForm() {
  return (
    <form action={createProspectFormAction} className="card stack" style={{ width: '100%', marginTop: 20 }}>
      <div>
        <p className="eyebrow">New acquisition record</p>
        <h3>Add prospect</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>Source
          <select className={inputClass} name="source" defaultValue="linkedin">
            <option value="linkedin">LinkedIn</option><option value="website">Website</option><option value="email">Email</option><option value="referral">Referral</option><option value="phone">Phone</option><option value="manual">Manual</option>
          </select>
        </label>
        <label className={labelClass}>Stage
          <select className={inputClass} name="status" defaultValue="identified">
            <option value="identified">Identified</option><option value="contacted">Contacted</option><option value="conversation">Conversation</option><option value="qualified">Qualified</option><option value="not_a_fit">Not a fit</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>Company<input className={inputClass} name="company_name" required /></label>
        <label className={labelClass}>Contact<input className={inputClass} name="contact_name" /></label>
        <label className={labelClass}>Job title<input className={inputClass} name="job_title" /></label>
        <label className={labelClass}>Industry<input className={inputClass} name="industry" /></label>
        <label className={labelClass}>LinkedIn URL<input className={inputClass} name="linkedin_url" type="url" /></label>
        <label className={labelClass}>Email<input className={inputClass} name="email" type="email" /></label>
        <label className={labelClass}>Phone<input className={inputClass} name="phone" /></label>
        <label className={labelClass}>Next action date<input className={inputClass} name="next_action_at" type="datetime-local" /></label>
      </div>
      <label className={labelClass}>Next action<input className={inputClass} name="next_action" /></label>
      <label className={labelClass}>Notes<textarea className={inputClass} name="notes" rows={4} /></label>
      <button className="button" type="submit">Add prospect</button>
    </form>
  );
}
