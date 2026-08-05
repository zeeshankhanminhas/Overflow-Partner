'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  approveControlledDocumentAction,
  requestDocumentChangesAction,
  signControlledDocumentAction,
} from '@/app/workspace/documents/review-actions';

type ActionMode = 'sign' | 'changes' | null;

export default function MobileDocumentReviewShell({
  children,
  title,
  status,
  documentRecordId,
}: {
  children: ReactNode;
  title: string;
  status: string;
  documentRecordId?: string;
}) {
  const router = useRouter();
  const [fullScreen, setFullScreen] = useState(false);
  const [decision, setDecision] = useState('');
  const [currentStatus, setCurrentStatus] = useState(status);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [isPending, setIsPending] = useState(false);

  const normalizedStatus = currentStatus.toLowerCase();
  const hasRecord = Boolean(documentRecordId);
  const canSign = ['draft', 'in_review', 'changes_requested'].includes(normalizedStatus);
  const canRequestChanges = ['draft', 'in_review', 'signed'].includes(normalizedStatus);
  const canApprove = normalizedStatus === 'signed';
  const isApproved = ['approved', 'issued', 'published'].includes(normalizedStatus);

  function requireRecord() {
    if (documentRecordId) return true;
    setDecision('This preview is not connected to a controlled document record. Open it from Case 360 or Project 360.');
    return false;
  }

  async function submitSignature() {
    setDecision('');
    if (!requireRecord() || !documentRecordId) return;
    if (!signerName.trim()) {
      setDecision('Enter the signer name before applying the electronic signature.');
      return;
    }
    if (!signerRole.trim()) {
      setDecision('Enter the signer role before applying the electronic signature.');
      return;
    }
    if (!declarationAccepted) {
      setDecision('Accept the electronic-signature declaration before continuing.');
      return;
    }

    setIsPending(true);
    setDecision('Applying electronic signature…');
    try {
      const result = await signControlledDocumentAction(documentRecordId, signerName, signerRole, declarationAccepted);
      setDecision(result.message);
      if (result.ok && result.status) {
        setCurrentStatus(result.status);
        setActionMode(null);
        router.refresh();
      }
    } catch (error) {
      setDecision(error instanceof Error ? error.message : 'Electronic signature failed. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  async function submitChangeRequest() {
    setDecision('');
    if (!requireRecord() || !documentRecordId) return;
    if (!changeReason.trim()) {
      setDecision('Describe the required changes before submitting the request.');
      return;
    }

    setIsPending(true);
    setDecision('Recording change request…');
    try {
      const result = await requestDocumentChangesAction(documentRecordId, changeReason);
      setDecision(result.message);
      if (result.ok && result.status) {
        setCurrentStatus(result.status);
        setActionMode(null);
        setChangeReason('');
        router.refresh();
      }
    } catch (error) {
      setDecision(error instanceof Error ? error.message : 'Change request failed. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  async function approveDocument() {
    setDecision('');
    if (!requireRecord() || !documentRecordId) return;

    setIsPending(true);
    setDecision('Approving controlled document…');
    try {
      const result = await approveControlledDocumentAction(documentRecordId);
      setDecision(result.message);
      if (result.ok && result.status) {
        setCurrentStatus(result.status);
        router.refresh();
      }
    } catch (error) {
      setDecision(error instanceof Error ? error.message : 'Document approval failed. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  return <div className={`${fullScreen ? 'fixed inset-0 z-[70] overflow-y-auto' : ''} document-review-shell`}>
    <header className="document-review-header print:hidden">
      <Link aria-label="Back to documents" className="button secondary" href="/workspace/documents">←</Link>
      <div className="min-w-0"><p>Document review</p><h1>{title}</h1></div>
      <span className="document-review-status">{currentStatus.replaceAll('_', ' ')}</span>
      <button className="button secondary" onClick={() => setFullScreen((value) => !value)} type="button">{fullScreen ? 'Exit' : 'Full screen'}</button>
    </header>

    <section className="document-review-notice print:hidden" aria-live="polite">
      {decision || (hasRecord
        ? 'PDF, e-signature, change requests and approval are connected to the controlled document record and audit trail.'
        : 'Open this document from Case 360 or Project 360 to activate governed actions.')}
    </section>

    {actionMode === 'sign' && <section className="card stack print:hidden" aria-label="Electronic signature">
      <div><p className="eyebrow">Electronic signature</p><h2>Sign controlled document</h2></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">Signer name<input value={signerName} onChange={(event) => setSignerName(event.target.value)} autoComplete="name" /></label>
        <label className="field">Signer role<input value={signerRole} onChange={(event) => setSignerRole(event.target.value)} placeholder="Engineering reviewer" /></label>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input className="mt-1" type="checkbox" checked={declarationAccepted} onChange={(event) => setDeclarationAccepted(event.target.checked)} />
        <span>I have reviewed this controlled document and intend this action to constitute my electronic signature.</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="button" disabled={isPending} onClick={submitSignature} type="button">{isPending ? 'Signing…' : 'Apply e-signature'}</button>
        <button className="button secondary" disabled={isPending} onClick={() => setActionMode(null)} type="button">Cancel</button>
      </div>
    </section>}

    {actionMode === 'changes' && <section className="card stack print:hidden" aria-label="Request document changes">
      <div><p className="eyebrow">Governed review</p><h2>Request changes</h2></div>
      <label className="field">Required changes<textarea rows={4} value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Describe the amendment and evidence required before resubmission." /></label>
      <div className="flex flex-wrap gap-2">
        <button className="button" disabled={isPending} onClick={submitChangeRequest} type="button">{isPending ? 'Recording…' : 'Submit change request'}</button>
        <button className="button secondary" disabled={isPending} onClick={() => setActionMode(null)} type="button">Cancel</button>
      </div>
    </section>}

    <div className="document-review-flow">{children}</div>

    <div className="document-review-actions print:hidden"><div>
      <button onClick={() => window.print()} type="button">Download PDF</button>
      <button disabled={isPending || !hasRecord || !canRequestChanges} onClick={() => setActionMode('changes')} type="button">Request Changes</button>
      <button disabled={isPending || !hasRecord || !canSign} onClick={() => setActionMode('sign')} type="button">{normalizedStatus === 'signed' ? 'Signed' : 'E-Sign'}</button>
      <button disabled={isPending || !hasRecord || !canApprove || isApproved} onClick={approveDocument} type="button">{isPending ? 'Working…' : isApproved ? 'Approved' : 'Approve'}</button>
    </div></div>
  </div>;
}
