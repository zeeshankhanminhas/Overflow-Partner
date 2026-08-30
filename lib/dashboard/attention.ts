export type AttentionStage = 'prospect' | 'lead' | 'technical' | 'partner' | 'commercial' | 'quote' | 'project';

export type AttentionSource = {
  id: string;
  title: string;
  company: string;
  reason: string;
  waitingSince: string;
  priority: string;
  href: string;
  stage: AttentionStage;
};

export type ResolvedAttention = AttentionSource & {
  waitingMinutes: number;
  overdue: boolean;
  ownerBucket: 'partner' | 'client' | 'internal';
  urgency: 'normal' | 'aged';
};

export type AttentionSummary = {
  items: ResolvedAttention[];
  overdue: number;
  waitingOnPartner: number;
  waitingOnClient: number;
  waitingOnInternal: number;
};

function minutesWaiting(value: string, now: Date) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 60000));
}

function ownerBucket(stage: AttentionStage): ResolvedAttention['ownerBucket'] {
  if (stage === 'partner') return 'partner';
  if (stage === 'quote') return 'client';
  return 'internal';
}

function priorityRank(value: string) {
  const normalised = String(value || '').toLowerCase();
  if (['critical', 'urgent'].includes(normalised)) return 4;
  if (normalised === 'high') return 3;
  if (normalised === 'medium') return 2;
  return 1;
}

export function resolveBusinessAttention(items: AttentionSource[], now = new Date()): AttentionSummary {
  const resolved = items.map(item => {
    const waitingMinutes = minutesWaiting(item.waitingSince, now);
    const overdue = waitingMinutes > 48 * 60;
    return {
      ...item,
      waitingMinutes,
      overdue,
      ownerBucket: ownerBucket(item.stage),
      urgency: overdue ? 'aged' as const : 'normal' as const,
    };
  }).sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority);
    if (priorityDelta) return priorityDelta;
    if (a.ownerBucket !== b.ownerBucket) {
      if (a.ownerBucket === 'internal') return -1;
      if (b.ownerBucket === 'internal') return 1;
    }
    return b.waitingMinutes - a.waitingMinutes;
  });

  return {
    items: resolved,
    overdue: resolved.filter(item => item.overdue).length,
    waitingOnPartner: resolved.filter(item => item.ownerBucket === 'partner').length,
    waitingOnClient: resolved.filter(item => item.ownerBucket === 'client').length,
    waitingOnInternal: resolved.filter(item => item.ownerBucket === 'internal').length,
  };
}

export function formatWaitingMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
