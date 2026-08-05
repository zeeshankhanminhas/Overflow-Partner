'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';

export default function MobileDocumentReviewShell({ children, title, status }: { children: ReactNode; title: string; status: string }) {
  const [fullScreen, setFullScreen] = useState(false);
  const [decision, setDecision] = useState('');
  return <div className={`${fullScreen ? 'fixed inset-0 z-[70] overflow-y-auto' : ''} document-review-shell`}>
    <header className="document-review-header print:hidden">
      <Link aria-label="Back to documents" className="button secondary" href="/workspace/documents">←</Link>
      <div className="min-w-0"><p>Document review</p><h1>{title}</h1></div>
      <span className="document-review-status">{status}</span>
      <button className="button secondary" onClick={() => setFullScreen((value) => !value)} type="button">{fullScreen ? 'Exit' : 'Full screen'}</button>
    </header>
    <section className="document-review-notice print:hidden">{decision ? `Local review state: ${decision}. ` : ''}Preview controls do not issue or alter the controlled document.</section>
    <div className="document-review-flow">{children}</div>
    <div className="document-review-actions print:hidden"><div><button onClick={() => window.print()} type="button">PDF</button><button onClick={() => setDecision('signed locally')} type="button">Sign</button><button onClick={() => setDecision('changes requested')} type="button">Review</button><button onClick={() => setDecision('approved')} type="button">Approve</button></div></div>
  </div>;
}
