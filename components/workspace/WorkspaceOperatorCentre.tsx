'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceAlert } from './WorkspaceInteractionProvider';

export type RecentWorkItem = {
  href: string;
  label: string;
  context: string;
  visitedAt: number;
};

const RECENT_KEY = 'overflow-partner:recent-work';
const PINNED_KEY = 'overflow-partner:pinned-work';
const MAX_RECENT = 12;

function titleCase(value: string) {
  return value.replaceAll('-', ' ').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function describeWorkspaceRoute(pathname: string): { label: string; context: string } {
  const caseMatch = pathname.match(/^\/workspace\/leads\/([^/]+)/);
  if (caseMatch) return { label: 'Case 360', context: `Case · ${caseMatch[1].slice(0, 8)}` };
  const projectMatch = pathname.match(/^\/workspace\/projects\/([^/]+)/);
  if (projectMatch) return { label: pathname.endsWith('/delivery') ? 'Delivery Control' : 'Project 360', context: `Project · ${projectMatch[1].slice(0, 8)}` };
  const companyMatch = pathname.match(/^\/workspace\/companies\/([^/]+)/);
  if (companyMatch) return { label: 'Company 360', context: `Company · ${companyMatch[1].slice(0, 8)}` };

  const segment = pathname.split('/').filter(Boolean).at(-1) || 'workspace';
  const labels: Record<string, string> = {
    workspace: 'Mission Control', acquisition: 'Enquiries', approvals: 'Approvals', leads: 'Cases', projects: 'Projects',
    partners: 'Execution Partners', quotes: 'Client Quotes', payments: 'Payments', 'commercial-control': 'Commercial Control',
    documents: 'Documents', exceptions: 'Issues', tasks: 'Actions', communications: 'Messages', intelligence: 'Executive View',
    risk: 'Risk & Compliance', knowledge: 'Knowledge', settings: 'Settings', notifications: 'Notifications', companies: 'Companies', contacts: 'Contacts',
  };
  return { label: labels[segment] || titleCase(segment), context: 'Workspace' };
}

function readItems(key: string): RecentWorkItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item?.href && item?.label) : [];
  } catch { return []; }
}

function writeItems(key: string, items: RecentWorkItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('workspace:recent-work-updated'));
}

export function WorkspaceActivityTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname.startsWith('/workspace')) return;
    const descriptor = describeWorkspaceRoute(pathname);
    const current: RecentWorkItem = { href: pathname, ...descriptor, visitedAt: Date.now() };
    const previous = readItems(RECENT_KEY).filter((item) => item.href !== pathname);
    writeItems(RECENT_KEY, [current, ...previous].slice(0, MAX_RECENT));
  }, [pathname]);
  return null;
}

function age(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function WorkspaceOperatorCentre({ alerts = [], onNavigate }: { alerts?: WorkspaceAlert[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [recent, setRecent] = useState<RecentWorkItem[]>([]);
  const [pinned, setPinned] = useState<RecentWorkItem[]>([]);

  const refresh = () => { setRecent(readItems(RECENT_KEY)); setPinned(readItems(PINNED_KEY)); };
  useEffect(() => {
    refresh();
    window.addEventListener('workspace:recent-work-updated', refresh);
    return () => window.removeEventListener('workspace:recent-work-updated', refresh);
  }, []);

  const current = useMemo(() => ({ href: pathname, ...describeWorkspaceRoute(pathname), visitedAt: Date.now() }), [pathname]);
  const isPinned = pinned.some((item) => item.href === pathname);
  const togglePin = () => {
    const next = isPinned ? pinned.filter((item) => item.href !== pathname) : [current, ...pinned.filter((item) => item.href !== pathname)].slice(0, 8);
    writeItems(PINNED_KEY, next); setPinned(next);
  };
  const resume = recent.find((item) => item.href !== pathname);

  return <div className="operator-centre">
    <section className="operator-centre__hero">
      <div><small>Current context</small><strong>{current.label}</strong><span>{current.context}</span></div>
      <div className="operator-centre__hero-actions">
        <button type="button" className="button secondary" onClick={togglePin}>{isPinned ? 'Unpin current' : 'Pin current'}</button>
        {resume ? <Link className="button" href={resume.href} onClick={onNavigate}>Resume {resume.label} →</Link> : null}
      </div>
    </section>

    <div className="operator-centre__grid">
      <section className="operator-centre__panel">
        <header><div><small>Resume work</small><strong>Recent records</strong></div><span>{recent.length}</span></header>
        <div className="operator-centre__list">{recent.length ? recent.slice(0, 7).map((item) => <Link key={item.href} href={item.href} onClick={onNavigate}><span><strong>{item.label}</strong><small>{item.context}</small></span><em>{age(item.visitedAt)}</em></Link>) : <p>No recent workspace activity yet.</p>}</div>
      </section>

      <section className="operator-centre__panel">
        <header><div><small>Keep close</small><strong>Pinned work</strong></div><span>{pinned.length}</span></header>
        <div className="operator-centre__list">{pinned.length ? pinned.map((item) => <Link key={item.href} href={item.href} onClick={onNavigate}><span><strong>{item.label}</strong><small>{item.context}</small></span><em>→</em></Link>) : <p>Pin a Case, Project or workspace view to keep it here.</p>}</div>
      </section>

      <section className="operator-centre__panel operator-centre__panel--attention">
        <header><div><small>Operating attention</small><strong>Live alerts</strong></div><span>{alerts.length}</span></header>
        <div className="operator-centre__list">{alerts.length ? alerts.slice(0, 6).map((item) => <Link key={item.id} href={item.href} onClick={onNavigate}><span><strong>{item.title}</strong><small>{item.detail}</small></span><em className={`operator-centre__severity operator-centre__severity--${item.tone}`}>{item.kind === 'approval' ? 'A' : '!'}</em></Link>) : <p>No unresolved approvals or operational exceptions.</p>}</div>
      </section>

      <section className="operator-centre__panel">
        <header><div><small>Jump to</small><strong>Operator shortcuts</strong></div><span>⌨</span></header>
        <div className="operator-centre__shortcut-grid">
          <Link href="/workspace/approvals" onClick={onNavigate}>Approvals<kbd>G A</kbd></Link>
          <Link href="/workspace/exceptions" onClick={onNavigate}>Issues<kbd>G I</kbd></Link>
          <Link href="/workspace/payments" onClick={onNavigate}>Payments<kbd>G F</kbd></Link>
          <Link href="/workspace/documents" onClick={onNavigate}>Documents<kbd>G D</kbd></Link>
        </div>
        <p className="operator-centre__hint"><kbd>Ctrl/⌘ K</kbd> searches governed records · <kbd>Ctrl/⌘ Shift W</kbd> opens this Work Centre.</p>
      </section>
    </div>
  </div>;
}
