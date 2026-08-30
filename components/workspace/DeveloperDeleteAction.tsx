import { DecisionDialog } from '@/components/workspace/InteractionSurface';
import { developerDeleteRecordAction } from '@/app/workspace/developer-actions';

type EntityType = 'prospect' | 'lead' | 'project' | 'document';

export default function DeveloperDeleteAction({
  enabled,
  entityType,
  entityId,
  label,
  returnTo,
}: {
  enabled: boolean;
  entityType: EntityType;
  entityId: string;
  label: string;
  returnTo: string;
}) {
  if (!enabled) return null;

  return <DecisionDialog
    triggerLabel="Delete test record"
    triggerClassName="button secondary product-action product-action--destructive"
    eyebrow="Developer test control"
    title={`Delete ${label}?`}
    description="Permanent test-data cleanup. This control is available only to the developer-enabled account."
  >
    <form action={developerDeleteRecordAction} className="stack">
      <input type="hidden" name="entity_type" value={entityType}/>
      <input type="hidden" name="entity_id" value={entityId}/>
      <input type="hidden" name="return_to" value={returnTo}/>
      <div className="product-notice product-notice--critical">
        <strong>Permanent delete</strong>
        <div>{label} and the governed test records that depend on it will be removed. Normal business users should close, cancel, withdraw or archive records instead.</div>
      </div>
      <button className="button product-action product-action--destructive" type="submit">Delete permanently</button>
    </form>
  </DecisionDialog>;
}
