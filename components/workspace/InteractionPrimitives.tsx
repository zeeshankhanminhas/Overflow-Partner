'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

type TriggerTone = 'primary' | 'secondary' | 'quiet';

type OverlayProps = {
  title: string;
  description?: ReactNode;
  triggerLabel: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  triggerTone?: TriggerTone;
  triggerClassName?: string;
};

function triggerClass(tone: TriggerTone, extra = '') {
  const base = tone === 'primary' ? 'button' : tone === 'secondary' ? 'button secondary' : 'op-interaction-trigger--quiet';
  return `${base} ${extra}`.trim();
}

function useOverlay(open: boolean, close: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter(item => item.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      requestAnimationFrame(() => trigger?.focus());
    };
  }, [open, close]);

  return { panelRef, triggerRef };
}

export function ActionDialog({
  title,
  description,
  triggerLabel,
  children,
  disabled = false,
  triggerTone = 'primary',
  triggerClassName = '',
}: OverlayProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const close = () => setOpen(false);
  const { panelRef, triggerRef } = useOverlay(open, close);

  return <>
    <button ref={triggerRef} type="button" className={triggerClass(triggerTone, triggerClassName)} disabled={disabled} onClick={() => setOpen(true)}>{triggerLabel}</button>
    {open ? <div className="op-overlay op-dialog-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={panelRef} className="op-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
        <header className="op-interaction-header">
          <div><h2 id={titleId}>{title}</h2>{description ? <div id={descriptionId} className="op-interaction-description">{description}</div> : null}</div>
          <button type="button" className="op-interaction-close" onClick={close} aria-label="Close dialog">×</button>
        </header>
        <div className="op-interaction-body">{children}</div>
      </div>
    </div> : null}
  </>;
}

export function ContextDrawer({
  title,
  description,
  triggerLabel,
  children,
  disabled = false,
  triggerTone = 'secondary',
  triggerClassName = '',
}: OverlayProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const close = () => setOpen(false);
  const { panelRef, triggerRef } = useOverlay(open, close);

  return <>
    <button ref={triggerRef} type="button" className={triggerClass(triggerTone, triggerClassName)} disabled={disabled} onClick={() => setOpen(true)}>{triggerLabel}</button>
    {open ? <div className="op-overlay op-drawer-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <aside ref={panelRef} className="op-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
        <header className="op-interaction-header">
          <div><h2 id={titleId}>{title}</h2>{description ? <div id={descriptionId} className="op-interaction-description">{description}</div> : null}</div>
          <button type="button" className="op-interaction-close" onClick={close} aria-label="Close panel">×</button>
        </header>
        <div className="op-interaction-body">{children}</div>
      </aside>
    </div> : null}
  </>;
}

export function ProductDisclosure({ summary, children, className = '' }: { summary: ReactNode; children: ReactNode; className?: string }) {
  return <details className={`op-disclosure ${className}`.trim()}><summary>{summary}</summary><div className="op-disclosure__body">{children}</div></details>;
}

export function EvidenceRow({ label, value, meta, tone = 'neutral' }: { label: ReactNode; value: ReactNode; meta?: ReactNode; tone?: 'neutral' | 'complete' | 'waiting' | 'attention' }) {
  return <div className={`op-evidence-row op-evidence-row--${tone}`} data-tone={tone}>
    <span className="op-evidence-row__label">{label}</span>
    <strong>{value}</strong>
    {meta ? <span className="op-evidence-row__meta">{meta}</span> : null}
  </div>;
}

export function ActionMenu({ label = 'More', children }: { label?: ReactNode; children: ReactNode }) {
  return <details className="op-action-menu"><summary className="button secondary">{label}</summary><div className="op-action-menu__panel">{children}</div></details>;
}

export function ActionMenuLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="op-action-menu__item" href={href}>{children}</Link>;
}

export function InteractionToast({ children, urgent = false }: { children: ReactNode; urgent?: boolean }) {
  return <div className="op-interaction-toast" role={urgent ? 'alert' : 'status'} aria-live={urgent ? 'assertive' : 'polite'}>{children}</div>;
}

export function WorkingAreaTabs({ items, current }: { items: Array<{ label: string; href: string; key: string }>; current: string }) {
  return <nav className="op-working-tabs" aria-label="Record working areas">
    {items.map(item => <Link key={item.key} href={item.href} aria-current={item.key === current ? 'page' : undefined} className={item.key === current ? 'is-current' : ''}>{item.label}</Link>)}
  </nav>;
}
