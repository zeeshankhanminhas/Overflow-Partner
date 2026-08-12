export type ApprovalQueueItem = {
  id: string;
  source: 'acquisition' | 'commercial' | 'document' | 'payable';
  type: string;
  title: string;
  recordLabel: string;
  status: 'ready' | 'blocked';
  reason: string;
  href: string;
  createdAt: string;
  value?: number;
  currency?: string;
};

function amount(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function canonicalDocumentSlug(value: string) {
  const aliases: Record<string,string> = {
    client_quote:'client-quote',client_requirements:'client-requirements',scope_of_work:'scope-of-work',statement_of_work:'statement-of-work',commercial_approval:'commercial-approval',partner_technical_assessment_report:'partner-technical-assessment-report',vendor_safe_package:'vendor-safe-package',handover_pack:'handover-pack',completion_report:'completion-report',document_register:'document-register',technical_review:'technical-review',invoice:'invoice',
  };
  return aliases[value] || String(value || 'document').replaceAll('_','-');
}

function documentHref(document: any) {
  const context = document.project_id ? `project=${document.project_id}` : `case=${document.lead_id}`;
  return `/workspace/documents/templates/${canonicalDocumentSlug(document.document_type)}?${context}&document_record=${document.id}`;
}

export async function getApprovalQueue(supabase: any, organisationId: string): Promise<ApprovalQueueItem[]> {
  const [partnerResult,commercialResult,documentResult,payableResult] = await Promise.all([
    supabase.from('partner_review_requests')
      .select('id,prospect_id,status,submitted_at,created_at,partner:partners(company_name),prospect:prospects(company_name),decisions:partner_review_internal_decisions(id,decision),prices:partner_quotes(id,price,currency)')
      .eq('organisation_id',organisationId)
      .not('prospect_id','is',null)
      .eq('status','submitted')
      .order('submitted_at',{ascending:true}),
    supabase.from('commercial_reviews')
      .select('id,lead_id,status,client_price,cost_price,margin_amount,margin_percent,created_at,lead:leads(company_name,title)')
      .eq('organisation_id',organisationId)
      .eq('status','pending_approval')
      .order('created_at',{ascending:true}),
    supabase.from('documents')
      .select('id,lead_id,project_id,document_type,reference,title,status,revision_code,is_current_revision,created_at,updated_at')
      .eq('organisation_id',organisationId)
      .eq('is_current_revision',true)
      .in('status',['in_review','signed'])
      .order('updated_at',{ascending:true}),
    supabase.from('partner_payables')
      .select('id,project_id,partner_id,payable_number,invoice_reference,status,total,currency,evidence_confirmed,created_at,partner:partners(company_name),project:projects(project_number,title)')
      .eq('organisation_id',organisationId)
      .in('status',['received','matched'])
      .order('created_at',{ascending:true}),
  ]);

  const items: ApprovalQueueItem[] = [];

  for (const request of (partnerResult.data || []) as any[]) {
    if ((request.decisions || []).length > 0) continue;
    const price = [...(request.prices || [])].sort((a:any,b:any)=>amount(b.price)-amount(a.price))[0];
    const ready = Boolean(price && amount(price.price) > 0);
    items.push({
      id:`acquisition-${request.id}`,
      source:'acquisition',
      type:'Go / No-Go',
      title:request.prospect?.company_name || 'Enquiry decision',
      recordLabel:request.partner?.company_name ? `Partner assessment · ${request.partner.company_name}` : 'Partner assessment',
      status:ready?'ready':'blocked',
      reason:ready?'Partner assessment and price are ready for the internal Go / No-Go decision.':'Partner assessment is received, but a positive governed Partner price is still required.',
      href:`/workspace/acquisition/${request.prospect_id}#approval-decision`,
      createdAt:String(request.submitted_at||request.created_at),
      value:price?amount(price.price):undefined,
      currency:price?.currency||'GBP',
    });
  }

  for (const review of (commercialResult.data || []) as any[]) {
    items.push({
      id:`commercial-${review.id}`,
      source:'commercial',
      type:'Commercial approval',
      title:review.lead?.company_name || review.lead?.title || 'Case commercial position',
      recordLabel:'Case 360 · Commercial review',
      status:'ready',
      reason:`Selling price and margin are waiting for an authorised commercial decision.`,
      href:`/workspace/leads/${review.lead_id}#record-next-action`,
      createdAt:String(review.created_at),
      value:amount(review.client_price),
      currency:'GBP',
    });
  }

  for (const document of (documentResult.data || []) as any[]) {
    items.push({
      id:`document-${document.id}`,
      source:'document',
      type:'Document approval',
      title:document.title || document.reference || 'Controlled document',
      recordLabel:[document.reference,document.revision_code].filter(Boolean).join(' · ') || 'Controlled document',
      status:'ready',
      reason:document.status==='signed'?'Signed revision is ready for authorised approval.':'Controlled revision is waiting for review and approval.',
      href:documentHref(document),
      createdAt:String(document.updated_at||document.created_at),
    });
  }

  for (const payable of (payableResult.data || []) as any[]) {
    const ready=Boolean(payable.evidence_confirmed);
    items.push({
      id:`payable-${payable.id}`,
      source:'payable',
      type:'Partner payable',
      title:payable.partner?.company_name || 'Execution Partner payable',
      recordLabel:[payable.payable_number,payable.project?.project_number].filter(Boolean).join(' · ') || 'Partner liability',
      status:ready?'ready':'blocked',
      reason:ready?'Delivery evidence is confirmed. The Partner payable is ready for approval.':'Delivery evidence must be confirmed before the Partner payable can be approved.',
      href:`/workspace/commercial-control?project=${payable.project_id}&focus=payable-${payable.id}`,
      createdAt:String(payable.created_at),
      value:amount(payable.total),
      currency:payable.currency||'GBP',
    });
  }

  return items.sort((a,b)=>{
    if(a.status!==b.status)return a.status==='ready'?-1:1;
    return new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime();
  });
}

export function summariseApprovalQueue(items: ApprovalQueueItem[]) {
  const ready=items.filter(item=>item.status==='ready');
  const blocked=items.filter(item=>item.status==='blocked');
  const value=items.reduce((total,item)=>total+amount(item.value),0);
  return { total:items.length, ready:ready.length, blocked:blocked.length, value };
}
