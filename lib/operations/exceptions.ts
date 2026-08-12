import { resolveInvoiceState, resolvePayableState } from '@/lib/finance/state';

export type ExceptionSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ExceptionCategory = 'delivery' | 'finance' | 'document' | 'task' | 'communication';

export type OperationalException = {
  id: string;
  category: ExceptionCategory;
  severity: ExceptionSeverity;
  title: string;
  detail: string;
  owner: string;
  relatedLabel: string;
  href: string;
  dueAt: string | null;
  ageMinutes: number;
  condition: string;
};

function ageMinutes(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / 60000)) : 0;
}
function overdue(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}
function profileName(value: any) { return value?.full_name || value?.first_name || 'Unassigned'; }
function severityRank(value: ExceptionSeverity) { return { critical: 4, high: 3, medium: 2, low: 1 }[value]; }

export async function getOperationalExceptions(supabase: any, organisationId: string): Promise<OperationalException[]> {
  const [deliveryResult, tasksResult, invoicesResult, payablesResult, documentsResult, outboxResult] = await Promise.all([
    supabase.from('project_delivery_items')
      .select('id,project_id,item_type,title,status,priority,due_date,updated_at,owner:profiles!project_delivery_items_owner_id_fkey(full_name,first_name),project:projects(project_number,title)')
      .eq('organisation_id', organisationId).not('status','in','(complete,cancelled)').limit(500),
    supabase.from('tasks')
      .select('id,entity_type,entity_id,title,status,priority,due_at,updated_at,assigned:profiles!tasks_assigned_to_fkey(full_name,first_name)')
      .eq('organisation_id', organisationId).not('status','in','(completed,cancelled)').limit(500),
    supabase.from('invoices')
      .select('id,project_id,invoice_number,status,total,amount_paid,currency,due_date,issued_at,created_at,project:projects(project_number,title)')
      .eq('organisation_id', organisationId).limit(500),
    supabase.from('partner_payables')
      .select('id,project_id,payable_number,status,total,amount_paid,currency,due_date,evidence_confirmed,created_at,project:projects(project_number,title),partner:partners(company_name)')
      .eq('organisation_id', organisationId).limit(500),
    supabase.from('documents')
      .select('id,project_id,lead_id,reference,title,status,updated_at,created_at,is_current_revision,revision_code,control_state')
      .eq('organisation_id', organisationId).limit(500),
    supabase.from('notification_outbox')
      .select('id,entity_type,entity_id,subject,status,last_error,attempts,max_attempts,created_at')
      .eq('organisation_id', organisationId).eq('status','failed').order('created_at',{ascending:false}).limit(100),
  ]);

  const items: OperationalException[] = [];

  for (const row of deliveryResult.data || []) {
    const project = row.project as any;
    const isOverdue = overdue(row.due_date);
    const isBlocked = row.status === 'blocked';
    if (!isOverdue && !isBlocked) continue;
    const severity: ExceptionSeverity = row.priority === 'critical' || (isBlocked && isOverdue) ? 'critical' : 'high';
    items.push({
      id:`delivery-${row.id}`, category:'delivery', severity,
      title:isBlocked ? `${row.item_type === 'milestone' ? 'Milestone' : 'Deliverable'} blocked` : `${row.item_type === 'milestone' ? 'Milestone' : 'Deliverable'} overdue`,
      detail:`${row.title}${row.due_date ? ` · due ${new Date(row.due_date).toLocaleDateString('en-GB')}` : ''}`,
      owner:profileName(row.owner), relatedLabel:project?.project_number || project?.title || 'Project',
      href:`/workspace/projects/${row.project_id}/delivery#delivery-${row.id}`,
      dueAt:row.due_date, ageMinutes:ageMinutes(row.updated_at), condition:isBlocked?'blocked':'overdue',
    });
  }

  for (const row of tasksResult.data || []) {
    const isOverdue = overdue(row.due_at);
    const isBlocked = row.status === 'blocked';
    if (!isOverdue && !isBlocked) continue;
    const projectHref = row.entity_type === 'project' ? `/workspace/projects/${row.entity_id}#record-activities` : row.entity_type === 'lead' ? `/workspace/leads/${row.entity_id}#record-activities` : '/workspace/tasks';
    items.push({
      id:`task-${row.id}`, category:'task', severity:row.priority === 'urgent' || (isBlocked && isOverdue) ? 'critical' : 'high',
      title:isBlocked?'Task blocked':'Task overdue', detail:row.title, owner:profileName(row.assigned), relatedLabel:row.entity_type === 'project'?'Project activity':row.entity_type === 'lead'?'Case activity':'Workspace task',
      href:projectHref, dueAt:row.due_at, ageMinutes:ageMinutes(row.updated_at), condition:isBlocked?'blocked':'overdue',
    });
  }

  for (const invoice of invoicesResult.data || []) {
    const state = resolveInvoiceState(invoice as any);
    if (!state.overdue || state.settled) continue;
    const project = invoice.project as any;
    items.push({
      id:`invoice-${invoice.id}`, category:'finance', severity:state.balance >= 5000 ? 'critical' : 'high',
      title:'Client payment overdue', detail:`${invoice.invoice_number} · ${new Intl.NumberFormat('en-GB',{style:'currency',currency:String(invoice.currency||'GBP')}).format(state.balance)} outstanding`, owner:'Commercial',
      relatedLabel:project?.project_number || project?.title || 'Client receivable', href:`/workspace/payments?${invoice.project_id ? `project=${invoice.project_id}&` : ''}view=overdue#invoice-${invoice.id}`,
      dueAt:invoice.due_date, ageMinutes:ageMinutes(invoice.due_date || invoice.issued_at || invoice.created_at), condition:'receivable_overdue',
    });
  }

  for (const payable of payablesResult.data || []) {
    const state = resolvePayableState(payable as any);
    if (state.settled) continue;
    const isOverdue = overdue(payable.due_date);
    const isBlocked = Boolean(state.approvalBlockedReason);
    if (!isOverdue && !isBlocked) continue;
    const project = payable.project as any; const partner = payable.partner as any;
    items.push({
      id:`payable-${payable.id}`, category:'finance', severity:isOverdue?'high':'medium',
      title:isOverdue?'Partner payment overdue':'Partner payment blocked', detail:`${partner?.company_name || payable.payable_number} · ${state.approvalBlockedReason || 'Payment is due'}`,
      owner:'Commercial', relatedLabel:project?.project_number || project?.title || 'Partner payable', href:`/workspace/payments?${payable.project_id ? `project=${payable.project_id}&` : ''}view=open#payable-${payable.id}`,
      dueAt:payable.due_date, ageMinutes:ageMinutes(payable.created_at), condition:isOverdue?'payable_overdue':'payable_blocked',
    });
  }

  for (const document of documentsResult.data || []) {
    if (document.is_current_revision === false) continue;
    const state = String(document.control_state || document.status || 'working');
    const waiting = ['review','in_review','changes_requested','signed','approved'].includes(state) || ['in_review','changes_requested','signed','approved'].includes(String(document.status));
    if (!waiting) continue;
    const age = ageMinutes(document.updated_at || document.created_at);
    if (age < 24 * 60) continue;
    const context = document.project_id ? `project=${document.project_id}` : `case=${document.lead_id}`;
    items.push({
      id:`document-${document.id}`, category:'document', severity:age > 72*60 ? 'high':'medium', title:'Document action overdue',
      detail:`${document.reference} · ${document.title} · ${document.revision_code || `v${1}`}`, owner:'Document control', relatedLabel:document.project_id?'Project document':'Case document',
      href:`/workspace/documents?${context}`, dueAt:null, ageMinutes:age, condition:'document_action_overdue',
    });
  }

  for (const row of outboxResult.data || []) {
    items.push({
      id:`communication-${row.id}`, category:'communication', severity:Number(row.attempts||0) >= Number(row.max_attempts||3) ? 'high':'medium', title:'Message delivery failed',
      detail:`${row.subject}${row.last_error ? ` · ${row.last_error}` : ''}`, owner:'Operations', relatedLabel:'Notifications',
      href:'/workspace/notifications?status=failed', dueAt:null, ageMinutes:ageMinutes(row.created_at), condition:'delivery_failed',
    });
  }

  return items.sort((a,b) => severityRank(b.severity)-severityRank(a.severity) || b.ageMinutes-a.ageMinutes);
}

export function summariseExceptions(items: OperationalException[]) {
  return {
    total: items.length,
    critical: items.filter(item=>item.severity==='critical').length,
    high: items.filter(item=>item.severity==='high').length,
    overdue: items.filter(item=>item.condition.includes('overdue')).length,
    blocked: items.filter(item=>item.condition.includes('blocked')).length,
    waitingReview: 0,
  };
}
