import { createContactFormAction } from '@/app/workspace/contacts/actions';
import type { Company } from '@/types/domain';

const inputClass = 'field_input border border-black/15 bg-white px-3 py-2 text-black';
const labelClass = 'field_group grid gap-2 text-xs font-medium uppercase text-black';

export default function ContactForm({ companies, defaultCompanyId = '' }: { companies: Company[]; defaultCompanyId?: string }) {
  return (
    <form action={createContactFormAction} className="card stack" style={{ width: '100%', marginTop: 20 }}>
      <div><p className="eyebrow">CRM contact</p><h3>Add contact</h3></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>Company<select className={inputClass} name="company_id" defaultValue={defaultCompanyId}><option value="">Unassigned</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label className={labelClass}>Full name<input className={inputClass} name="full_name" required /></label>
        <label className={labelClass}>Job title<input className={inputClass} name="job_title" /></label>
        <label className={labelClass}>Email<input className={inputClass} name="email" type="email" /></label>
        <label className={labelClass}>Phone<input className={inputClass} name="phone" /></label>
        <label className={labelClass}>LinkedIn URL<input className={inputClass} name="linkedin_url" type="url" /></label>
      </div>
      <label className={labelClass}>Notes<textarea className={inputClass} name="notes" rows={4} /></label>
      <button className="button" type="submit">Add contact</button>
    </form>
  );
}
