export type GovernedDocumentStatus =
  | 'missing'
  | 'draft'
  | 'in_review'
  | 'changes_requested'
  | 'signed'
  | 'approved'
  | 'issued'
  | 'published'
  | 'archived'
  | 'superseded';

export type WorkspaceDocument = {
  id: string;
  document_type?: string | null;
  title?: string | null;
  reference?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type EvidenceRequirement = {
  key: string;
  label: string;
  requiredStatus: 'draft' | 'in_review' | 'signed' | 'approved' | 'issued';
  aliases?: string[];
  description?: string;
};

export type ResolvedEvidenceState = EvidenceRequirement & {
  exists: boolean;
  document: WorkspaceDocument | null;
  currentStatus: GovernedDocumentStatus;
  satisfied: boolean;
  blocking: boolean;
  action: 'generate' | 'open' | 'review';
  operatorState: string;
};

export type ResolvedActionState = {label:string;permitted:boolean;blockers:string[];message:string};

const documentStatusRank: Record<GovernedDocumentStatus, number> = {
  missing:-1,draft:1,in_review:2,changes_requested:2,signed:3,approved:4,issued:5,published:5,archived:6,superseded:0,
};

function normalise(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[_-]+/g,' ').replace(/[^a-z0-9 ]+/g,'').replace(/\s+/g,' ').trim();
}

export function normaliseDocumentStatus(status: unknown): GovernedDocumentStatus {
  const value=normalise(status).replaceAll(' ','_');
  if(value==='draft')return 'draft';
  if(value==='in_review'||value==='review')return 'in_review';
  if(value==='changes_requested')return 'changes_requested';
  if(value==='signed')return 'signed';
  if(value==='approved')return 'approved';
  if(value==='issued')return 'issued';
  if(value==='published')return 'published';
  if(value==='archived')return 'archived';
  if(value==='superseded')return 'superseded';
  return 'draft';
}

export function documentSatisfiesRequirement(status: unknown, requiredStatus: EvidenceRequirement['requiredStatus']) {
  return documentStatusRank[normaliseDocumentStatus(status)] >= documentStatusRank[requiredStatus];
}

function matchesRequirement(document: WorkspaceDocument, requirement: EvidenceRequirement) {
  const candidates=[requirement.key,requirement.label,...(requirement.aliases??[])].map(normalise).filter(Boolean);
  const documentValues=[document.document_type,document.title,document.reference].map(normalise).filter(Boolean);
  return candidates.some(candidate=>documentValues.some(value=>value===candidate||value.includes(candidate)||candidate.includes(value)));
}

export function resolveEvidenceState(documents: WorkspaceDocument[], requirements: EvidenceRequirement[]): ResolvedEvidenceState[] {
  return requirements.map(requirement=>{
    const matches=documents.filter(document=>matchesRequirement(document,requirement));
    const document=[...matches].sort((a,b)=>{
      const statusDifference=documentStatusRank[normaliseDocumentStatus(b.status)]-documentStatusRank[normaliseDocumentStatus(a.status)];
      if(statusDifference!==0)return statusDifference;
      return new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime();
    })[0]??null;
    const currentStatus:GovernedDocumentStatus=document?normaliseDocumentStatus(document.status):'missing';
    const satisfied=Boolean(document)&&documentSatisfiesRequirement(currentStatus,requirement.requiredStatus);
    const action:ResolvedEvidenceState['action']=!document?'generate':satisfied?'open':'review';
    let operatorState='Not generated';
    if(document&&satisfied)operatorState=`${currentStatus.replaceAll('_',' ')} · satisfies gate`;
    else if(document)operatorState=`${currentStatus.replaceAll('_',' ')} · requires ${requirement.requiredStatus.replaceAll('_',' ')}`;
    return {...requirement,exists:Boolean(document),document,currentStatus,satisfied,blocking:!satisfied,action,operatorState};
  });
}

export function resolveActionState(input:{label:string;businessReady:boolean;blockers?:string[];readyMessage?:string;}):ResolvedActionState{
  const blockers=(input.blockers??[]).filter(Boolean);const permitted=input.businessReady&&blockers.length===0;
  return {label:input.label,permitted,blockers,message:permitted?(input.readyMessage||'All governed requirements are satisfied.'):(blockers[0]||'This action is blocked by the current governance gate.')};
}

export function evidenceRequirementFromReadinessReason(reason:string):EvidenceRequirement|null{
  const cleaned=String(reason||'').trim();const match=cleaned.match(/(?:an?\s+)?(approved|issued|signed|draft|in review)\s+(.+?)\s+is required\.?$/i);if(!match)return null;
  const requiredRaw=normalise(match[1]).replaceAll(' ','_');
  const requiredStatus:EvidenceRequirement['requiredStatus']=requiredRaw==='issued'?'issued':requiredRaw==='signed'?'signed':requiredRaw==='in_review'?'in_review':requiredRaw==='draft'?'draft':'approved';
  const label=match[2].replace(/^an?\s+/i,'').trim();return {key:normalise(label).replaceAll(' ','-'),label,requiredStatus,aliases:[label],description:cleaned};
}
