import { createLeadFormAction } from '@/app/workspace/leads/actions';
import type { Company, Contact } from '@/types/domain';

const inputClass = 'field_input border border-black/15 bg-white px-3 py-2 text-black';
const labelClass = 'field_group grid gap-2 text-xs font-medium uppercase text-black';

export default function LeadForm({ companies, contacts }: { companies: Company[]; contacts: Contact[] }) {
  return (
    <form action={createLeadFormAction} className="card stack" style={{ width: '100%', marginTop: 20 }}>
      <div><p className="eyebrow">Manual lead intake</p><h3>Create lead</h3></div>
      <input type="hidden" name="status" value="new" />
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>Company<select className={inputClass} name="company_id" required><option value="">Select company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label className={labelClass}>Contact<select className={inputClass} name="contact_id"><option value="">Select contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}{contact.company?.name ? ` · ${contact.company.name}` : ''}</option>)}</select></label>
        <label className={labelClass}>Opportunity title<input className={inputClass} name="title" /></label>
        <label className={labelClass}>Project type<input className={inputClass} name="project_type" /></label>
        <label className={labelClass}>Service<input className={inputClass} name="service" defaultValue="Engineering overflow support" /></label>
        <label className={labelClass}>Source<select className={inputClass} name="source" defaultValue="manual"><option value="manual">Manual</option><option value="website">Website</option><option value="linkedin">LinkedIn</option><option value="email">Email</option><option value="referral">Referral</option><option value="phone">Phone</option></select></label>
        <label className={labelClass}>Priority<select className={inputClass} name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
      </div>
      <label className={labelClass}>Notes<textarea className={inputClass} name="notes" rows={4} /></label>
      <button className="button" type="submit">Create lead</button>
    </form>
  );
}
