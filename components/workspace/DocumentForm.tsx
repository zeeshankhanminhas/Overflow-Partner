import { createDocumentAction } from '@/app/workspace/documents/actions';
import type { Lead } from '@/types/domain';

export default function DocumentForm({ leads }: { leads: Lead[] }) {
  const defaultReference = `OP-${new Date().getFullYear()}-`;

  return (
    <form action={createDocumentAction} className="card stack" style={{ width: '100%', marginTop: 24 }}>
      <div>
        <p className="eyebrow">Document Engine</p>
        <h3>Register document</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">Document type
          <select name="document_type" defaultValue="Technical Intake">
            <option>Technical Intake</option>
            <option>NDA</option>
            <option>Scope of Work</option>
            <option>Partner RFQ</option>
            <option>Partner Quote</option>
            <option>Commercial Review</option>
            <option>Client Quote</option>
            <option>Purchase Order</option>
            <option>Invoice</option>
            <option>Acceptance</option>
            <option>Closeout Pack</option>
          </select>
        </label>
        <label className="field">Reference<input name="reference" required defaultValue={defaultReference} /></label>
        <label className="field">Title<input name="title" required /></label>
        <label className="field">Related lead
          <select name="lead_id" defaultValue="">
            <option value="">No lead selected</option>
            {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.title || lead.company_name}</option>)}
          </select>
        </label>
        <label className="field">Status
          <select name="status" defaultValue="draft">
            <option value="draft">Draft</option>
            <option value="in_review">In review</option>
            <option value="approved">Approved</option>
            <option value="issued">Issued</option>
          </select>
        </label>
        <label className="field">Version<input name="version" type="number" min="1" defaultValue="1" /></label>
      </div>
      <button className="button" type="submit">Create document record</button>
    </form>
  );
}
