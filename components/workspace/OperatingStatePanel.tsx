import Link from 'next/link';
import type { OperatingPresentation } from '@/lib/presentation/operatingState';
import { ProductStatus } from '@/components/workspace/ProductUI';

function actorLabel(presentation: OperatingPresentation) {
  if (!presentation.waitingOn) return null;
  const prefix = presentation.waitingOn.actor === 'partner' ? 'Waiting on Partner' : presentation.waitingOn.actor === 'client' ? 'Waiting on client' : presentation.waitingOn.actor === 'internal' ? 'With your team' : 'System state';
  return `${prefix} · ${presentation.waitingOn.label}`;
}

export default function OperatingStatePanel({ presentation }: { presentation: OperatingPresentation }) {
  const actor = actorLabel(presentation);
  const primary = presentation.primaryActions.filter(action => action.href).slice(0, 2);
  return <section className={`operating-state operating-state--${presentation.tone}`} data-operating-tone={presentation.tone}>
    <div className="operating-state__copy">
      <div className="operating-state__kicker">
        <ProductStatus tone={presentation.tone}>{presentation.state}</ProductStatus>
        {actor ? <span>{actor}</span> : null}
      </div>
      <h2>{presentation.headline}</h2>
      <p>{presentation.summary}</p>
      {presentation.approval?.required ? <div className={`operating-state__approval operating-state__approval--${presentation.approval.status}`}>
        <span>Approval</span>
        <strong>{presentation.approval.type}</strong>
        <small>{presentation.approval.status === 'ready' ? 'Ready for authorised decision' : presentation.approval.status === 'blocked' ? 'Evidence must be completed first' : presentation.approval.status.replaceAll('_', ' ')}</small>
      </div> : null}
    </div>

    <div className="operating-state__decision">
      <small>What happens next</small>
      <strong>{presentation.nextAction.label}</strong>
      {presentation.nextAction.reason ? <p>{presentation.nextAction.reason}</p> : null}
      {presentation.blockers.length > 0 && presentation.tone !== 'waiting' ? <div className="operating-state__blocker"><span>Needs attention</span><p>{presentation.blockers[0]}</p>{presentation.blockers.length > 1 ? <small>+{presentation.blockers.length - 1} more</small> : null}</div> : null}
      {primary.length ? <div className="operating-state__actions">{primary.map(action => <Link key={`${action.label}-${action.href}`} className="button secondary" href={action.href!}>{action.label} →</Link>)}</div> : null}
    </div>
  </section>;
}
