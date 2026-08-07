'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  approveControlledDocumentAction,
  issueControlledDocumentAction,
  requestDocumentChangesAction,
  signControlledDocumentAction,
} from '@/app/workspace/documents/review-actions';

type ActionMode = 'sign' | 'changes' | null;

function reveal(target: HTMLElement | null, focus = true) {
  if (!target) return;
  target.setAttribute('tabindex', '-1');
  target.classList.add('continuity-highlight');
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    if (focus) window.setTimeout(() => target.focus({ preventScroll: true }), 320);
  });
  window.setTimeout(() => target.classList.remove('continuity-highlight'), 2600);
}

export default function MobileDocumentReviewShell({ children, mobileReview, title, status, documentRecordId }: {
  children: ReactNode;
  mobileReview: ReactNode;
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
  const [backHref, setBackHref] = useState('/workspace/documents');
  const [backLabel, setBackLabel] = useState('Back to documents');

  useEffect(() => {
    try {
      if (!document.referrer) return;
      const source = new URL(document.referrer);
      if (source.origin !== window.location.origin) return;
      if (source.pathname.startsWith('/workspace/leads/')) { setBackHref(`${source.pathname}${source.search}`); setBackLabel('Back to Case 360'); }
      else if (source.pathname.startsWith('/workspace/projects/')) { setBackHref(`${source.pathname}${source.search}`); setBackLabel('Back to Project 360'); }
      else if (source.pathname.startsWith('/workspace/commercial-control')) { setBackHref(`${source.pathname}${source.search}`); setBackLabel('Back to Commercial Control'); }
    } catch { /* fall back to document registry */ }
  }, []);

  const normalizedStatus = currentStatus.toLowerCase();
  const hasRecord = Boolean(documentRecordId);
  const canSign = ['draft', 'in_review', 'changes_requested'].includes(normalizedStatus);
  const canRequestChanges = ['draft', 'in_review', 'signed'].includes(normalizedStatus);
  const canApprove = normalizedStatus === 'signed';
  const canIssue = normalizedStatus === 'approved';
  const isApproved = ['approved', 'issued', 'published'].includes(normalizedStatus);
  const isIssued = ['issued', 'published'].includes(normalizedStatus);

  function scrollToId(id: string, delay = 40) {
    window.setTimeout(() => reveal(document.getElementById(id)), delay);
  }

  function openAction(mode: Exclude<ActionMode, null>) {
    setDecision('');
    setActionMode(mode);
    scrollToId(mode === 'sign' ? 'document-sign-action' : 'document-change-action', 60);
  }

  function requireRecord() {
    if (documentRecordId) return true;
    setDecision('This preview is not connected to a controlled document record. Open it from Case 360 or Project 360.');
    scrollToId('document-review-feedback');
    return false;
  }

  function scrollToSignatureEvidence() {
    let settled = false;
    const findVisibleSignature = () => Array.from(document.querySelectorAll<HTMLElement>('.signature-evidence-block')).find((element) => element.offsetParent !== null);
    const show = (target: HTMLElement) => { if (settled) return; settled = true; reveal(target); };
    const observer = new MutationObserver(() => { const target = findVisibleSignature(); if (target) { observer.disconnect(); show(target); } });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => { if (settled) return; const target = findVisibleSignature(); if (target) show(target); }, 250);
    window.setTimeout(() => observer.disconnect(), 5000);
  }

  async function runAction(label: string, action: () => Promise<{ ok: boolean; message: string; status?: string }>, onSuccess?: () => void) {
    setDecision(label);
    setIsPending(true);
    try {
      const result = await action();
      setDecision(result.message);
      if (result.ok && result.status) {
        setCurrentStatus(result.status);
        setActionMode(null);
        router.refresh();
        onSuccess?.();
      } else {
        scrollToId('document-review-feedback');
      }
    } catch (error) {
      setDecision(error instanceof Error ? error.message : 'The governed document action failed.');
      scrollToId('document-review-feedback');
    } finally {
      setIsPending(false);
    }
  }

  async function submitSignature() {
    setDecision('');
    if (!requireRecord() || !documentRecordId) return;
    if (!signerName.trim()) { setDecision('Enter the signer name before applying the electronic signature.'); scrollToId('document-signer-name'); return; }
    if (!signerRole.trim()) { setDecision('Enter the signer role before applying the electronic signature.'); scrollToId('document-signer-role'); return; }
    if (!declarationAccepted) { setDecision('Accept the electronic-signature declaration before continuing.'); scrollToId('document-signature-declaration'); return; }
    await runAction('Applying electronic signature…', () => signControlledDocumentAction(documentRecordId, signerName, signerRole, declarationAccepted), scrollToSignatureEvidence);
  }

  async function submitChangeRequest() {
    setDecision('');
    if (!requireRecord() || !documentRecordId) return;
    if (!changeReason.trim()) { setDecision('Describe the required changes before submitting the request.'); scrollToId('document-change-reason'); return; }
    await runAction('Recording change request…', () => requestDocumentChangesAction(documentRecordId, changeReason), () => scrollToId('document-review-feedback', 120));
    setChangeReason('');
  }

  async function approveDocument() {
    if (!requireRecord() || !documentRecordId) return;
    await runAction('Approving controlled document…', () => approveControlledDocumentAction(documentRecordId), () => scrollToId('document-review-status', 120));
  }

  async function issueDocument() {
    if (!requireRecord() || !documentRecordId) return;
    await runAction('Issuing controlled document…', () => issueControlledDocumentAction(documentRecordId), () => scrollToId('document-review-status', 120));
  }

  return <div className={`${fullScreen ? 'fixed inset-0 z-[70] overflow-y-auto' : ''} document-review-shell`}>
    <header className="document-review-header print:hidden">
      <Link aria-label={backLabel} title={backLabel} className="button secondary" href={backHref}>←</Link>
      <div className="min-w-0"><p>Document review</p><h1>{title}</h1></div>
      <span id="document-review-status" className="document-review-status">{currentStatus.replaceAll('_', ' ')}</span>
      <button className="button secondary desktop-review-control" onClick={() => setFullScreen((value) => !value)} type="button">{fullScreen ? 'Exit' : 'Full screen'}</button>
    </header>

    <section id="document-review-feedback" className="document-review-notice print:hidden" aria-live="polite">
      {decision || (hasRecord
        ? isIssued ? 'This is the issued controlled publication. Commercial progression may continue.' : 'Review the live evidence and complete the next permitted controlled action.'
        : 'Open this document from Case 360 or Project 360 to activate governed actions.')}
    </section>

    {actionMode === 'sign' && <section id="document-sign-action" className="card stack print:hidden" aria-label="Electronic signature">
      <div><p className="eyebrow">Electronic signature</p><h2>Sign controlled document</h2></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">Signer name<input id="document-signer-name" value={signerName} onChange={(event) => setSignerName(event.target.value)} autoComplete="name" /></label>
        <label className="field">Signer role<input id="document-signer-role" value={signerRole} onChange={(event) => setSignerRole(event.target.value)} placeholder="Engineering reviewer" /></label>
      </div>
      <label id="document-signature-declaration" className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={declarationAccepted} onChange={(event) => setDeclarationAccepted(event.target.checked)} /><span>I have reviewed this controlled document and intend this action to constitute my electronic signature.</span></label>
      <div className="flex flex-wrap gap-2"><button className="button" disabled={isPending} onClick={submitSignature} type="button">{isPending ? 'Signing…' : 'Apply e-signature'}</button><button className="button secondary" disabled={isPending} onClick={() => setActionMode(null)} type="button">Cancel</button></div>
    </section>}

    {actionMode === 'changes' && <section id="document-change-action" className="card stack print:hidden" aria-label="Request document changes">
      <div><p className="eyebrow">Governed review</p><h2>Request changes</h2></div>
      <label className="field">Required changes<textarea id="document-change-reason" rows={4} value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Describe the amendment and evidence required before resubmission." /></label>
      <div className="flex flex-wrap gap-2"><button className="button" disabled={isPending} onClick={submitChangeRequest} type="button">{isPending ? 'Recording…' : 'Submit change request'}</button><button className="button secondary" disabled={isPending} onClick={() => setActionMode(null)} type="button">Cancel</button></div>
    </section>}

    <div className="mobile-document-mode">{mobileReview}</div>
    <div className="document-review-flow desktop-document-mode">{children}</div>

    <div className="document-review-actions print:hidden"><div>
      <button onClick={() => window.print()} type="button">Print / Save PDF</button>
      <button disabled={isPending || !hasRecord || !canRequestChanges} onClick={() => openAction('changes')} type="button">Request Changes</button>
      <button disabled={isPending || !hasRecord || !canSign} onClick={() => openAction('sign')} type="button">E-Sign</button>
      <button disabled={isPending || !hasRecord || !canApprove || isApproved} onClick={approveDocument} type="button">{isApproved ? 'Approved' : 'Approve'}</button>
      <button disabled={isPending || !hasRecord || !canIssue || isIssued} onClick={issueDocument} type="button">{isIssued ? 'Issued' : 'Issue'}</button>
    </div></div>
  </div>;
}
