import { createProspectFormAction } from '@/app/workspace/acquisition/actions';
import type { Company, Contact } from '@/types/domain';

const inputClass = 'field_input border border-black/15 bg-white px-3 py-2 text-black';
const labelClass = 'field_group grid gap-2 text-xs font-medium uppercase text-black';

export default function ProspectForm({ companies, contacts }: { companies: Company[]; contacts: Contact[] }) {
  return (
    <form action={createProspectFormAction} className="card stack acquisition-entry-form" style={{ width: '100%', marginTop: 20 }}>
      <div><p className="eyebrow">New enquiry</p><h3>Add enquiry</h3></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>Company<select className={inputClass} name="company_id" required><option value="">Select company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label className={labelClass}>Contact<select className={inputClass} name="contact_id"><option value="">Select contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}{contact.company?.name ? ` · ${contact.company.name}` : ''}</option>)}</select></label>
        <label className={labelClass}>Source<select className={inputClass} name="source" defaultValue="linkedin"><option value="linkedin">LinkedIn</option><option value="website">Website</option><option value="email">Email</option><option value="referral">Referral</option><option value="phone">Phone</option><option value="manual">Manual</option></select></label>
      </div>
      <label className={labelClass}>Notes<textarea className={inputClass} name="notes" rows={4} placeholder="Only add context that is not already held on the company or contact." /></label>
      <button className="button" type="submit">Add enquiry</button>
    </form>
  );
}
