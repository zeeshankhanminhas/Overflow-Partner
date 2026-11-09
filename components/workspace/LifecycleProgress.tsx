import { unifiedLifecycle, type LifecyclePhase } from '@/lib/lifecycle/currentAction';
import styles from './lifecycle-progress.module.css';

const labels: Record<LifecyclePhase, string> = {
  opportunity:'Opportunity', requirements:'Requirements', feasibility:'Feasibility',
  commercial_offer:'Commercial Offer', contractual_commitment:'Contractual Commitment',
  mobilisation:'Mobilisation', execution:'Execution', quality_assurance:'Quality Assurance',
  delivery:'Delivery', payment_settlement:'Payment Settlement', closure:'Closure',
};
const projectPhases: Record<string, LifecyclePhase> = {
  mobilisation:'mobilisation', ready_for_execution:'mobilisation', in_progress:'execution',
  partner_correction:'execution', internal_review:'quality_assurance', ready_for_client_issue:'delivery',
  issued_to_client:'delivery', client_review:'delivery', completion:'payment_settlement', closed:'closure',
};
export function phaseForProject(stage:string): LifecyclePhase | undefined {
  return projectPhases[stage];
}
export default function LifecycleProgress({phase}:{phase?:LifecyclePhase}) {
  return <details className={styles.progress}><summary>
    <span>Business lifecycle</span><strong>{phase ? labels[phase] : 'Status unavailable'}</strong>
  </summary><ol>{unifiedLifecycle.map(item=><li key={item} aria-current={item===phase?'step':undefined}>{labels[item]}</li>)}</ol></details>;
}
