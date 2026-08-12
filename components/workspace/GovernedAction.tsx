import type { ReactNode } from 'react';
import type { ResolvedActionState } from '@/lib/workspace/state';

type Props = {
  state: ResolvedActionState;
  children?: ReactNode;
  blockedAction?: ReactNode;
};

const actionLabels: Record<string,string> = {
  'Await Partner commencement': 'Waiting for Execution Partner',
  'Record controlled client transmittal': 'Send approved delivery to client',
  'Record Client Review outcome': 'Record client outcome',
  'Authorise execution': 'Release to Execution Partner',
  'Start engineering work': 'Waiting for Execution Partner',
  'Submit for internal review': 'Review Partner delivery',
  'Approve for client issue': 'Approve for client release',
  'Record client issue': 'Send approved delivery to client',
  'Start client review': 'Open client review',
  'Record completion': 'Record client outcome',
  'Return to work in progress': 'Return to Partner execution',
  'Create governed Case 360': 'Create Case 360',
  'Request governed partner review': 'Send Partner assessment',
  'Wait for partner response': 'Waiting for Execution Partner',
  'Review and record Go / No-Go': 'Record Go / No-Go',
};

function humanAction(value:string){return actionLabels[value]||value;}

function humanBlocker(value:string){
  return value
    .replace('Execution Partner commencement declaration is required.','Partner commencement required.')
    .replace('Execution Partner delivery submission is required before internal review.','Partner delivery required before internal review.')
    .replace('Client transmittal record is required.','Client delivery record required.')
    .replace('Client Review outcome is required.','Client outcome required.')
    .replace('At least one delivery activity is required.','Delivery plan required.')
    .replace('controlled document','document')
    .replace('Controlled document','Document');
}

function humanMessage(value:string){
  return value
    .replace('Partner commencement has been received.','Partner start confirmed.')
    .replace('All requirements for this transition are satisfied.','Everything needed for the next step is ready.')
    .replace('The project is now ready to advance.','Ready for the next step.');
}

export default function GovernedAction({ state, children, blockedAction }: Props) {
  const label=humanAction(state.label);
  const message=humanMessage(state.message);
  const blockers=state.blockers.map(humanBlocker);

  return <div className={`governed-action ${state.permitted ? 'is-ready' : 'is-blocked'}`}>
    <div className="governed-action__status">
      <span aria-hidden="true">{state.permitted ? '→' : '!'}</span>
      <div>
        <small>{state.permitted ? 'Ready' : 'Needs attention'}</small>
        <h2>{label}</h2>
        <p>{message}</p>
      </div>
    </div>

    {!state.permitted && blockers.length > 0 ? <div className="governed-action__blockers">
      <strong>Resolve these first</strong>
      <ul>{blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
    </div> : null}

    <div className="governed-action__controls">
      {state.permitted ? children : blockedAction ?? null}
    </div>
  </div>;
}
