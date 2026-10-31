import Link from 'next/link';
import css from './work-record.module.css';

type Stage = {name:string;detail:string};
type Fact={label:string;value:string};
export default function WorkRecordV2({
  eyebrow,title,subtitle,state,owner,nextTitle,nextDescription,stages,stageIndex,evidence,facts,governedHref,previous,waiting=false,
}:{
  eyebrow:string;title:string;subtitle:string;state:string;owner:string;
  nextTitle:string;nextDescription:string;stages:Stage[];stageIndex:number;
  evidence:Fact[];facts:Fact[];governedHref:string;previous:string;waiting?:boolean;
}){
  return <article className={css.page}>
    <p className={css.eyebrow}>{eyebrow}</p>
    <h1 className={css.title}>{title}</h1>
    <p className={css.caption}>{subtitle}</p>
    <div className={css.statebar}>
      <span className={css.pill}><span className={css.dot}/>{state}</span>
      <span className={css.smallMeta}>Owner: {owner}</span>
    </div>
    <section className={css.decision} aria-label={waiting?'Current waiting position':'Current decision'}>
      <p className={css.decisionKicker}>{waiting?'CURRENT DEPENDENCY':'NEXT OPERATOR DECISION'}</p>
      <h2>{nextTitle}</h2>
      <p>{nextDescription}</p>
      {waiting?<p style={{marginTop:16,fontSize:12}}>No decision is assumed until the outstanding evidence arrives.</p>:null}
      <div className={css.decisionActions}>
        {!waiting?<Link className={css.primary} href={governedHref}>Review governed decision ↗</Link>:null}
        <Link href={governedHref} className={css.secondary}>Open controlled record</Link>
      </div>
    </section>
    <section className={css.section} aria-label="Lifecycle position">
      <p className={css.sectionKicker}>{eyebrow.includes('PROJECT')?'DELIVERY POSITION':'COMMITMENT READINESS'}</p>
      <div className={css.timeline}>
        {stages.map((s,i)=><div key={s.name} className={css.step+' '+(i<stageIndex?css.done:i===stageIndex?css.current:'')}>
          <span className={css.stepCode}>{String(i+1).padStart(2,'0')} · {i<stageIndex?'Complete':i===stageIndex?'Current':'Upcoming'}</span>
          <strong className={css.stepTitle}>{s.name}</strong><span className={css.stepDetail}>{s.detail}</span>
        </div>)}
      </div>
    </section>
    <section className={css.section+' '+css.grid} aria-label="Evidence and controls">
      <div className={css.panel}><h3>Controlled evidence</h3>
        {evidence.map((fact,i)=><div key={i} className={css.evidence}>
          <div><strong className={css.evidenceTitle}>{fact.label}</strong><span className={css.evidenceDetail}>{fact.value}</span></div>
        </div>)}
      </div>
      <div className={css.panel}><h3>Operating context</h3>
        {facts.map((fact,i)=><div key={i} className={css.fact}>
          <small>{fact.label}</small><strong>{fact.value}</strong>
        </div>)}
        <Link href={previous} className={css.secondary}>← Back to register</Link>
      </div>
    </section>
    <p className={css.footer}>Real OPOS record · Read-only design preview. Governing approvals, commitments and financial controls remain with the existing OS.</p>
  </article>;
}
