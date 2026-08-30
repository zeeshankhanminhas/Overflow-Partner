import Link from 'next/link';
import type { ReactNode } from 'react';

export type ProductTone = 'neutral' | 'active' | 'waiting' | 'attention' | 'blocked' | 'complete' | 'critical';
export type ProductActionTone = 'primary' | 'secondary' | 'approve' | 'warning' | 'destructive';
export type ProductProvenanceSource = 'op' | 'partner' | 'system' | 'client';

export function ProductStatus({ children, tone = 'neutral' }: { children: ReactNode; tone?: ProductTone }) {
  return <span className={`product-status product-status--${tone}`} data-tone={tone}>{children}</span>;
}

export function ProductProvenance({ source, children }: { source: ProductProvenanceSource; children?: ReactNode }) {
  const label = children || ({ op: 'OP controlled', partner: 'Partner reported', system: 'System calculated', client: 'Client evidenced' } as const)[source];
  return <span className={`product-provenance product-provenance--${source}`} data-provenance={source}><i aria-hidden="true" />{label}</span>;
}

export function ProductPageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = 'Back',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return <header className="product-page-header operational-page-header">
    <div className="product-page-header__copy">
      {backHref ? <Link className="product-backlink" href={backHref}>← {backLabel}</Link> : null}
      <p className="product-eyebrow op-ui-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description ? <p className="product-description">{description}</p> : null}
    </div>
    {actions ? <div className="product-page-header__actions">{actions}</div> : null}
  </header>;
}

export function ProductMetrics({ children, label }: { children: ReactNode; label?: string }) {
  return <section className="product-metrics op-ui-signals" aria-label={label}>{children}</section>;
}

export function ProductMetric({ label, value, detail, tone = 'neutral' }: { label: string; value: ReactNode; detail?: ReactNode; tone?: ProductTone }) {
  return <article className={`product-metric product-metric--${tone} op-ui-signal`} data-tone={tone}>
    <div className="op-ui-signal__top"><small>{label}</small><ProductStatus tone={tone}>{value}</ProductStatus></div>
    {detail ? <span>{detail}</span> : null}
  </article>;
}

export function ProductSectionHeader({ eyebrow, title, meta, actions }: { eyebrow?: string; title: string; meta?: ReactNode; actions?: ReactNode }) {
  return <div className="product-section-header">
    <div>{eyebrow ? <p className="product-eyebrow op-ui-eyebrow">{eyebrow}</p> : null}<h2>{title}</h2>{meta ? <div className="product-section-header__meta">{meta}</div> : null}</div>
    {actions ? <div className="product-section-header__actions">{actions}</div> : null}
  </div>;
}

export function ProductEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="product-empty-state op-ui-empty" role="status">
    <strong>{title}</strong>
    {description ? <p>{description}</p> : null}
    {action ? <div>{action}</div> : null}
  </div>;
}

export function ProductNotice({ title, children, tone = 'neutral' }: { title: string; children?: ReactNode; tone?: ProductTone }) {
  const urgent = tone === 'blocked' || tone === 'critical';
  return <div className={`product-notice product-notice--${tone}`} data-continuity-notice data-tone={tone} role={urgent ? 'alert' : 'status'} aria-live={urgent ? 'assertive' : 'polite'}>
    <strong>{title}</strong>
    {children ? <div>{children}</div> : null}
  </div>;
}

/* Filter contract: filters are labelled operating controls, not loose buttons. */
export function ProductFilterBar({ children, label = 'Filter records' }: { children: ReactNode; label?: string }) {
  return <div className="product-filter-bar" role="group" aria-label={label}>{children}</div>;
}

export function ProductFilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className="product-filter-group"><span className="product-filter-group__label">{label}</span><div className="product-filter-group__controls">{children}</div></div>;
}

/* Register contract: optional serial aids discussion without replacing business identifiers. */
export function ProductRegister({ children, className = '', label = 'Records' }: { children: ReactNode; className?: string; label?: string }) {
  return <div className={`product-register ${className}`.trim()} role="list" aria-label={label}>{children}</div>;
}

export function ProductRegisterRow({ children, href, className = '', id, serial }: { children: ReactNode; href?: string; className?: string; id?: string; serial?: number }) {
  const body = <>{serial ? <span className="product-register-row__serial" aria-label={`Row ${serial}`}>{serial}</span> : null}{children}</>;
  const cls = `product-register-row ${serial ? 'product-register-row--numbered' : ''} ${className}`.trim();
  return href
    ? <Link id={id} className={cls} href={href} role="listitem">{body}</Link>
    : <div id={id} className={cls} role="listitem">{body}</div>;
}

/* Action contract: colour follows consequence, never decoration. */
export function ProductActionLink({ href, children, tone = 'secondary', className = '' }: { href: string; children: ReactNode; tone?: ProductActionTone; className?: string }) {
  return <Link href={href} className={`button product-action product-action--${tone} ${className}`.trim()} data-action-tone={tone}>{children}</Link>;
}

/* Time contract: operational age and contractual date are separate concepts. */
export function ProductAge({ value, now = new Date() }: { value: string | Date | null | undefined; now?: Date }) {
  if (!value) return <span className="product-age product-age--unknown">—</span>;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return <span className="product-age product-age--unknown">—</span>;
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  const label = minutes < 60 ? `${Math.max(1, minutes)}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
  const band = minutes >= 10080 ? 'old' : minutes >= 4320 ? 'aging' : 'normal';
  return <time className={`product-age product-age--${band}`} dateTime={date.toISOString()} title={date.toLocaleString('en-GB')}>{label}</time>;
}

export function ProductDate({ value, fallback = '—' }: { value: string | Date | null | undefined; fallback?: string }) {
  if (!value) return <span className="product-date product-date--empty">{fallback}</span>;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return <span className="product-date product-date--empty">{fallback}</span>;
  return <time className="product-date" dateTime={date.toISOString()}>{date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</time>;
}
