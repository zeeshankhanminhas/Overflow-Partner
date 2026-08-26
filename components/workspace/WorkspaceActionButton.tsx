'use client';

import { useFormStatus } from 'react-dom';

type Props = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
};

export default function WorkspaceActionButton({
  children,
  pendingLabel = 'Working…',
  className = 'button',
  disabled = false,
}: Props) {
  const { pending } = useFormStatus();

  return <button
    type="submit"
    className={className}
    disabled={disabled || pending}
    aria-busy={pending}
    data-action-state={pending ? 'processing' : disabled ? 'locked' : 'ready'}
  >
    {pending ? <><span className="workspace-action-spinner" aria-hidden="true" />{pendingLabel}</> : children}
  </button>;
}
