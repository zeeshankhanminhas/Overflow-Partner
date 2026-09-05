import { createContactFormAction, updateContactFormAction } from '@/app/workspace/contacts/actions';
import type { Company, Contact } from '@/types/domain';

const inputClass = 'field_input border border-black/15 bg-white px-3 py-2 text-black';
const labelClass = 'field_group grid gap-2 text-xs font-medium uppercase text-black';

export default function ContactForm({ companies, defaultCompanyId = '', contact }: { companies: Company[]; defaultCompanyId?: string; contact?: Contact }) {
  const editing=Boolean(contact);
  return (
    <form action={editing?updateContactFormAction:createContactFormAction} className="card stack" style={{ width: '100%', marginTop: 20 }}>
      {contact?<input type="hidden" name="contact_id" value={contact.id}/>:null}
      <div><p className="eyebrow">CRM contact</p><h3>{editing?'Edit contact':'Add contact'}</h3></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>Company<select className={inputClass} name="company_id" required defaultValue={contact?.company_id||defaultCompanyId}><option value="">Select company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label className={labelClass}>Full name<input className={inputClass} name="full_name" required defaultValue={contact?.full_name||''}/></label>
        <label className={labelClass}>Job title<input className={inputClass} name="job_title" defaultValue={contact?.job_title||''}/></label>
        <label className={labelClass}>Email<input className={inputClass} name="email" type="email" defaultValue={contact?.email||''}/></label>
        <label className={labelClass}>Phone<input className={inputClass} name="phone" defaultValue={contact?.phone||''}/></label>
        <label className={labelClass}>LinkedIn URL<input className={inputClass} name="linkedin_url" type="url" defaultValue={contact?.linkedin_url||''}/></label>
      </div>
      <label className={labelClass}>Notes<textarea className={inputClass} name="notes" rows={4} defaultValue={contact?.notes||''}/></label>
      <button className="button" type="submit">{editing?'Save changes':'Add contact'}</button>
    </form>
  );
}
