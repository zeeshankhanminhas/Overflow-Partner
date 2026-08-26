'use client';

import { useState } from 'react';
import WorkspaceActionButton from './WorkspaceActionButton';

type Props = {
  actionLabel: string;
  pendingLabel?: string;
  confirmationLabel: string;
  consequence: string;
  recovery?: string;
  className?: string;
};

export default function WorkspaceConsequenceGuard({
  actionLabel,
  pendingLabel = 'Applying controlled action…',
  confirmationLabel,
  consequence,
  recovery,
  className = 'button',
}: Props) {
  const [confirmed, setConfirmed] = useState(false);

  return <div className="workspace-consequence-guard">
    <div className="workspace-consequence-guard__summary">
      <small>Consequence</small>
      <strong>{consequence}</strong>
      {recovery ? <p><span>Recovery path</span>{recovery}</p> : null}
    </div>
    <label className="workspace-consequence-guard__confirm">
      <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
      <span>{confirmationLabel}</span>
    </label>
    <WorkspaceActionButton className={className} pendingLabel={pendingLabel} disabled={!confirmed}>{actionLabel}</WorkspaceActionButton>
  </div>;
}
