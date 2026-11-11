import Link from 'next/link';
import css from './work-record.module.css';

type Stage = {name:string;detail:string};
type Fact={label:string;value:string};
export default function WorkRecordV2({
  eyebrow,title,subtitle,state,owner,nextTitle,nextDescription,stages,stageIndex,evidence,facts,governedHref,previous,waiting=false,compact=true,actionLabel='Review current controls',showDecision=true,
}:{
  eyebrow:string;title:string;subtitle:string;state:string;owner:string;
  nextTitle:string;nextDescription:string;stages:Stage[];stageIndex:number;
  evidence:Fact[];facts:Fact[];governedHref:string;previous:string;waiting?:boolean;compact?:boolean;actionLabel?:string;showDecision?:boolean;
}){
  // Use one decision-first layout by default across record types.
  // Supporting evidence remains available on demand.
  const detailContent=<section className={css.section+' '+css.grid} aria-label="Evidence and controls">
      <div className={css.panel}><h3>Documents and checks</h3>
        {evidence.map((fact,i)=><div key={i} className={css.evidence}>
          <div><strong className={css.evidenceTitle}>{fact.label}</strong><span className={css.evidenceDetail}>{fact.value}</span></div>
        </div>)}
      </div>
      <div className={css.panel}><h3>Other information</h3>
        {facts.map((fact,i)=><div key={i} className={css.fact}>
          <small>{fact.label}</small><strong>{fact.value}</strong>
        </div>)}
        <Link href={previous} className={css.secondary}>← Back to register</Link>
      </div>
    </section>;
  const lifecycleContent=<section className={css.section} aria-label="Lifecycle position">
      <p className={css.sectionKicker}>{eyebrow.includes('PROJECT')?'DELIVERY POSITION':'COMMITMENT READINESS'}</p>
      <div className={css.timeline}>
        {stages.map((s,i)=><div key={s.name} className={css.step+' '+(i<stageIndex?css.done:i===stageIndex?css.current:'')}>
          <span className={css.stepCode}>{String(i+1).padStart(2,'0')} · {i<stageIndex?'Complete':i===stageIndex?'Current':'Upcoming'}</span>
          <strong className={css.stepTitle}>{s.name}</strong><span className={css.stepDetail}>{s.detail}</span>
        </div>)}
      </div>
    </section>;
  return <article className={compact?css.page+' '+css.compact:css.page}>
    <p className={css.eyebrow}>{eyebrow}</p>
    <h1 className={css.title}>{title}</h1>
    <p className={css.caption}>{subtitle}</p>
    <div className={css.statebar}>
      <span className={css.pill}><span className={css.dot}/>{state}</span>
      {!compact?<span className={css.smallMeta}>Owner: {owner}</span>:null}
    </div>
    {showDecision?<section className={css.decision} aria-label={waiting?'Current waiting position':'Current decision'}>
      <p className={css.decisionKicker}>NEXT STEP</p>
      <h2>{nextTitle}</h2>
      <p>{nextDescription}</p>
      {!waiting?<div className={css.decisionActions}>
        <Link className={css.primary} href={governedHref}>{actionLabel} ↗</Link>
      </div>:null}
    </section>:null}
    {compact && (facts.length || evidence.length || stages.length) ? <details className={css.compactDetails}>
      <summary>{eyebrow.includes('CASE')?'Case details':'Project details'}</summary>
      {lifecycleContent}
      {detailContent}
    </details>:compact?null:<>{lifecycleContent}{detailContent}</>}
    {compact?<p className={css.compactBack}><Link href={previous} className={css.secondary}>← Back to projects</Link></p>:
      <p className={css.footer}>Live organisation-scoped record · Actions are shown only where the relevant governed controls are available.</p>}
  </article>;
}
