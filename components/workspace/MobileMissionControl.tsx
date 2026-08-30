import Link from 'next/link';

type MobilePriorityItem = {
  id: string;
  label: string;
  title: string;
  detail: string;
  meta: string;
  owner: string;
  href: string;
  actionLabel: string;
  tone?: 'critical' | 'attention' | 'waiting' | 'neutral' | 'active' | 'ready';
};

type MobileMissionControlProps = {
  priorityAttention: number;
  p1: number;
  p2: number;
  readyDecisions: number;
  blockedDecisions: number;
  dependencies: number;
  externalDependencies: number;
  agedDependencies: number;
  deliveryIssues: number;
  criticalIssues: number;
  highIssues: number;
  waitingInternal: number;
  waitingPartner: number;
  waitingClient: number;
  primary: {
    title: string;
    record: string;
    reason: string;
    owner: string;
    detail: string;
    status: string;
    href: string;
    actionLabel: string;
  };
  queue: MobilePriorityItem[];
};

type IconName = 'flag' | 'clock' | 'person' | 'status' | 'clipboard' | 'users' | 'check' | 'document' | 'chevron';

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'flag') return <svg {...common}><path d="M5 21V4"/><path d="M5 5h10l-1.6 3L15 11H5"/></svg>;
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/></svg>;
  if (name === 'person') return <svg {...common}><circle cx="12" cy="8" r="3"/><path d="M6.5 19c.7-3 2.6-4.5 5.5-4.5s4.8 1.5 5.5 4.5"/></svg>;
  if (name === 'status') return <svg {...common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></svg>;
  if (name === 'clipboard') return <svg {...common}><rect x="6" y="5" width="12" height="15" rx="2"/><path d="M9 5.5V4h6v1.5"/><path d="M9 10h6M9 14h6"/></svg>;
  if (name === 'users') return <svg {...common}><circle cx="9" cy="9" r="3"/><path d="M3.8 19c.5-3 2.2-4.5 5.2-4.5s4.7 1.5 5.2 4.5"/><path d="M15 7.5a2.5 2.5 0 0 1 0 5"/><path d="M16.5 15c2 .4 3.2 1.7 3.7 4"/></svg>;
  if (name === 'check') return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="m8.5 12.2 2.2 2.2 4.8-5"/></svg>;
  if (name === 'document') return <svg {...common}><path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4"/><path d="M9 12h6M9 15.5h6"/></svg>;
  return <svg {...common}><path d="m9 6 6 6-6 6"/></svg>;
}

function toneClass(tone?: MobilePriorityItem['tone']) {
  if (tone === 'critical') return 'is-critical';
  if (tone === 'attention') return 'is-attention';
  if (tone === 'waiting') return 'is-waiting';
  if (tone === 'ready') return 'is-ready';
  return '';
}

function statusLabel(item: MobilePriorityItem) {
  if (item.tone === 'critical') return 'Urgent';
  if (item.tone === 'attention') return 'Needs attention';
  if (item.tone === 'waiting') return 'Pending';
  if (item.tone === 'ready') return 'Ready';
  return item.actionLabel || 'Open';
}

export default function MobileMissionControl({
  priorityAttention,
  p1,
  p2,
  readyDecisions,
  blockedDecisions,
  dependencies,
  externalDependencies,
  agedDependencies,
  deliveryIssues,
  criticalIssues,
  highIssues,
  waitingInternal,
  waitingPartner,
  waitingClient,
  primary,
  queue,
}: MobileMissionControlProps) {
  return <section className="mobile-mission" aria-label="Mission Control mobile view">
    <header className="mobile-mission__intro">
      <h1>Mission Control</h1>
      <p>Your operational cockpit. Focus on what moves the needle.</p>
    </header>

    <section className="mobile-mission__priority-card" aria-label="Current priority">
      <div className="mobile-mission__priority-copy">
        <span className="mobile-mission__priority-label">Current priority</span>
        <h2>{primary.title}</h2>
        <p>{primary.reason}</p>
        <div className="mobile-mission__priority-meta">
          <span><Icon name="clock" size={18}/>{primary.detail}</span>
          <span><Icon name="person" size={18}/>{primary.owner}</span>
          <span><Icon name="status" size={18}/>{primary.status}</span>
        </div>
      </div>
      <div className="mobile-mission__priority-flag"><Icon name="flag" size={30}/></div>
      <Link className="mobile-mission__priority-action" href={primary.href}>{primary.actionLabel}<Icon name="chevron" size={19}/></Link>
    </section>

    <section className="mobile-mission__section">
      <header className="mobile-mission__section-head">
        <h2>Current Work</h2>
        <Link href="/workspace/attention">View all</Link>
      </header>
      <div className="mobile-mission__work-grid">
        <Link href="/workspace/attention" className="mobile-mission__work-card tone-red">
          <span className="mobile-mission__work-icon"><Icon name="clipboard"/></span>
          <span className="mobile-mission__work-number">{priorityAttention}</span>
          <strong>Open delivery work</strong>
          <small>{p1 + p2 ? `${p1} P1 · ${p2} P2 need attention` : 'Nothing urgent right now'}</small>
          <span className="mobile-mission__work-chevron"><Icon name="chevron"/></span>
        </Link>
        <Link href="/workspace/attention" className="mobile-mission__work-card tone-amber">
          <span className="mobile-mission__work-icon"><Icon name="users"/></span>
          <span className="mobile-mission__work-number">{dependencies}</span>
          <strong>Waiting on others</strong>
          <small>{externalDependencies} external · {agedDependencies} aged</small>
          <span className="mobile-mission__work-chevron"><Icon name="chevron"/></span>
        </Link>
        <Link href="/workspace/approvals" className="mobile-mission__work-card tone-blue">
          <span className="mobile-mission__work-icon"><Icon name="check"/></span>
          <span className="mobile-mission__work-number">{readyDecisions}</span>
          <strong>Approvals</strong>
          <small>{blockedDecisions} waiting for information</small>
          <span className="mobile-mission__work-chevron"><Icon name="chevron"/></span>
        </Link>
        <Link href="/workspace/exceptions" className="mobile-mission__work-card tone-green">
          <span className="mobile-mission__work-icon"><Icon name="document"/></span>
          <span className="mobile-mission__work-number">{deliveryIssues}</span>
          <strong>Delivery issues</strong>
          <small>{criticalIssues} critical · {highIssues} high</small>
          <span className="mobile-mission__work-chevron"><Icon name="chevron"/></span>
        </Link>
      </div>
    </section>

    <section className="mobile-mission__section mobile-mission__next">
      <header className="mobile-mission__section-head">
        <h2>Next up</h2>
        <Link href="/workspace/attention">View all</Link>
      </header>
      <div className="mobile-mission__next-card">
        {queue.length ? queue.slice(0, 3).map((item, index) => <Link className="mobile-mission__next-row" href={item.href} key={item.id}>
          <span className={`mobile-mission__avatar ${toneClass(item.tone)}`}>{item.title.slice(0, 2).toUpperCase()}</span>
          <span className="mobile-mission__next-copy">
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
            <em>{item.meta} · {item.owner}</em>
          </span>
          <span className={`mobile-mission__status-pill ${toneClass(item.tone)}`}>{statusLabel(item)}</span>
          <span className="mobile-mission__next-chevron"><Icon name="chevron"/></span>
        </Link>) : <div className="mobile-mission__empty">No immediate actions are waiting.</div>}
      </div>
    </section>

    <section className="mobile-mission__section mobile-mission__waiting">
      <header className="mobile-mission__section-head">
        <h2>Waiting on</h2>
        <Link href="/workspace/attention">View all</Link>
      </header>
      <div className="mobile-mission__waiting-card">
        <div className="tone-red"><strong>{waitingClient}</strong><span>Client</span><small>Awaiting client updates</small><i><Icon name="users" size={18}/></i></div>
        <div className="tone-amber"><strong>{waitingInternal}</strong><span>Team</span><small>Awaiting team updates</small><i><Icon name="person" size={18}/></i></div>
        <div className="tone-green"><strong>{waitingPartner}</strong><span>Delivery partner</span><small>Awaiting partner updates</small><i><Icon name="document" size={18}/></i></div>
      </div>
    </section>
  </section>;
}
