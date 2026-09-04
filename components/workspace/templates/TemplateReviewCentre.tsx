'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';

type EmailTemplate = {
  scenario: string;
  family: string;
  category: string;
  subject: string;
  heading: string;
  body: string;
  actionLabel: string;
  dynamicMode: string;
  dynamicFields: string[];
};

type DocumentTemplate = {
  slug: string;
  title: string;
  description: string;
  dataStatus: 'live-backed' | 'preview-only' | 'legacy-preview';
  audience: string;
  visibility: string;
  issueCondition: string;
  purpose: string;
};

type Props = { emails: EmailTemplate[]; documents: DocumentTemplate[] };
type View = 'emails' | 'documents';

const sampleValues: Record<string, string> = {
  company: 'Northfield Engineering Ltd', reference: 'OP-Q-1042', caseReference: 'OP-R-1042',
  projectReference: 'OP-P-2026-014', opportunityReference: 'OP-R-1042', project: 'Production drawing capacity support',
  amount: '£6,480.00', balance: '£3,240.00', paymentReference: 'PAY-240914', dueDate: '18 September 2026',
  validUntil: '30 September 2026', completionDate: '28 September 2026', revision: 'B',
  outcome: 'Approved', comments: 'Approved for final issue', message: 'Please clarify the applicable drawing standard.',
  actionUrl: 'Protected link', paymentReferenceId: 'PAY-240914',
};

function words(value: string) {
  return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function audienceForScenario(scenario: string) {
  if (scenario.startsWith('partner_')) return 'Delivery Partner';
  if (scenario.startsWith('dormant_') || scenario.startsWith('enquiry.') || scenario.startsWith('requirements.')) return 'Prospective client';
  return 'Client';
}

function actionMode(template: EmailTemplate) {
  if (template.actionLabel.startsWith('Reply')) return 'Direct email reply';
  if (template.actionLabel.toLowerCase().includes('invoice')) return 'Tokenised secure invoice';
  if (template.actionLabel.toLowerCase().includes('workspace') || template.actionLabel.toLowerCase().includes('package')) return 'Tokenised Delivery Partner workspace';
  return 'Tokenised secure form';
}

function EmailPreview({ template }: { template: EmailTemplate }) {
  const facts = template.dynamicFields.filter((field) => field !== 'actionUrl');
  return <article className="tr-email-preview" aria-label={`Preview of ${template.subject}`}>
    <div className="tr-email-frame">
      <header><span>Overflow Partner · {words(template.family)}</span><small>Engineering capacity, delivered with control.</small></header>
      <section className="tr-email-body">
        <p>Hello Alex,</p>
        <h2>{template.heading}</h2>
        <p className="tr-email-message">{template.body}</p>
        {facts.length ? <dl>{facts.map((field) => <div key={field}><dt>{words(field)}</dt><dd>{sampleValues[field] || `Sample ${words(field).toLowerCase()}`}</dd></div>)}</dl> : null}
        <button type="button" disabled title="Preview only — no message will be sent">{template.actionLabel}</button>
        <p className="tr-email-note">Preview only. The live message uses the controlled recipient, reference, dates and secure destination from its workflow record.</p>
      </section>
      <footer>{template.category === 'nurture' ? 'You are receiving this operational update because you previously contacted Overflow Partner. Unsubscribe preferences are available in the live message.' : 'This message relates to an active Overflow Partner workflow. Replies go to the operating team.'}</footer>
    </div>
  </article>;
}

export default function TemplateReviewCentre({ emails, documents }: Props) {
  const [view, setView] = useState<View>('emails');
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState('all');
  const [documentStatus, setDocumentStatus] = useState('all');
  const [selectedScenario, setSelectedScenario] = useState(emails[0]?.scenario || '');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const visibleEmails = useMemo(() => emails.filter((template) => {
    const templateAudience = audienceForScenario(template.scenario);
    const matchesAudience = audience === 'all' || templateAudience === audience;
    const haystack = `${template.scenario} ${template.subject} ${template.heading} ${template.body}`.toLowerCase();
    return matchesAudience && (!deferredQuery || haystack.includes(deferredQuery));
  }), [audience, deferredQuery, emails]);
  const visibleDocuments = useMemo(() => documents.filter((template) => {
    const matchesStatus = documentStatus === 'all' || template.dataStatus === documentStatus;
    const haystack = `${template.title} ${template.description} ${template.audience} ${template.visibility}`.toLowerCase();
    return matchesStatus && (!deferredQuery || haystack.includes(deferredQuery));
  }), [deferredQuery, documentStatus, documents]);
  const selectedEmail = visibleEmails.find((template) => template.scenario === selectedScenario) || visibleEmails[0];

  return <section className="vp-page tr-centre">
    <header className="tr-hero">
      <div><p className="vp-label">Launch control · Read only</p><h1>Template Review Centre</h1><p>Inspect every business email and controlled-document template without sending a message or changing a workflow record.</p></div>
      <div className="tr-counts"><span><strong>{emails.length}</strong> email scenarios</span><span><strong>{documents.length}</strong> document templates</span></div>
    </header>

    <nav className="tr-tabs" aria-label="Template type">
      <button className={view === 'emails' ? 'is-active' : ''} onClick={() => setView('emails')} type="button">Email templates</button>
      <button className={view === 'documents' ? 'is-active' : ''} onClick={() => setView('documents')} type="button">Document templates</button>
    </nav>

    <div className="tr-filters">
      <label><span>Find a template</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by subject, stage or audience" type="search" /></label>
      {view === 'emails' ? <label><span>Audience</span><select value={audience} onChange={(event) => setAudience(event.target.value)}><option value="all">All audiences</option><option>Prospective client</option><option>Client</option><option>Delivery Partner</option></select></label> : <label><span>Data status</span><select value={documentStatus} onChange={(event) => setDocumentStatus(event.target.value)}><option value="all">All statuses</option><option value="live-backed">Live-backed</option><option value="preview-only">Preview only</option><option value="legacy-preview">Legacy preview</option></select></label>}
    </div>

    {view === 'emails' && selectedEmail ? <div className="tr-email-layout">
      <aside className="tr-template-list" aria-label="Email scenarios">
        <div className="tr-list-heading"><strong>Email scenarios</strong><span>{visibleEmails.length}</span></div>
        {visibleEmails.map((template) => <button className={template.scenario === selectedEmail.scenario ? 'is-selected' : ''} key={template.scenario} onClick={() => setSelectedScenario(template.scenario)} type="button"><small>{words(template.scenario)}</small><strong>{template.subject}</strong><span>{audienceForScenario(template.scenario)}</span></button>)}
        {!visibleEmails.length ? <p className="tr-empty">No email templates match these filters.</p> : null}
      </aside>
      <div className="tr-review-pane">
        <section className="tr-template-meta"><div><p className="vp-label">{words(selectedEmail.scenario)}</p><h2>{selectedEmail.subject}</h2></div><dl><div><dt>Recipient</dt><dd>{audienceForScenario(selectedEmail.scenario)}</dd></div><div><dt>Category</dt><dd>{words(selectedEmail.category)}</dd></div><div><dt>Action</dt><dd>{actionMode(selectedEmail)}</dd></div><div><dt>Content mode</dt><dd>{words(selectedEmail.dynamicMode)}</dd></div></dl></section>
        <EmailPreview template={selectedEmail} />
      </div>
    </div> : null}

    {view === 'documents' ? <div className="tr-document-grid">
      {visibleDocuments.map((template) => <article key={template.slug} className="tr-document-card">
        <header><span className={`tr-status tr-status--${template.dataStatus}`}>{words(template.dataStatus)}</span><small>{template.visibility}</small></header>
        <h2>{template.title}</h2><p>{template.purpose}</p>
        <dl><div><dt>Audience</dt><dd>{template.audience}</dd></div><div><dt>Issue condition</dt><dd>{template.issueCondition}</dd></div></dl>
        {template.dataStatus !== 'live-backed' ? <div className="tr-warning">External issue remains blocked until the live data contract is complete.</div> : null}
        <Link className="button secondary" href={`/workspace/documents/templates/${template.slug}`}>Open document preview</Link>
      </article>)}
      {!visibleDocuments.length ? <p className="tr-empty">No document templates match these filters.</p> : null}
    </div> : null}
  </section>;
}
