import type { ReactNode } from 'react';
import type { ResolvedActionState } from '@/lib/workspace/state';

type Props = {
  state: ResolvedActionState;
  children?: ReactNode;
  blockedAction?: ReactNode;
};

export default function GovernedAction({ state, children, blockedAction }: Props) {
  return <div className={`governed-action ${state.permitted ? 'is-ready' : 'is-blocked'}`}>
    <div className="governed-action__status">
      <span aria-hidden="true">{state.permitted ? '→' : '!'}</span>
      <div>
        <small>{state.permitted ? 'Ready' : 'Blocked'}</small>
        <h2>{state.label}</h2>
        <p>{state.message}</p>
      </div>
    </div>

    {!state.permitted && state.blockers.length > 0 ? <div className="governed-action__blockers">
      <strong>Resolve before progression</strong>
      <ul>{state.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
    </div> : null}

    <div className="governed-action__controls">
      {state.permitted ? children : blockedAction ?? null}
    </div>
  </div>;
}
