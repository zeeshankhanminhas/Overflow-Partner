'use client';

import { useTransition } from 'react';

export default function PendingActionForm({
  action,
  children,
  className,
  pendingLabel = 'Updating record…',
}: {
  action: (data: FormData) => Promise<void>;
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const [pending, startTransition] = useTransition();

  return <form
    className={className}
    aria-busy={pending}
    data-form-state={pending ? 'processing' : 'ready'}
    onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      startTransition(async () => {
        await action(data);
        window.dispatchEvent(new CustomEvent('workspace-interaction-complete'));
      });
    }}
  >
    <fieldset disabled={pending} style={{ border:0, padding:0, margin:0, minInlineSize:0, display:'contents' }}>{children}</fieldset>
    {pending ? <div className="workspace-form-progress" role="status" aria-live="polite"><span className="workspace-action-spinner" aria-hidden="true" /><div><strong>{pendingLabel}</strong><small>Please keep this window open while the governed action completes.</small></div></div> : null}
  </form>;
}
