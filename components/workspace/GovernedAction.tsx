import type { ReactNode } from 'react';
import type { ResolvedActionState } from '@/lib/workspace/state';
import { humaniseOperatingReason, resolvePresentedAction } from '@/lib/presentation/operatingState';

type Props = {
  state: ResolvedActionState;
  children?: ReactNode;
  blockedAction?: ReactNode;
};

export default function GovernedAction({ state, children, blockedAction }: Props) {
  const action = resolvePresentedAction(state);
  const blockers = state.blockers.map(humaniseOperatingReason);
  const permitted = action.available && state.permitted;

  return <div className={`governed-action ${permitted ? 'is-ready' : action.kind === 'wait' ? 'is-waiting' : 'is-blocked'}`}>
    <div className="governed-action__status">
      <span aria-hidden="true">{permitted ? '→' : action.kind === 'wait' ? '·' : '!'}</span>
      <div>
        <small>{permitted ? 'Ready' : action.kind === 'wait' ? 'Waiting' : 'Needs attention'}</small>
        <h2>{action.label}</h2>
        <p>{action.reason || (permitted ? 'Everything needed for the next step is ready.' : blockers[0] || 'Review the current operating state before continuing.')}</p>
      </div>
    </div>

    {!permitted && action.kind !== 'wait' && blockers.length > 0 ? <div className="governed-action__blockers">
      <strong>Resolve these first</strong>
      <ul>{blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
    </div> : null}

    {permitted || (blockedAction && action.kind !== 'wait') ? <div className="governed-action__controls">
      {permitted ? children : blockedAction}
    </div> : null}
  </div>;
}
