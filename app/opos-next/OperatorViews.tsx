import Link from 'next/link';
import css from './opos.module.css';

export type OperatorRow = {
  id: string;
  title: string;
  subtitle: string;
  state: string;
  next: string;
  href: string;
};

export function OperatorRegister({rows, empty = 'No records in this view.', heading = 'Records'}:
  {rows: OperatorRow[]; empty?: string; heading?: string}) {
  if (!rows.length) return <p className={css.empty}>{empty}</p>;
  return <>
    <div className={css.tableWrap}>
      <table className={css.table} aria-label={heading}>
        <thead><tr><th scope="col">Record</th><th scope="col">Context</th><th scope="col">Position</th><th scope="col">Next step</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td><Link href={row.href}>{row.title}</Link></td>
          <td>{row.subtitle}</td><td>{row.state}</td><td>{row.next}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className={css.mobileRecords} role="list" aria-label={heading}>
      {rows.map(row => <div key={row.id} role="listitem">
        <Link href={row.href} className={css.mobileRecord}>
          <span className={css.mobileRecordTop}>
            <strong className={css.mobileRecordTitle}>{row.title}</strong>
            <span className={css.status}>{row.state}</span>
          </span>
          <span className={css.mobileRecordMeta}>{row.subtitle}</span>
          <span className={css.mobileRecordBottom}>
            <span className={css.mobileRecordStep}>{row.next}</span>
            <span className={css.mobileRecordArrow} aria-hidden="true">↗</span>
          </span>
        </Link>
      </div>)}
    </div>
  </>;
}

export function OperatorPageIntro({eyebrow,title,subtitle, count}: {eyebrow:string;title:string;subtitle:string;count?:number}) {
  return <header className={css.pageHeader}>
    <p className={css.eyebrow}>{eyebrow}</p><h1 className={css.title}>{title}</h1>
    <p className={css.subhead}>{subtitle}</p>
    {typeof count === 'number' ? <p className={css.meta} style={{marginTop:16}}>{count} record{count===1?'':'s'} in this view</p> : null}
  </header>;
}

export function OperatorRecord({eyebrow,title,position,description,fields,previous,governedHref,governedLabel='Open governed controls',waiting=false}: {
  eyebrow:string;title:string;position:string;description:string;
  fields:{label:string;value:string}[];previous:string;
  governedHref?:string;governedLabel?:string;waiting?:boolean;
}) {
  return <article>
    <Link href={previous} className={css.backLink}>← Back to register</Link>
    <header className={css.pageHeader}><p className={css.eyebrow}>{eyebrow}</p><h1 className={css.title}>{title}</h1></header>
    <section className={css.card} aria-label="Current position">
      <span className={css.overline}>{waiting ? 'Awaiting external action' : 'Operating position'}</span>
      <h2 className={css.cardTitle}>{position}</h2>
      <p className={css.cardDescription}>{description}</p>
      {waiting ? <p className={css.meta} style={{marginTop:19}}>No internal action is assumed while this dependency is outstanding.</p>
        : governedHref ? <Link className={css.action} href={governedHref}>{governedLabel} ↗</Link> : <p className={css.meta} style={{marginTop:19}}>Partner controls are not yet available in this QA workspace.</p>}
    </section>
    <details className={css.details}>
      <summary>Context and controlled record</summary>
      <div className={css.detailsContent}>
        {fields.map(f => <p key={f.label}><strong>{f.label}: </strong>{f.value}</p>)}
        {waiting && governedHref ? <p><Link className={css.secondaryLink} href={governedHref}>Open governed record ↗</Link></p> : null}
      </div>
    </details>
    <p className={css.meta} style={{marginTop:25}}>This screen currently displays read-only operational evidence. Governed edit actions have not all been migrated and tested in the new workspace.</p>
  </article>;
}
