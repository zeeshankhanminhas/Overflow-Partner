'use client';

import { useState } from 'react';

export default function Step2TestLink({ url, outreach = false }: { url: string; outreach?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="vp-callout" style={{ marginTop: 12 }}>
      <strong>{outreach ? 'Secure requirements link ready' : 'Developer test link ready'}</strong>
      <p style={{ marginBottom: 12 }}>
        {outreach ? 'Copy this link into the LinkedIn conversation. It is shown only now; the workspace stores only its secure hash.' : 'Use this secure Step 2 link to test the customer-facing technical intake without relying on email delivery. The raw token is shown only on this return step and is not stored in the workspace.'}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a className="button" href={url} target="_blank" rel="noreferrer">Open secure form</a>
        <button className="button secondary" type="button" onClick={copyLink}>{copied ? 'Copied' : 'Copy secure link'}</button>
      </div>
    </div>
  );
}
