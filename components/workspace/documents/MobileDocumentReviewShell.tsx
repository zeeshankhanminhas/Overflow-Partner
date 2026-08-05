'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState, useTransition } from 'react';
import { approveControlledDocumentAction } from '@/app/workspace/documents/review-actions';

export default function MobileDocumentReviewShell({ children, title, status, documentRecordId }: { children: ReactNode; title: string; status: string; documentRecordId?: string }) {
  const [fullScreen, setFullScreen] = useState(false);
  const [decision, setDecision] = useState('');
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isPending, startTransition] = useTransition();

  function approveDocument() {
    if (!documentRecordId) {
      setDecision('Approval unavailable: this preview is not connected to a controlled document record');
      return;
    }
    startTransition(async () => {
      const result = await approveControlledDocumentAction(documentRecordId);
      setDecision(result.message);
      if (result.ok && result.status) setCurrentStatus(result.status);
    });
  }

  return <div className={`${fullScreen ? 'fixed inset-0 z-[70] overflow-y-auto' : ''} document-review-shell`}>
    <header className="document-review-header print:hidden">
      <Link aria-label="Back to documents" className="button secondary" href="/workspace/documents">←</Link>
      <div className="min-w-0"><p>Document review</p><h1>{title}</h1></div>
      <span className="document-review-status">{currentStatus}</span>
      <button className="button secondary" onClick={() => setFullScreen((value) => !value)} type="button">{fullScreen ? 'Exit' : 'Full screen'}</button>
    </header>
    <section className="document-review-notice print:hidden" aria-live="polite">{decision || 'Review decisions update the controlled document record and audit trail.'}</section>
    <div className="document-review-flow">{children}</div>
    <div className="document-review-actions print:hidden"><div>
      <button onClick={() => window.print()} type="button">PDF</button>
      <button onClick={() => setDecision('Signature workflow is not yet connected.')} type="button">Sign</button>
      <button onClick={() => setDecision('Change-request workflow is not yet connected.')} type="button">Review</button>
      <button disabled={isPending || ['approved','issued','published'].includes(currentStatus.toLowerCase())} onClick={approveDocument} type="button">{isPending ? 'Approving…' : ['approved','issued','published'].includes(currentStatus.toLowerCase()) ? 'Approved' : 'Approve'}</button>
    </div></div>
  </div>;
}
