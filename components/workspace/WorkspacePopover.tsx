'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type PopoverProps = {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  label?: string;
};

export function WorkspacePopover({ trigger, children, align = 'end', label = 'Context options' }: PopoverProps) {
  const rootRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (root?.open && !root.contains(event.target as Node)) root.open = false;
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return <details ref={rootRef} className={`workspace-popover workspace-popover--${align}`}>
    <summary aria-label={label}>{trigger}</summary>
    <div className="workspace-popover__panel">{children}</div>
  </details>;
}

type LockedActionProps = {
  label: string;
  reason: string;
  requirements?: Array<{ label: string; complete: boolean }>;
};

export function LockedAction({ label, reason, requirements = [] }: LockedActionProps) {
  return <WorkspacePopover
    align="end"
    label={`Why ${label} is unavailable`}
    trigger={<span className="workspace-locked-action" role="button" tabIndex={0} aria-disabled="true">{label}<span aria-hidden="true">⌁</span></span>}
  >
    <div className="workspace-lock-card">
      <small>Action locked</small>
      <strong>{label}</strong>
      <p>{reason}</p>
      {requirements.length ? <ul>{requirements.map((item) => <li key={item.label} className={item.complete ? 'is-complete' : ''}><span aria-hidden="true">{item.complete ? '✓' : '○'}</span>{item.label}</li>)}</ul> : null}
    </div>
  </WorkspacePopover>;
}
