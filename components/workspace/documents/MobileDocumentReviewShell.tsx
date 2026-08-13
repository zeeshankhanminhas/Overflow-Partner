'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActionDialog } from '@/components/workspace/InteractionPrimitives';
import {
  approveControlledDocumentAction,
  archiveControlledDocumentAction,
  issueControlledDocumentAction,
  requestDocumentChangesAction,
  signControlledDocumentAction,
  submitControlledDocumentForReviewAction,
} from '@/app/workspace/documents/review-actions';

type ActionMode = 'submit' | 'sign' | 'changes' | 'approve' | 'issue' | 'archive' | null;

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

function contextualOwner(pathname: string) {
  if (pathname.startsWith('/workspace/leads/')) return { label: 'Back to Case 360', kind: 'case' as const };
  if (pathname.startsWith('/workspace/projects/')) return { label: 'Back to Project 360', kind: 'project' as const };
  if (pathname.startsWith('/workspace/commercial-control')) return { label: 'Back to Commercial Control', kind: 'commercial' as const };
  return null;
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
  const [ownerKind, setOwnerKind] = useState<'case' | 'project' | 'commercial' | 'documents'>('documents');

  useEffect(() => {
    const storageKey = documentRecordId ? `op:document-return:${documentRecordId}` : null;
    try {
      if (document.referrer) {
        const source = new URL(document.referrer);
        if (source.origin === window.location.origin) {
          const owner = contextualOwner(source.pathname);
          if (owner) {
            const href = `${source.pathname}${source.search}`;
            setBackHref(href);
            setBackLabel(owner.label);
            setOwnerKind(owner.kind);
            if (storageKey) window.sessionStorage.setItem(storageKey, href);
            return;
          }
        }
      }

      if (storageKey) {
        const storedHref = window.sessionStorage.getItem(storageKey);
        if (storedHref) {
          const stored = new URL(storedHref, window.location.origin);
          const owner = contextualOwner(stored.pathname);
          if (owner) {
            setBackHref(`${stored.pathname}${stored.search}`);
            setBackLabel(owner.label);
            setOwnerKind(owner.kind);
          }
        }
      }
    } catch { /* fall back to document registry */ }
  }, [documentRecordId]);

  const normalizedStatus = currentStatus.toLowerCase();
  const hasRecord = Boolean(documentRecordId);
  const canSubmitForReview = ['draft', 'changes_requested'].includes(normalizedStatus);
  const canSign = normalizedStatus === 'in_review';
  const canRequestChanges = ['in_review', 'signed'].includes(normalizedStatus);
  const canApprove = normalizedStatus === 'signed';
  const canIssue = normalizedStatus === 'approved';
  const canArchive = ['issued', 'published'].includes(normalizedStatus);
  const isIssued = ['issued', 'published'].includes(normalizedStatus);
  const isArchived = normalizedStatus === 'archived';

  function scrollToId(id: string, delay = 40) {
    window.setTimeout(() => reveal(document.getElementById(id)), delay);
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

  function operationalReturnHref(message:string) {
    const url = new URL(backHref, window.location.origin);
    url.searchParams.set('success', message);
    if (ownerKind === 'case' || ownerKind === 'project') url.searchParams.set('focus', 'record-next-action');
    if (ownerKind === 'commercial') url.searchParams.set('focus', 'financial-gate');
    return `${url.pathname}${url.search}`;
  }

  async function runAction(label: string, action: () => Promise<{ ok: boolean; message: string; status?: string }>, onSuccess?: (status: string, message:string) => void) {
    setDecision(label);
    setIsPending(true);
    try {
      const result = await action();
      setDecision(result.message);
      if (result.ok && result.status) {
        setCurrentStatus(result.status);
        setActionMode(null);
        router.refresh();
        onSuccess?.(result.status, result.message);
      } else {
        scrollToId('document-review-feedback');
      }
    } catch (error) {
      setDecision(error instanceof Error ? error.message : 'The document action could not be completed.');
      scrollToId('document-review-feedback');
    } finally {
      setIsPending(false);
    }
  }

  function returnToOperationalOwner(message:string) {
    if (ownerKind === 'case' || ownerKind === 'project' || ownerKind === 'commercial') {
      router.push(operationalReturnHref(message));
      return true;
    }
    return false;
  }

  async function submitForReview() {
    if (!requireRecord() || !documentRecordId) return;
    await runAction('Submitting for controlled review…', () => submitControlledDocumentForReviewAction(documentRecordId), () => scrollToId('document-review-status', 120));
  }

  async function submitSignature() {
    setDecision('');
    if (!requireRecord() || !documentRecordId) return;
    if (!signerName.trim()) { setDecision('Enter the signer name before applying the electronic signature.'); return; }
    if (!signerRole.trim()) { setDecision('Enter the signer role before applying the electronic signature.'); return; }
    if (!declarationAccepted) { setDecision('Accept the electronic-signature declaration before continuing.'); return; }
    await runAction('Applying electronic signature…', () => signControlledDocumentAction(documentRecordId, signerName, signerRole, declarationAccepted), () => scrollToSignatureEvidence());
  }

  async function submitChangeRequest() {
    setDecision('');
    if (!requireRecord() || !documentRecordId) return;
    if (!changeReason.trim()) { setDecision('Describe the required changes before submitting the request.'); return; }
    await runAction('Recording change request…', () => requestDocumentChangesAction(documentRecordId, changeReason), () => scrollToId('document-review-feedback', 120));
    setChangeReason('');
  }

  async function approveDocument() {
    if (!requireRecord() || !documentRecordId) return;
    await runAction('Approving document…', () => approveControlledDocumentAction(documentRecordId), (_status,message) => {
      if (!returnToOperationalOwner(message)) scrollToId('document-review-status', 120);
    });
  }

  async function issueDocument() {
    if (!requireRecord() || !documentRecordId) return;
    await runAction('Issuing document…', () => issueControlledDocumentAction(documentRecordId), (_status,message) => {
      if (!returnToOperationalOwner(message)) scrollToId('document-review-status', 120);
    });
  }

  async function archiveDocument() {
    if (!requireRecord() || !documentRecordId) return;
    await runAction('Archiving controlled document…', () => archiveControlledDocumentAction(documentRecordId), (_status,message) => {
      if (!returnToOperationalOwner(message)) scrollToId('document-review-status', 120);
    });
  }

  const setDialog=(mode:Exclude<ActionMode,null>)=>(open:boolean)=>setActionMode(open?mode:null);

  return <div className={`${fullScreen ? 'fixed inset-0 z-[70] overflow-y-auto' : ''} document-review-shell`}>
    <header className="document-review-header print:hidden">
      <Link aria-label={backLabel} title={backLabel} className="button secondary" href={backHref}>←</Link>
      <div className="min-w-0"><p>Document review</p><h1>{title}</h1></div>
      <span id="document-review-status" className="document-review-status">{currentStatus.replaceAll('_', ' ')}</span>
      <button className="button secondary desktop-review-control" onClick={() => setFullScreen((value) => !value)} type="button">{fullScreen ? 'Exit' : 'Full screen'}</button>
    </header>

    <section id="document-review-feedback" className="document-review-notice print:hidden" aria-live="polite">
      {decision || (hasRecord
        ? isArchived ? 'This controlled revision is archived. Its issued evidence remains in the audit trail.'
          : isIssued ? 'This document has been issued. Archive it when the controlled revision is no longer active.'
          : canSubmitForReview ? 'Submit this revision for controlled review when the evidence is ready.'
          : 'Review the document and complete the next permitted action.'
        : 'Open this document from Case 360 or Project 360 to activate document actions.')}
    </section>

    <div className="mobile-document-mode">{mobileReview}</div>
    <div className="document-review-flow desktop-document-mode">{children}</div>

    <div className="document-review-actions print:hidden"><div>
      <button onClick={() => window.print()} type="button">Print / Save PDF</button>

      {canSubmitForReview ? <ActionDialog title="Submit for controlled review" description="This moves the current controlled revision into the governed review state. The document remains the same authoritative record." triggerLabel="Submit for Review" disabled={isPending||!hasRecord} open={actionMode==='submit'} onOpenChange={setDialog('submit')}><div className="stack"><p>Submit this revision for controlled review?</p><button className="button" disabled={isPending} onClick={submitForReview} type="button">{isPending?'Submitting…':'Submit for Review'}</button></div></ActionDialog> : null}

      {canRequestChanges ? <ActionDialog title="Request document changes" description="Describe what must change before this controlled revision can continue." triggerLabel="Request Changes" disabled={isPending||!hasRecord} open={actionMode==='changes'} onOpenChange={setDialog('changes')}><div className="stack"><label className="field">Required changes<textarea rows={4} value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Describe what needs to change before resubmission." /></label>{decision&&actionMode==='changes'?<p aria-live="polite">{decision}</p>:null}<button className="button" disabled={isPending} onClick={submitChangeRequest} type="button">{isPending?'Recording…':'Submit change request'}</button></div></ActionDialog> : null}

      {canSign ? <ActionDialog title="Sign controlled document" description="Apply your electronic signature to the exact controlled revision currently under review." triggerLabel="E-Sign" disabled={isPending||!hasRecord} open={actionMode==='sign'} onOpenChange={setDialog('sign')}><div className="stack"><div className="grid gap-4 md:grid-cols-2"><label className="field">Signer name<input value={signerName} onChange={(event) => setSignerName(event.target.value)} autoComplete="name" /></label><label className="field">Signer role<input value={signerRole} onChange={(event) => setSignerRole(event.target.value)} placeholder="Engineering reviewer" /></label></div><label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={declarationAccepted} onChange={(event) => setDeclarationAccepted(event.target.checked)} /><span>I have reviewed this document and intend this action to constitute my electronic signature.</span></label>{decision&&actionMode==='sign'?<p aria-live="polite">{decision}</p>:null}<button className="button" disabled={isPending} onClick={submitSignature} type="button">{isPending?'Signing…':'Apply e-signature'}</button></div></ActionDialog> : null}

      {canApprove ? <ActionDialog title="Approve controlled document" description="Record the authorised approval of this signed controlled revision." triggerLabel="Approve" disabled={isPending||!hasRecord} open={actionMode==='approve'} onOpenChange={setDialog('approve')}><div className="stack"><p>Approval will become governed evidence on this document and its owning workflow.</p><button className="button" disabled={isPending} onClick={approveDocument} type="button">{isPending?'Approving…':'Approve document'}</button></div></ActionDialog> : null}

      {canIssue ? <ActionDialog title="Issue controlled document" description="Issue the approved controlled revision. The issued state becomes authoritative evidence for downstream workflow gates." triggerLabel="Issue" disabled={isPending||!hasRecord} open={actionMode==='issue'} onOpenChange={setDialog('issue')}><div className="stack"><p>Issue this approved revision now?</p><button className="button" disabled={isPending} onClick={issueDocument} type="button">{isPending?'Issuing…':'Issue document'}</button></div></ActionDialog> : null}

      {canArchive ? <ActionDialog title="Archive controlled document" description="Archive this issued revision when it is no longer the active controlled record. Issued evidence remains in audit." triggerLabel="Archive" disabled={isPending||!hasRecord} open={actionMode==='archive'} onOpenChange={setDialog('archive')}><div className="stack"><p>Archive this controlled revision?</p><button className="button" disabled={isPending} onClick={archiveDocument} type="button">{isPending?'Archiving…':'Archive document'}</button></div></ActionDialog> : null}
    </div></div>
  </div>;
}
