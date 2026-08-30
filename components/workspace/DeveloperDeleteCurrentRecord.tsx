'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { DecisionDialog } from '@/components/workspace/InteractionSurface';
import { developerDeleteRecordAction } from '@/app/workspace/developer-actions';

type Target = { entityType:'prospect'|'lead'|'project'|'document'; entityId:string; label:string; returnTo:string };

const UUID='([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})';

function targetFor(pathname:string,documentRecord:string|null):Target|null{
  let match=pathname.match(new RegExp(`^/workspace/acquisition/${UUID}$`));
  if(match)return {entityType:'prospect',entityId:match[1],label:'opportunity',returnTo:'/workspace/acquisition'};
  match=pathname.match(new RegExp(`^/workspace/leads/${UUID}$`));
  if(match)return {entityType:'lead',entityId:match[1],label:'Case',returnTo:'/workspace/leads'};
  match=pathname.match(new RegExp(`^/workspace/projects/${UUID}$`));
  if(match)return {entityType:'project',entityId:match[1],label:'Project',returnTo:'/workspace/projects'};
  if(pathname.startsWith('/workspace/documents/templates/')&&documentRecord&&new RegExp(`^${UUID}$`).test(documentRecord))return {entityType:'document',entityId:documentRecord,label:'document',returnTo:'/workspace/documents'};
  return null;
}

export default function DeveloperDeleteCurrentRecord({enabled}:{enabled:boolean}){
  const pathname=usePathname();
  const search=useSearchParams();
  if(!enabled)return null;
  const target=targetFor(pathname,search.get('document_record'));
  if(!target)return null;

  return <DecisionDialog
    triggerLabel="Delete test"
    triggerClassName="button secondary product-action product-action--destructive developer-delete-trigger"
    triggerAriaLabel={`Delete this ${target.label} test record`}
    eyebrow="Developer test control"
    title={`Delete this ${target.label}?`}
    description="Permanent test-data cleanup. This control is visible only on the developer-enabled account."
  >
    <form action={developerDeleteRecordAction} className="stack">
      <input type="hidden" name="entity_type" value={target.entityType}/>
      <input type="hidden" name="entity_id" value={target.entityId}/>
      <input type="hidden" name="return_to" value={target.returnTo}/>
      <div className="product-notice product-notice--critical">
        <strong>Permanent delete</strong>
        <div>Delete this {target.label} and governed test records that depend on it. Normal business users should use lifecycle closure, cancellation, withdrawal or archive instead.</div>
      </div>
      <button className="button product-action product-action--destructive" type="submit">Delete permanently</button>
    </form>
  </DecisionDialog>;
}
