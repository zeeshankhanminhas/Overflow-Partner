'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type SurfaceKind = 'drawer' | 'modal' | 'window';
type ToastTone = 'success' | 'error' | 'info';

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
  const toastSequence = useRef(0);

  const closeSurface = useCallback(() => {
    dialogRef.current?.close();
    setSurface(null);
  }, []);

  const openSurface = useCallback((kind: SurfaceKind, next: Omit<NonNullable<SurfaceState>, 'kind'>) => {
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
    function onToast(event: Event) {
      const detail = (event as CustomEvent<{ message?: string; detail?: string; tone?: ToastTone }>).detail;
      if (detail?.message) notify(detail.message, { detail: detail.detail, tone: detail.tone });
    }

    function onClose() {
      closeSurface();
    }

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
      aria-label={surface.title}
      onClose={() => setSurface(null)}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeSurface();
      }}
    >
      <section className="workspace-overlay__frame">
        <header className="workspace-overlay__header">
          <div>
            {surface.eyebrow ? <p>{surface.eyebrow}</p> : null}
            <h2>{surface.title}</h2>
            {surface.description ? <span>{surface.description}</span> : null}
          </div>
          <button type="button" className="workspace-overlay__close" onClick={closeSurface} aria-label={`Close ${surface.title}`}>×</button>
        </header>
        <div className="workspace-overlay__body">{surface.content}</div>
        {surface.footer ? <footer className="workspace-overlay__footer">{surface.footer}</footer> : null}
      </section>
    </dialog> : null}

    <div className="workspace-toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => <div key={toast.id} className={`workspace-toast workspace-toast--${toast.tone}`}>
        <div className="workspace-toast__mark" aria-hidden="true">{toast.tone === 'success' ? '✓' : toast.tone === 'error' ? '!' : 'i'}</div>
        <div><strong>{toast.message}</strong>{toast.detail ? <span>{toast.detail}</span> : null}</div>
        <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss notification">×</button>
      </div>)}
    </div>
  </WorkspaceInteractionContext.Provider>;
}

export function WorkspaceShellActions() {
  const { openDrawer, openModal, openWindow, notify, closeSurface } = useWorkspaceInteractions();

  const quickLinks = <div className="workspace-quick-grid">
    <Link href="/workspace/enquiries" onClick={closeSurface}><span>Enquiries</span><small>Review incoming requirements</small></Link>
    <Link href="/workspace/cases" onClick={closeSurface}><span>Cases</span><small>Open commercial work</small></Link>
    <Link href="/workspace/projects" onClick={closeSurface}><span>Projects</span><small>Control active delivery</small></Link>
    <Link href="/workspace/payments" onClick={closeSurface}><span>Finance</span><small>Payments and commercial control</small></Link>
  </div>;

  return <div className="workspace-shell-actions">
    <button type="button" className="workspace-shell-action" onClick={() => openModal({
      eyebrow: 'Workspace',
      title: 'Quick actions',
      description: 'Move into the next piece of operational work without losing context.',
      content: quickLinks,
    })}>＋ <span>Quick</span></button>

    <button type="button" className="workspace-shell-action" onClick={() => openWindow({
      eyebrow: 'Operations',
      title: 'Work centre',
      description: 'A focused working surface for cross-module tasks.',
      content: <div className="workspace-window-intro"><strong>Choose the work, not the page.</strong><p>Use this surface for commercial reviews, technical reviews, comparisons and other focused tasks while the workspace remains behind it.</p>{quickLinks}</div>,
      footer: <button type="button" className="button secondary" onClick={() => { notify('Work centre ready', { detail: 'Global interaction feedback is active.', tone: 'info' }); closeSurface(); }}>Done</button>,
    })}>▣ <span>Work centre</span></button>

    <button type="button" className="workspace-shell-action workspace-shell-action--bell" onClick={() => openDrawer({
      eyebrow: 'Notification centre',
      title: 'Operational notifications',
      description: 'Persistent alerts, approvals and exceptions will surface here across the workspace.',
      content: <div className="workspace-notification-drawer">
        <div className="workspace-notification-empty"><span>✓</span><strong>No unresolved alerts loaded</strong><p>The interaction layer is ready to receive workflow notifications from every module.</p></div>
        <Link href="/workspace/notifications" onClick={closeSurface} className="button secondary">Open full notification centre</Link>
      </div>,
    })} aria-label="Open notification centre">♢ <span>Alerts</span></button>
  </div>;
}

export function emitWorkspaceToast(message: string, options?: { detail?: string; tone?: ToastTone }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('workspace:toast', { detail: { message, ...options } }));
}
