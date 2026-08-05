'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';

export default function MobileDocumentReviewShell({ children, title, status }: { children: ReactNode; title: string; status: string }) {
  const [fullScreen, setFullScreen] = useState(false);
  const [decision, setDecision] = useState('');
  return <div className={fullScreen ? 'fixed inset-0 z-[70] overflow-y-auto bg-[#050705]' : 'min-h-screen bg-[#050705]'}>
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/10 bg-[#050705]/96 px-3 py-3 text-white backdrop-blur print:hidden">
      <Link aria-label="Back to documents" className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10" href="/workspace/documents">←</Link>
      <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold uppercase tracking-[.16em] text-[#b4975a]">Document review</p><h1 className="truncate text-sm font-semibold">{title}</h1></div>
      <span className="hidden rounded-full border border-[#b4975a]/40 bg-[#b4975a]/10 px-3 py-1 text-xs font-semibold text-[#eadbb8] sm:inline">{status}</span>
      <button className="min-h-11 rounded-xl border border-white/10 px-3 text-xs font-semibold" onClick={() => setFullScreen((value) => !value)} type="button">{fullScreen ? 'Exit' : 'Full screen'}</button>
    </header>
    <section className="border-b border-white/10 bg-[#0a0c0a] px-4 py-3 text-white print:hidden"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[#b4975a]/40 bg-[#b4975a]/10 px-3 py-1 text-xs font-semibold text-[#eadbb8] sm:hidden">{status}</span>{decision ? <span className="rounded-full border border-white/15 px-3 py-1 text-xs capitalize">{decision}</span> : null}</div><p className="mt-2 text-xs leading-5 text-white/48">Preview controls do not issue or alter the controlled document.</p></section>
    <div className="document-review-flow">{children}</div>
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#050705]/96 px-3 pb-[max(.6rem,env(safe-area-inset-bottom))] pt-2 text-white backdrop-blur print:hidden"><div className="mx-auto grid max-w-lg grid-cols-4 gap-2"><button className="min-h-12 rounded-xl border border-white/10 text-xs font-semibold" onClick={() => window.print()} type="button">PDF</button><button className="min-h-12 rounded-xl border border-white/10 text-xs font-semibold" onClick={() => setDecision('signed locally')} type="button">Sign</button><button className="min-h-12 rounded-xl border border-white/10 text-xs font-semibold" onClick={() => setDecision('changes requested')} type="button">Review</button><button className="min-h-12 rounded-xl bg-white text-xs font-semibold text-black" onClick={() => setDecision('approved')} type="button">Approve</button></div></div>
    <style jsx global>{`@media screen {.document-review-flow{padding:1rem 1rem 7rem;background:#111411}.document-review-flow>main{margin:0 auto 1rem}}@media print{header,.fixed,.print\\:hidden{display:none!important}.document-review-flow{padding:0;background:white}}`}</style>
  </div>;
}
