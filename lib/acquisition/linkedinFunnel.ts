/**
 * Marketing qualification is deliberately separate from the governed
 * technical/partner Go / No-Go qualification in Acquisition / Case 360.
 * This view uses existing Prospect outreach evidence (no parallel CRM state).
 */
export type LinkedInProspect = {
  id: string;
  company_name: string;
  source?: string | null;
  contact_name?: string | null;
  status?: string | null;
  outreach_status?: string | null;
  response_outcome?: string | null;
  next_follow_up_at?: string | null;
  converted_lead_id?: string | null;
};

/** Website and LinkedIn enquiries become eligible for technical Step 2 only after interested reply. */
export function canInviteFromLinkedIn(prospect: Pick<LinkedInProspect, 'source' | 'outreach_status' | 'response_outcome'>): boolean {
  const needsInterest = prospect.source === 'linkedin' || prospect.source === 'website';
  return !needsInterest || (prospect.outreach_status === 'replied' && prospect.response_outcome === 'interested');
}

export const linkedinFunnelStages = [
  { key: 'identified', label: 'Identified', description: 'Research the company and appropriate contact.' },
  { key: 'outreach', label: 'Outreach', description: 'Connect, send a personal message, and follow up.' },
  { key: 'conversation', label: 'Conversation', description: 'Understand whether overflow support could be useful.' },
  { key: 'interested', label: 'Interested', description: 'Interest is recorded. Hand off to the formal enquiry.' },
  { key: 'handoff', label: 'Enquiry handoff', description: 'Secure requirements intake started, or a governed case exists.' },
] as const;

export type LinkedInFunnelStage = typeof linkedinFunnelStages[number]['key'] | 'nurture' | 'closed';

export function linkedInFunnelStage(prospect: LinkedInProspect, hasIntake = false): LinkedInFunnelStage {
  if (prospect.status === 'converted' || prospect.status === 'qualified' || prospect.converted_lead_id || hasIntake) return 'handoff';
  if (prospect.status === 'not_a_fit' || prospect.response_outcome === 'not_interested') return 'closed';
  if (prospect.outreach_status === 'paused' || prospect.outreach_status === 'no_response' || prospect.response_outcome === 'later') return 'nurture';
  if (prospect.outreach_status === 'replied' && prospect.response_outcome === 'interested') return 'interested';
  if (prospect.outreach_status === 'replied' || prospect.status === 'conversation') return 'conversation';
  if (['message_sent','follow_up_due'].includes(String(prospect.outreach_status)) || prospect.status === 'contacted') return 'outreach';
  return 'identified';
}

/** Nurture prospects can still have an overdue follow-up; only paused, closed, and handed-off records are excluded. */
export function isLinkedInFollowUpDue(prospect: LinkedInProspect, stage: LinkedInFunnelStage, now = Date.now()): boolean {
  if (stage === 'handoff' || stage === 'closed' || prospect.outreach_status === 'paused' || !prospect.next_follow_up_at) return false;
  const dueAt = new Date(prospect.next_follow_up_at).getTime();
  return Number.isFinite(dueAt) && dueAt <= now;
}
