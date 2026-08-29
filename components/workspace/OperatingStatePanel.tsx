import Link from 'next/link';
import type { OperatingPresentation } from '@/lib/presentation/operatingState';
import { ProductStatus } from '@/components/workspace/ProductUI';
import { commercialCopy, commercialStatus } from '@/lib/presentation/commercialLanguage';

function actorLabel(presentation: OperatingPresentation) {
  if (!presentation.waitingOn) return null;
  const prefix = presentation.waitingOn.actor === 'partner' ? 'Waiting for delivery partner' : presentation.waitingOn.actor === 'client' ? 'Waiting for client' : presentation.waitingOn.actor === 'internal' ? 'With your team' : 'In progress';
  return `${prefix} · ${commercialCopy(presentation.waitingOn.label)}`;
}

export default function OperatingStatePanel({ presentation }: { presentation: OperatingPresentation }) {
  const actor = actorLabel(presentation);
  const primary = presentation.primaryActions.filter(action => action.href).slice(0, 2);
  return <section className={`operating-state operating-state--${presentation.tone}`} data-operating-tone={presentation.tone}>
    <div className="operating-state__copy">
      <div className="operating-state__kicker">
        <ProductStatus tone={presentation.tone}>{commercialStatus(presentation.state, commercialCopy(presentation.state))}</ProductStatus>
        {actor ? <span>{actor}</span> : null}
      </div>
      <h2>{commercialCopy(presentation.headline)}</h2>
      <p>{commercialCopy(presentation.summary)}</p>
      {presentation.approval?.required ? <div className={`operating-state__approval operating-state__approval--${presentation.approval.status}`}>
        <span>Approval</span>
        <strong>{commercialCopy(presentation.approval.type)}</strong>
        <small>{presentation.approval.status === 'ready' ? 'Ready for approval' : presentation.approval.status === 'blocked' ? 'Complete the required information first' : commercialStatus(presentation.approval.status, 'Approval pending')}</small>
      </div> : null}
    </div>

    <div className="operating-state__decision">
      <small>What happens next</small>
      <strong>{commercialCopy(presentation.nextAction.label)}</strong>
      {presentation.nextAction.reason ? <p>{commercialCopy(presentation.nextAction.reason)}</p> : null}
      {presentation.blockers.length > 0 && presentation.tone !== 'waiting' ? <div className="operating-state__blocker"><span>Needs attention</span><p>{commercialCopy(presentation.blockers[0])}</p>{presentation.blockers.length > 1 ? <small>+{presentation.blockers.length - 1} more</small> : null}</div> : null}
      {primary.length ? <div className="operating-state__actions">{primary.map(action => <Link key={`${action.label}-${action.href}`} className="button secondary" href={action.href!}>{commercialCopy(action.label)} →</Link>)}</div> : null}
    </div>
  </section>;
}
