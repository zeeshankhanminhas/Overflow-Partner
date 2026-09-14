import { createCompanyAction } from '@/app/workspace/companies/actions';
import { updateCompanyFormAction } from '@/app/workspace/companies/actions';
import type { Company } from '@/types/domain';

export default function CompanyForm({ returnTo = '', company }: { returnTo?: string; company?:Company }) {
  const editing=Boolean(company);
  return (
    <form action={editing?updateCompanyFormAction:createCompanyAction} className="card stack" style={{ width: '100%', marginTop: 24 }}>
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      {company?<input type="hidden" name="company_id" value={company.id}/>:null}
      <div>
        <p className="eyebrow">CRM</p>
        <h3>{editing?'Edit company':'Add company'}</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">Company name<input name="name" required defaultValue={company?.name||''}/></label>
        <label className="field">Website<input name="website" type="url" placeholder="https://" defaultValue={company?.website||''}/></label>
        <label className="field">Industry<input name="industry" defaultValue={company?.industry||''}/></label>
        <label className="field">Country<input name="country" defaultValue={company?.country||'United Kingdom'} /></label>
        <label className="field">Employee count<input name="employee_count" type="number" min="0" defaultValue={company?.employee_count??''}/></label>
        {editing?<label className="field">Record status<select name="lifecycle_status" defaultValue={company?.lifecycle_status||'active'}><option value="active">Active</option><option value="dormant">Dormant</option><option value="archived">Archived</option></select></label>:null}
      </div>
      <label className="field">Notes<textarea name="notes" rows={4} defaultValue={company?.notes||''}/></label>
      <button className="button" type="submit">{editing?'Save company':'Create company'}</button>
    </form>
  );
}
