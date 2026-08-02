import { createCompanyAction } from '@/app/workspace/companies/actions';

export default function CompanyForm() {
  return (
    <form action={createCompanyAction} className="card stack" style={{ width: '100%', marginTop: 24 }}>
      <div>
        <p className="eyebrow">CRM</p>
        <h3>Add company</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">Company name<input name="name" required /></label>
        <label className="field">Website<input name="website" type="url" placeholder="https://" /></label>
        <label className="field">Industry<input name="industry" /></label>
        <label className="field">Country<input name="country" defaultValue="United Kingdom" /></label>
        <label className="field">Employee count<input name="employee_count" type="number" min="0" /></label>
      </div>
      <label className="field">Notes<textarea name="notes" rows={4} /></label>
      <button className="button" type="submit">Create company</button>
    </form>
  );
}
