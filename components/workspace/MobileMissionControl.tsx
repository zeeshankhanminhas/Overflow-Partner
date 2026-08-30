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

function toneClass(tone?: MobilePriorityItem['tone']) {
  if (tone === 'critical') return 'is-critical';
  if (tone === 'attention') return 'is-attention';
  if (tone === 'waiting') return 'is-waiting';
  if (tone === 'ready') return 'is-ready';
  return '';
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
    <div className="mobile-mission__intro">
      <p className="mobile-mission__eyebrow">Mission Control</p>
      <h1>What needs your attention</h1>
      <p>Decisions, dependencies and delivery issues in business-priority order.</p>
    </div>

    <section className="mobile-mission__hero" aria-label="Current priority">
      <div className="mobile-mission__hero-main">
        <div className="mobile-mission__hero-icon" aria-hidden="true">↗</div>
        <div className="mobile-mission__hero-copy">
          <span>Current priority</span>
          <strong>{primary.title}</strong>
          <em>{primary.status}</em>
        </div>
      </div>
      <div className="mobile-mission__hero-side">
        <div><span>Attention</span><strong>{priorityAttention}</strong></div>
        <div><span>Ready decisions</span><strong>{readyDecisions}</strong></div>
      </div>
      <div className="mobile-mission__hero-footer">
        <div className="mobile-mission__hero-footer-icon" aria-hidden="true">◎</div>
        <div><span>Current responsibility</span><strong>{primary.owner}</strong><small>{primary.detail}</small></div>
        <span aria-hidden="true">›</span>
      </div>
    </section>

    <section className="mobile-mission__section">
      <header className="mobile-mission__section-head">
        <div><h2>Current work</h2><p>Live operating signals that may need action.</p></div>
      </header>
      <div className="mobile-mission__metric-grid">
        <article className="mobile-mission__metric"><i aria-hidden="true">!</i><div><span>Priority attention</span><strong>{priorityAttention}</strong><small>{p1} P1 · {p2} P2</small></div></article>
        <article className="mobile-mission__metric"><i aria-hidden="true">✓</i><div><span>Ready decisions</span><strong>{readyDecisions}</strong><small>{blockedDecisions} waiting for information</small></div></article>
        <article className="mobile-mission__metric"><i aria-hidden="true">↔</i><div><span>Dependencies</span><strong>{dependencies}</strong><small>{externalDependencies} external · {agedDependencies} aged</small></div></article>
        <article className="mobile-mission__metric"><i aria-hidden="true">△</i><div><span>Delivery issues</span><strong>{deliveryIssues}</strong><small>{criticalIssues} critical · {highIssues} high</small></div></article>
      </div>
      <div className="mobile-mission__actions">
        <Link className="mobile-mission__primary" href={primary.href}>{primary.actionLabel}</Link>
        <Link className="mobile-mission__secondary" href="/workspace/attention">View all attention</Link>
      </div>
    </section>

    <section className="mobile-mission__section mobile-mission__next">
      <header className="mobile-mission__section-head mobile-mission__section-head--inline">
        <div><h2>Next up</h2><p>Highest business consequence first.</p></div>
        <Link href="/workspace/attention">View all</Link>
      </header>
      <div className="mobile-mission__list">
        {queue.length ? queue.slice(0, 4).map((item, index) => <Link className="mobile-mission__row" href={item.href} key={item.id}>
          <span className={`mobile-mission__row-icon ${toneClass(item.tone)}`} aria-hidden="true">{index + 1}</span>
          <span className="mobile-mission__row-copy"><strong>{item.title}</strong><small>{item.label} · {item.owner}</small><em>{item.meta}</em></span>
          <span className="mobile-mission__row-chevron" aria-hidden="true">›</span>
        </Link>) : <div className="mobile-mission__empty">No immediate actions are waiting.</div>}
      </div>
    </section>

    <section className="mobile-mission__section mobile-mission__waiting">
      <header className="mobile-mission__section-head"><div><h2>Waiting on</h2><p>Who currently owns the next movement.</p></div></header>
      <div className="mobile-mission__waiting-grid">
        <div><span>Your team</span><strong>{waitingInternal}</strong></div>
        <div><span>Delivery partner</span><strong>{waitingPartner}</strong></div>
        <div><span>Client</span><strong>{waitingClient}</strong></div>
      </div>
    </section>
  </section>;
}
