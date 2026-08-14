'use client';

import { useId, useRef, type ReactNode } from 'react';

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
}: InteractionSurfaceProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  function open() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return <>
    <button
      type="button"
      className={triggerClassName}
      onClick={open}
      aria-label={triggerAriaLabel || triggerLabel}
      disabled={disabled}
      data-interaction-trigger={kind}
    >
      {triggerLabel}
    </button>

    <dialog
      ref={dialogRef}
      className={`interaction-surface interaction-surface--${kind}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="interaction-surface__frame">
        <header className="interaction-surface__header">
          <div className="interaction-surface__heading">
            {eyebrow ? <p>{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
            {description ? <span id={descriptionId}>{description}</span> : null}
          </div>
          <button type="button" className="interaction-surface__close" onClick={close} aria-label={`Close ${title}`}>×</button>
        </header>

        <div className="interaction-surface__body">{children}</div>
        {footer ? <footer className="interaction-surface__footer">{footer}</footer> : null}
      </div>
    </dialog>
  </>;
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
