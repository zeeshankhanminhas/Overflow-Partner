'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { primaryNavigation } from '@/lib/presentation/navigationContract';
import WorkspaceOperatorCentre from './WorkspaceOperatorCentre';
import WorkspaceIcon from './WorkspaceIcon';

type SurfaceKind = 'drawer' | 'modal' | 'window';
type ToastTone = 'success' | 'error' | 'info';

export type WorkspaceAlert = {
  id: string;
  kind: 'approval' | 'exception';
  title: string;
  detail: string;
  href: string;
  meta: string;
  tone: 'critical' | 'high' | 'medium' | 'low' | 'ready';
};

type SurfaceState = {
  kind: SurfaceKind;
  title: string;
  eyebrow?: string;
  description?: string;
  content: ReactNode;
  footer?: ReactNode;
} | null;

type Toast = {
  id: number;
  message: string;
  detail?: string;
  tone: ToastTone;
};

type WorkspaceInteractionContextValue = {
  openDrawer: (surface: Omit<NonNullable<SurfaceState>, 'kind'>) => void;
  openModal: (surface: Omit<NonNullable<SurfaceState>, 'kind'>) => void;
  openWindow: (surface: Omit<NonNullable<SurfaceState>, 'kind'>) => void;
  closeSurface: () => void;
  notify: (message: string, options?: { detail?: string; tone?: ToastTone }) => void;
};

const WorkspaceInteractionContext = createContext<WorkspaceInteractionContextValue | null>(null);

export function useWorkspaceInteractions() {
  const context = useContext(WorkspaceInteractionContext);
  if (!context) throw new Error('useWorkspaceInteractions must be used inside WorkspaceInteractionProvider');
  return context;
}

export function WorkspaceInteractionProvider({ children }: { children: ReactNode }) {
  const [surface, setSurface] = useState<SurfaceState>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const toastSequence = useRef(0);
  const titleId = useId();
  const descriptionId = useId();

  const restoreFocus = useCallback(() => {
    const opener = openerRef.current;
    openerRef.current = null;
    if (!opener?.isConnected) return;
    window.requestAnimationFrame(() => opener.focus({ preventScroll: true }));
  }, []);

  const closeSurface = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else {
      setSurface(null);
      restoreFocus();
    }
  }, [restoreFocus]);

  const openSurface = useCallback((kind: SurfaceKind, next: Omit<NonNullable<SurfaceState>, 'kind'>) => {
    if (!dialogRef.current?.open) openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSurface({ ...next, kind });
  }, []);

  const notify = useCallback((message: string, options?: { detail?: string; tone?: ToastTone }) => {
    const id = ++toastSequence.current;
    setToasts((current) => [...current, { id, message, detail: options?.detail, tone: options?.tone ?? 'success' }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!surface || !dialog || dialog.open) return;
    dialog.showModal();
  }, [surface]);

  useEffect(() => {
    if (!surface) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [surface]);

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<{ message?: string; detail?: string; tone?: ToastTone }>).detail;
      if (detail?.message) notify(detail.message, { detail: detail.detail, tone: detail.tone });
    }
    function onClose() { closeSurface(); }
    window.addEventListener('workspace:toast', onToast);
    window.addEventListener('workspace-interaction-complete', onClose);
    return () => {
      window.removeEventListener('workspace:toast', onToast);
      window.removeEventListener('workspace-interaction-complete', onClose);
    };
  }, [closeSurface, notify]);

  const value = useMemo<WorkspaceInteractionContextValue>(() => ({
    openDrawer: (next) => openSurface('drawer', next),
    openModal: (next) => openSurface('modal', next),
    openWindow: (next) => openSurface('window', next),
    closeSurface,
    notify,
  }), [closeSurface, notify, openSurface]);

  return <WorkspaceInteractionContext.Provider value={value}>
    {children}
    {surface ? <dialog
      ref={dialogRef}
      className={`workspace-overlay workspace-overlay--${surface.kind}`}
      aria-labelledby={titleId}
      aria-describedby={surface.description ? descriptionId : undefined}
      onClose={() => { setSurface(null); restoreFocus(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeSurface(); }}
    >
      <section className="workspace-overlay__frame">
        <header className="workspace-overlay__header">
          <div>
            {surface.eyebrow ? <p>{surface.eyebrow}</p> : null}
            <h2 id={titleId}>{surface.title}</h2>
            {surface.description ? <span id={descriptionId}>{surface.description}</span> : null}
          </div>
          <button type="button" className="workspace-overlay__close" onClick={closeSurface} aria-label={`Close ${surface.title}`}><WorkspaceIcon name="close" /></button>
        </header>
        <div className="workspace-overlay__body">{surface.content}</div>
        {surface.footer ? <footer className="workspace-overlay__footer">{surface.footer}</footer> : null}
      </section>
    </dialog> : null}
    <div className="workspace-toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'} className={`workspace-toast workspace-toast--${toast.tone}`}>
        <div className="workspace-toast__mark" aria-hidden="true"><WorkspaceIcon name={toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'error' : 'info'} /></div>
        <div><strong>{toast.message}</strong>{toast.detail ? <span>{toast.detail}</span> : null}</div>
        <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss notification"><WorkspaceIcon name="close" size={16} /></button>
      </div>)}
    </div>
  </WorkspaceInteractionContext.Provider>;
}

export function WorkspaceShellActions({ alerts = [] }: { alerts?: WorkspaceAlert[] }) {
  const { openDrawer, openModal, openWindow, closeSurface } = useWorkspaceInteractions();
  const n = primaryNavigation;

  const quickLinks = <div className="workspace-quick-grid">
    <Link href={n.enquiries.href} onClick={closeSurface}><span>{n.enquiries.label}</span><small>Review incoming requirements</small></Link>
    <Link href={n.cases.href} onClick={closeSurface}><span>{n.cases.label}</span><small>Open commercial work</small></Link>
    <Link href={n.projects.href} onClick={closeSurface}><span>{n.projects.label}</span><small>Control active delivery</small></Link>
    <Link href={n.payments.href} onClick={closeSurface}><span>Finance</span><small>Payments and commercial control</small></Link>
  </div>;

  const openWorkCentre = useCallback(() => openWindow({
    eyebrow: 'Operator productivity',
    title: 'Work Centre',
    description: 'Resume work, keep important records close and act on live operating attention without navigating module-by-module.',
    content: <WorkspaceOperatorCentre alerts={alerts} onNavigate={closeSurface} />,
  }), [alerts, closeSurface, openWindow]);

  const alertContent = <div className="workspace-notification-drawer">
    {alerts.length ? <div className="workspace-alert-list">{alerts.map((alert) => <Link key={alert.id} href={alert.href} onClick={closeSurface} className={`workspace-alert workspace-alert--${alert.tone}`}><span className="workspace-alert__mark" aria-hidden="true"><WorkspaceIcon name={alert.kind === 'approval' ? 'check' : 'error'} size={16}/></span><span className="workspace-alert__body"><strong>{alert.title}</strong><small>{alert.detail}</small><em>{alert.meta}</em></span><span className="workspace-alert__open" aria-hidden="true"><WorkspaceIcon name="arrow" size={16}/></span></Link>)}</div> : <div className="workspace-notification-empty"><span><WorkspaceIcon name="check" size={18}/></span><strong>No unresolved operational alerts</strong><p>Approval and exception queues are currently clear.</p></div>}
    <div className="workspace-alert-footer"><Link href={n.approvals.href} onClick={closeSurface} className="button secondary">Approvals</Link><Link href={n.issues.href} onClick={closeSurface} className="button secondary">Issues</Link></div>
  </div>;

  const openAlerts = useCallback(() => openDrawer({
    eyebrow: 'Operating alerts',
    title: alerts.length ? `${alerts.length} item${alerts.length === 1 ? '' : 's'} need attention` : 'Operational notifications',
    description: 'Authority decisions and off-plan exceptions from the live workspace.',
    content: alertContent,
  }), [alerts.length, alertContent, openDrawer]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'w') { event.preventDefault(); openWorkCentre(); }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'a') { event.preventDefault(); openAlerts(); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [openAlerts, openWorkCentre]);

  return <div className="workspace-shell-actions">
    <button type="button" className="workspace-shell-action" onClick={() => openModal({ eyebrow: 'Workspace', title: 'Quick actions', description: 'Move into the next piece of operational work without losing context.', content: quickLinks })}><WorkspaceIcon name="add" /><span>Quick</span></button>
    <button type="button" className="workspace-shell-action" onClick={openWorkCentre} title="Ctrl/⌘ Shift W"><WorkspaceIcon name="work" /><span>Work centre</span></button>
    <button type="button" className="workspace-shell-action workspace-shell-action--bell" onClick={openAlerts} title="Ctrl/⌘ Shift A" aria-label={`Open operating alerts${alerts.length ? `, ${alerts.length} unresolved` : ''}`}><WorkspaceIcon name="alerts" /><span>Alerts</span>{alerts.length ? <b className="workspace-alert-count">{alerts.length > 99 ? '99+' : alerts.length}</b> : null}</button>
  </div>;
}

export function emitWorkspaceToast(message: string, options?: { detail?: string; tone?: ToastTone }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('workspace:toast', { detail: { message, ...options } }));
}
