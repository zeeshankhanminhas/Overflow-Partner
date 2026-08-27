'use client';

import { useEffect, type ReactNode } from 'react';
import { useWorkspaceInteractions } from './WorkspaceInteractionProvider';

type InteractionKind = 'drawer' | 'dialog' | 'window';

type InteractionSurfaceProps = {
  kind: InteractionKind;
  triggerLabel: string;
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  disabled?: boolean;
  defaultOpen?: boolean;
};

function InteractionSurface({
  kind,
  triggerLabel,
  title,
  eyebrow,
  description,
  children,
  footer,
  triggerClassName = 'button secondary',
  triggerAriaLabel,
  disabled = false,
  defaultOpen = false,
}: InteractionSurfaceProps) {
  const { openDrawer, openModal, openWindow } = useWorkspaceInteractions();

  function open() {
    const surface = { title, eyebrow, description, content: children, footer };
    if (kind === 'drawer') openDrawer(surface);
    else if (kind === 'window') openWindow(surface);
    else openModal(surface);
  }

  useEffect(() => {
    if (defaultOpen) open();
    // defaultOpen is intentionally a one-time route/state affordance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpen]);

  return <button
    type="button"
    className={triggerClassName}
    onClick={open}
    aria-label={triggerAriaLabel || triggerLabel}
    disabled={disabled}
    data-interaction-trigger={kind}
  >
    {triggerLabel}
  </button>;
}

export function WorkspaceDrawer(props: Omit<InteractionSurfaceProps, 'kind'>) {
  return <InteractionSurface {...props} kind="drawer" />;
}

export function DecisionDialog(props: Omit<InteractionSurfaceProps, 'kind'>) {
  return <InteractionSurface {...props} kind="dialog" />;
}

export function WorkWindow(props: Omit<InteractionSurfaceProps, 'kind'>) {
  return <InteractionSurface {...props} kind="window" />;
}

export function ContextActions({ children, label = 'Record context' }: { children: ReactNode; label?: string }) {
  return <div className="interaction-context-actions" aria-label={label}>{children}</div>;
}

export function InteractionFacts({ children }: { children: ReactNode }) {
  return <div className="interaction-facts">{children}</div>;
}

export function InteractionFact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="interaction-fact"><small>{label}</small><strong>{children}</strong></div>;
}
