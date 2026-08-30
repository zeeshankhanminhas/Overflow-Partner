'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { DecisionDialog } from '@/components/workspace/InteractionSurface';
import { developerDeleteRecordAction } from '@/app/workspace/developer-actions';

type Target = { entityType:'prospect'|'lead'|'project'|'document'; entityId:string; label:string; returnTo:string };

function singleRecordId(pathname:string,prefix:string){
  if(!pathname.startsWith(`${prefix}/`))return null;
  const remainder=pathname.slice(prefix.length+1);
  if(!remainder||remainder.includes('/'))return null;
  return decodeURIComponent(remainder);
}

function targetFor(pathname:string,documentRecord:string|null):Target|null{
  const prospectId=singleRecordId(pathname,'/workspace/acquisition');
  if(prospectId)return {entityType:'prospect',entityId:prospectId,label:'opportunity',returnTo:'/workspace/acquisition'};

  const caseId=singleRecordId(pathname,'/workspace/leads');
  if(caseId)return {entityType:'lead',entityId:caseId,label:'Case',returnTo:'/workspace/leads'};

  const projectId=singleRecordId(pathname,'/workspace/projects');
  if(projectId)return {entityType:'project',entityId:projectId,label:'Project',returnTo:'/workspace/projects'};

  if(pathname.startsWith('/workspace/documents/templates/')&&documentRecord){
    return {entityType:'document',entityId:documentRecord,label:'document',returnTo:'/workspace/documents'};
  }
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
    description="Permanent test-data cleanup. The current record is selected automatically from the page you are viewing."
  >
    <form action={developerDeleteRecordAction} className="stack">
      <input type="hidden" name="entity_type" value={target.entityType}/>
      <input type="hidden" name="entity_id" value={target.entityId}/>
      <input type="hidden" name="return_to" value={target.returnTo}/>
      <div className="product-notice product-notice--critical">
        <strong>Permanent delete</strong>
        <div>Delete this {target.label} and governed test records that depend on it. You do not need to enter or know any internal record ID.</div>
      </div>
      <button className="button product-action product-action--destructive" type="submit">Delete this test {target.label}</button>
    </form>
  </DecisionDialog>;
}
