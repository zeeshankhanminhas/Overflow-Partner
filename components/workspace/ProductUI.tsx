import Link from 'next/link';
import type { ReactNode } from 'react';

export type ProductTone = 'neutral' | 'active' | 'waiting' | 'attention' | 'blocked' | 'complete' | 'critical';
export type ProductProvenanceSource = 'op' | 'partner' | 'system' | 'client';

export function ProductStatus({ children, tone = 'neutral' }: { children: ReactNode; tone?: ProductTone }) {
  return <span className={`product-status product-status--${tone}`} data-tone={tone}>{children}</span>;
}

export function ProductProvenance({ source, children }: { source: ProductProvenanceSource; children?: ReactNode }) {
  const label = children || ({ op: 'Overflow Partner', partner: 'Partner reported', system: 'System calculated', client: 'Client confirmed' } as const)[source];
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
  return <header className="product-page-header">
    <div className="product-page-header__copy">
      {backHref ? <Link className="product-backlink" href={backHref}>← {backLabel}</Link> : null}
      <p className="product-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description ? <p className="product-description">{description}</p> : null}
    </div>
    {actions ? <div className="product-page-header__actions">{actions}</div> : null}
  </header>;
}

export function ProductMetrics({ children, label }: { children: ReactNode; label?: string }) {
  return <section className="product-metrics" aria-label={label}>{children}</section>;
}

export function ProductMetric({ label, value, detail, tone = 'neutral' }: { label: string; value: ReactNode; detail?: ReactNode; tone?: ProductTone }) {
  return <article className={`product-metric product-metric--${tone}`} data-tone={tone}>
    <span>{label}</span>
    <strong>{value}</strong>
    {detail ? <small>{detail}</small> : null}
  </article>;
}

export function ProductSectionHeader({ eyebrow, title, meta, actions }: { eyebrow?: string; title: string; meta?: ReactNode; actions?: ReactNode }) {
  return <div className="product-section-header">
    <div>{eyebrow ? <p className="product-eyebrow">{eyebrow}</p> : null}<h2>{title}</h2>{meta ? <div className="product-section-header__meta">{meta}</div> : null}</div>
    {actions ? <div className="product-section-header__actions">{actions}</div> : null}
  </div>;
}

export function ProductEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="product-empty-state" role="status">
    <strong>{title}</strong>
    {description ? <p>{description}</p> : null}
    {action ? <div>{action}</div> : null}
  </div>;
}

export function ProductNotice({ title, children, tone = 'neutral' }: { title: string; children?: ReactNode; tone?: ProductTone }) {
  const urgent = tone === 'blocked' || tone === 'critical';
  return <div
    className={`product-notice product-notice--${tone}`}
    data-continuity-notice
    data-tone={tone}
    role={urgent ? 'alert' : 'status'}
    aria-live={urgent ? 'assertive' : 'polite'}
  >
    <strong>{title}</strong>
    {children ? <div>{children}</div> : null}
  </div>;
}

export function ProductFilterBar({ children }: { children: ReactNode }) {
  return <div className="product-filter-bar">{children}</div>;
}

export function ProductRegister({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`product-register ${className}`.trim()}>{children}</div>;
}

export function ProductRegisterRow({ children, href, className = '', id }: { children: ReactNode; href?: string; className?: string; id?: string }) {
  const body = <>{children}</>;
  return href
    ? <Link id={id} className={`product-register-row ${className}`.trim()} href={href}>{body}</Link>
    : <div id={id} className={`product-register-row ${className}`.trim()}>{body}</div>;
}
