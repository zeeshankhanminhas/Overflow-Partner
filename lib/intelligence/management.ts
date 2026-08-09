import { getOperationalExceptions, summariseExceptions } from '@/lib/operations/exceptions';
import { resolveInvoiceState, resolvePayableState } from '@/lib/finance/state';

export type ReportingPeriod = '30d' | '90d' | '365d' | 'all';
type PartnerStat = { id:string; name:string; requests:number; submitted:number; onTime:number; responseHours:number[]; rating:number|null };

function sinceDate(period: ReportingPeriod) {
  if (period === 'all') return null;
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 365;
  return new Date(Date.now() - days * 86400000).toISOString();
}
function inWindow(value: string | null | undefined, since: string | null) {
  if (!since) return true;
  if (!value) return false;
  return new Date(value).getTime() >= new Date(since).getTime();
}
function hoursBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const value = (new Date(end).getTime() - new Date(start).getTime()) / 3600000;
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function sum<T>(rows: T[], selector: (row: T) => number) { return rows.reduce((total, row) => total + selector(row), 0); }
function ratio(numerator: number, denominator: number) { return denominator > 0 ? numerator / denominator : 0; }

export async function getManagementIntelligence(supabase: any, organisationId: string, period: ReportingPeriod = '90d') {
  const since = sinceDate(period);
  const [prospectsResult, leadsResult, quotesResult, projectsResult, deliveryResult, invoicesResult, paymentsResult, payablesResult, partnerPaymentsResult, documentsResult, issueRecordsResult, partnersResult, partnerReviewsResult, risksResult, exceptions] = await Promise.all([
    supabase.from('prospects').select('id,source,status,created_at,updated_at,converted_lead_id').eq('organisation_id', organisationId).limit(2000),
    supabase.from('leads').select('id,status,source,created_at,updated_at').eq('organisation_id', organisationId).limit(2000),
    supabase.from('quotes').select('id,lead_id,quote_number,status,total,currency,created_at,updated_at,issued_at,accepted_at,valid_until').eq('organisation_id', organisationId).limit(2000),
    supabase.from('projects').select('id,project_number,title,status,project_stage,created_at,updated_at,start_date,due_date,project_manager_id').eq('organisation_id', organisationId).limit(1000),
    supabase.from('project_delivery_items').select('id,project_id,item_type,status,priority,due_date,created_at,updated_at,completed_at,owner_id,owner:profiles!project_delivery_items_owner_id_fkey(full_name,first_name)').eq('organisation_id', organisationId).limit(5000),
    supabase.from('invoices').select('id,project_id,status,total,amount_paid,currency,due_date,issued_at,paid_at,created_at').eq('organisation_id', organisationId).limit(3000),
    supabase.from('payments').select('id,project_id,amount,currency,status,paid_at,created_at').eq('organisation_id', organisationId).limit(5000),
    supabase.from('partner_payables').select('id,project_id,partner_id,status,total,amount_paid,currency,due_date,created_at').eq('organisation_id', organisationId).limit(3000),
    supabase.from('partner_payments').select('id,project_id,amount,currency,status,paid_at,created_at').eq('organisation_id', organisationId).limit(5000),
    supabase.from('documents').select('id,project_id,lead_id,document_type,status,control_state,is_current_revision,created_at,updated_at,approved_at,issued_at').eq('organisation_id', organisationId).limit(5000),
    supabase.from('document_issue_records').select('id,document_id,project_id,lead_id,revision_code,purpose,issued_at').eq('organisation_id', organisationId).limit(5000),
    supabase.from('partners').select('id,company_name,status,rating,created_at').eq('organisation_id', organisationId).limit(1000),
    supabase.from('partner_review_requests').select('id,partner_id,status,created_at,sent_at,submitted_at,response_due_at').eq('organisation_id', organisationId).limit(3000),
    supabase.from('risk_register').select('id,status,likelihood,impact,category,created_at,updated_at').eq('organisation_id', organisationId).limit(3000),
    getOperationalExceptions(supabase, organisationId),
  ]);

  const prospects=(prospectsResult.data||[]) as any[], leads=(leadsResult.data||[]) as any[], quotes=(quotesResult.data||[]) as any[], projects=(projectsResult.data||[]) as any[];
  const delivery=(deliveryResult.data||[]) as any[], invoices=(invoicesResult.data||[]) as any[], payments=(paymentsResult.data||[]) as any[], payables=(payablesResult.data||[]) as any[], partnerPayments=(partnerPaymentsResult.data||[]) as any[];
  const documents=(documentsResult.data||[]) as any[], issues=(issueRecordsResult.data||[]) as any[], partners=(partnersResult.data||[]) as any[], partnerReviews=(partnerReviewsResult.data||[]) as any[], risks=(risksResult.data||[]) as any[];

  const periodProspects=prospects.filter(row=>inWindow(row.created_at,since));
  const convertedProspects=periodProspects.filter(row=>row.status==='converted'||row.converted_lead_id);
  const periodLeads=leads.filter(row=>inWindow(row.created_at,since));
  const wonLeads=periodLeads.filter(row=>row.status==='won'), lostLeads=periodLeads.filter(row=>row.status==='lost');
  const periodQuotes=quotes.filter(row=>inWindow(row.issued_at||row.created_at,since));
  const decidedQuotes=periodQuotes.filter(row=>['accepted','declined','expired'].includes(row.status));
  const acceptedQuotes=periodQuotes.filter(row=>row.status==='accepted');
  const openQuotes=quotes.filter(row=>row.status==='issued');
  const openQuoteValue=sum(openQuotes,row=>Number(row.total||0)), acceptedValue=sum(acceptedQuotes,row=>Number(row.total||0));

  const liveProjects=projects.filter(row=>!['completed','closed','cancelled'].includes(row.status));
  const completedProjects=projects.filter(row=>['completed','closed'].includes(row.status)&&inWindow(row.updated_at||row.due_date||row.created_at,since));
  const now=Date.now();
  const overdueProjects=liveProjects.filter(row=>row.due_date&&new Date(row.due_date).getTime()<now);
  const dueSoonProjects=liveProjects.filter(row=>row.due_date&&new Date(row.due_date).getTime()>=now&&new Date(row.due_date).getTime()<=now+7*86400000);
  const openDelivery=delivery.filter(row=>!['complete','cancelled'].includes(row.status));
  const overdueDelivery=openDelivery.filter(row=>row.due_date&&new Date(row.due_date).getTime()<now), blockedDelivery=openDelivery.filter(row=>row.status==='blocked');
  const reviewDelivery=openDelivery.filter(row=>['internal_review','client_review','ready_to_issue'].includes(row.status));
  const periodCompletedDelivery=delivery.filter(row=>row.status==='complete'&&inWindow(row.completed_at,since));
  const periodDueDelivery=delivery.filter(row=>row.due_date&&inWindow(row.due_date,since));
  const onTimeDelivery=periodCompletedDelivery.filter(row=>!row.due_date||new Date(row.completed_at).getTime()<=new Date(row.due_date).getTime());

  const invoiceStates=invoices.map(invoice=>({invoice,state:resolveInvoiceState(invoice)})), payableStates=payables.map(payable=>({payable,state:resolvePayableState(payable)}));
  const issuedInvoices=invoices.filter(row=>!['draft','cancelled','refunded'].includes(row.status));
  const invoicedValue=sum(issuedInvoices,row=>Number(row.total||0));
  const cashCollected=sum(payments.filter(row=>row.status==='cleared'),row=>Number(row.amount||0));
  const cashCollectedPeriod=sum(payments.filter(row=>row.status==='cleared'&&inWindow(row.paid_at||row.created_at,since)),row=>Number(row.amount||0));
  const receivables=sum(invoiceStates.filter(row=>!row.state.settled),row=>row.state.balance), overdueReceivables=sum(invoiceStates.filter(row=>row.state.overdue&&!row.state.settled),row=>row.state.balance);
  const partnerCommitted=sum(payables.filter(row=>!['draft','cancelled'].includes(row.status)),row=>Number(row.total||0)), partnerOutstanding=sum(payableStates.filter(row=>!row.state.settled),row=>row.state.balance);
  const partnerCashPaid=sum(partnerPayments.filter(row=>row.status==='cleared'),row=>Number(row.amount||0));
  const forecastGrossMargin=invoicedValue-partnerCommitted, realisedCashContribution=cashCollected-partnerCashPaid;

  const currentDocuments=documents.filter(row=>row.is_current_revision!==false), periodDocuments=documents.filter(row=>inWindow(row.created_at,since)), periodIssues=issues.filter(row=>inWindow(row.issued_at,since));
  const waitingDocuments=currentDocuments.filter(row=>['in_review','changes_requested','signed','approved'].includes(String(row.status))), issuedDocuments=periodDocuments.filter(row=>['issued','published'].includes(String(row.status)));
  const approvalCycleHours=documents.map(row=>hoursBetween(row.created_at,row.approved_at)).filter((v):v is number=>v!==null), issueCycleHours=documents.map(row=>hoursBetween(row.created_at,row.issued_at)).filter((v):v is number=>v!==null);

  const partnerMap=new Map(partners.map(row=>[row.id,row]));
  const partnerStats=new Map<string,PartnerStat>();
  for(const review of partnerReviews.filter(row=>inWindow(row.sent_at||row.created_at,since))){
    const partner=partnerMap.get(review.partner_id) as any; if(!partner) continue;
    const stat:PartnerStat=partnerStats.get(partner.id)??{id:partner.id,name:partner.company_name,requests:0,submitted:0,onTime:0,responseHours:[],rating:partner.rating==null?null:Number(partner.rating)};
    stat.requests+=1;
    if(review.submitted_at){stat.submitted+=1;if(!review.response_due_at||new Date(review.submitted_at).getTime()<=new Date(review.response_due_at).getTime())stat.onTime+=1;const h=hoursBetween(review.sent_at||review.created_at,review.submitted_at);if(h!==null)stat.responseHours.push(h);}
    partnerStats.set(partner.id,stat);
  }
  const partnerPerformance=[...partnerStats.values()].map(stat=>({...stat,responseRate:ratio(stat.submitted,stat.requests),onTimeRate:ratio(stat.onTime,stat.submitted),averageResponseHours:stat.responseHours.length?sum(stat.responseHours,value=>value)/stat.responseHours.length:null})).sort((a,b)=>b.responseRate-a.responseRate||b.onTimeRate-a.onTimeRate||(a.averageResponseHours??99999)-(b.averageResponseHours??99999));

  const workloadMap=new Map<string,{owner:string;open:number;overdue:number;blocked:number;review:number}>();
  for(const item of openDelivery){const owner=item.owner?.full_name||item.owner?.first_name||'Unassigned';const stat=workloadMap.get(owner)??{owner,open:0,overdue:0,blocked:0,review:0};stat.open+=1;if(item.due_date&&new Date(item.due_date).getTime()<now)stat.overdue+=1;if(item.status==='blocked')stat.blocked+=1;if(['internal_review','client_review','ready_to_issue'].includes(item.status))stat.review+=1;workloadMap.set(owner,stat);}
  const workload=[...workloadMap.values()].sort((a,b)=>(b.overdue+b.blocked*2)-(a.overdue+a.blocked*2)||b.open-a.open);

  const sourceMap=new Map<string,{source:string;prospects:number;converted:number}>();
  for(const row of periodProspects){const source=row.source||'unknown';const stat=sourceMap.get(source)??{source,prospects:0,converted:0};stat.prospects+=1;if(row.status==='converted'||row.converted_lead_id)stat.converted+=1;sourceMap.set(source,stat);}
  const sourcePerformance=[...sourceMap.values()].map(stat=>({...stat,conversionRate:ratio(stat.converted,stat.prospects)})).sort((a,b)=>b.converted-a.converted||b.conversionRate-a.conversionRate);

  const exceptionSummary=summariseExceptions(exceptions), exceptionCategories=['delivery','finance','document','task','communication'].map(category=>({category,count:exceptions.filter(item=>item.category===category).length}));
  const openRisks=risks.filter(row=>row.status!=='closed'), highRisks=openRisks.filter(row=>Number(row.likelihood||0)*Number(row.impact||0)>=12);

  return {
    period,since,
    acquisition:{prospects:periodProspects.length,convertedProspects:convertedProspects.length,prospectConversionRate:ratio(convertedProspects.length,periodProspects.length),cases:periodLeads.length,wonCases:wonLeads.length,lostCases:lostLeads.length,quoteIssued:periodQuotes.length,quoteAccepted:acceptedQuotes.length,quoteWinRate:ratio(acceptedQuotes.length,decidedQuotes.length),openQuoteValue,acceptedValue,sourcePerformance},
    delivery:{liveProjects:liveProjects.length,completedProjects:completedProjects.length,overdueProjects:overdueProjects.length,dueSoonProjects:dueSoonProjects.length,openItems:openDelivery.length,overdueItems:overdueDelivery.length,blockedItems:blockedDelivery.length,reviewItems:reviewDelivery.length,completedItems:periodCompletedDelivery.length,onTimeRate:ratio(onTimeDelivery.length,periodDueDelivery.length||periodCompletedDelivery.length),workload},
    finance:{invoicedValue,cashCollected,cashCollectedPeriod,receivables,overdueReceivables,collectionRate:ratio(cashCollected,invoicedValue),partnerCommitted,partnerOutstanding,partnerCashPaid,forecastGrossMargin,forecastMarginRate:ratio(forecastGrossMargin,invoicedValue),realisedCashContribution},
    documents:{created:periodDocuments.length,issued:issuedDocuments.length,issueRecords:periodIssues.length,waiting:waitingDocuments.length,issueRate:ratio(issuedDocuments.length,periodDocuments.length),averageApprovalHours:approvalCycleHours.length?sum(approvalCycleHours,value=>value)/approvalCycleHours.length:null,averageIssueHours:issueCycleHours.length?sum(issueCycleHours,value=>value)/issueCycleHours.length:null},
    partners:{approved:partners.filter(row=>row.status==='approved').length,performance:partnerPerformance},
    exceptions:{summary:exceptionSummary,categories:exceptionCategories,top:exceptions.slice(0,8)},
    risk:{open:openRisks.length,high:highRisks.length},
  };
}
