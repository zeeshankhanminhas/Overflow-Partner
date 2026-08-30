import type { ApprovalQueueItem } from '@/lib/presentation/approvals';
import type { OperationalException } from '@/lib/operations/exceptions';
import type { ResolvedAttention } from '@/lib/dashboard/attention';

export type MissionPriorityTier = 'P1' | 'P2' | 'P3' | 'P4';
export type MissionPriorityKind = 'issue' | 'approval' | 'dependency';

export type MissionPriorityItem = {
  id: string;
  kind: MissionPriorityKind;
  tier: MissionPriorityTier;
  score: number;
  label: string;
  title: string;
  detail: string;
  owner: string;
  meta: string;
  href: string;
  tone: 'critical' | 'attention' | 'waiting' | 'neutral';
  ageMinutes: number;
};

function minutesSince(value: string, now: Date) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 60000));
}

function ageWeight(minutes: number, cap = 120) {
  return Math.min(cap, Math.floor(minutes / 60));
}

function moneyWeight(value: number | undefined) {
  if (!value || value <= 0) return 0;
  return Math.min(45, Math.floor(value / 1000));
}

function tier(score: number): MissionPriorityTier {
  if (score >= 900) return 'P1';
  if (score >= 760) return 'P2';
  if (score >= 610) return 'P3';
  return 'P4';
}

function ownerForDependency(item: ResolvedAttention) {
  if (item.ownerBucket === 'partner') return 'Delivery Partner';
  if (item.ownerBucket === 'client') return 'Client';
  return 'Your team';
}

function approvalWeight(item: ApprovalQueueItem) {
  if (item.status === 'blocked') return 360;
  const sourceWeight = {
    commercial: 85,
    acquisition: 75,
    payable: 65,
    document: 45,
  }[item.source];
  return 660 + sourceWeight;
}

function approvalMeta(item: ApprovalQueueItem) {
  if (item.value === undefined) return item.type;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: item.currency || 'GBP', maximumFractionDigits: 0 }).format(item.value);
}

export function buildMissionPriorityQueue({
  approvals,
  dependencies,
  issues,
  now = new Date(),
}: {
  approvals: ApprovalQueueItem[];
  dependencies: ResolvedAttention[];
  issues: OperationalException[];
  now?: Date;
}): MissionPriorityItem[] {
  const queue: MissionPriorityItem[] = [];

  for (const item of issues) {
    const severityBase = { critical: 980, high: 820, medium: 610, low: 430 }[item.severity];
    const score = severityBase + ageWeight(item.ageMinutes, 90) + (item.condition.includes('blocked') ? 35 : 0) + (item.condition.includes('overdue') ? 25 : 0);
    queue.push({
      id: `issue-${item.id}`,
      kind: 'issue',
      tier: tier(score),
      score,
      label: item.severity === 'critical' ? 'Critical issue' : `${item.severity[0].toUpperCase()}${item.severity.slice(1)} issue`,
      title: item.title,
      detail: `${item.relatedLabel} · ${item.detail}`,
      owner: item.owner,
      meta: item.category,
      href: item.href,
      tone: item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'attention' : 'neutral',
      ageMinutes: item.ageMinutes,
    });
  }

  for (const item of approvals) {
    const ageMinutes = minutesSince(item.createdAt, now);
    const score = approvalWeight(item) + ageWeight(ageMinutes, 85) + moneyWeight(item.value);
    queue.push({
      id: `approval-${item.id}`,
      kind: 'approval',
      tier: tier(score),
      score,
      label: item.status === 'ready' ? 'Decision ready' : 'Decision blocked',
      title: item.title,
      detail: `${item.type} · ${item.reason}`,
      owner: 'Your team',
      meta: approvalMeta(item),
      href: item.href,
      tone: item.status === 'ready' ? 'waiting' : 'neutral',
      ageMinutes,
    });
  }

  for (const item of dependencies) {
    const internalBonus = item.ownerBucket === 'internal' ? 45 : 0;
    const score = (item.priority === 'high' ? 735 : 500) + (item.overdue ? 150 : 0) + internalBonus + ageWeight(item.waitingMinutes, 120);
    queue.push({
      id: `dependency-${item.id}`,
      kind: 'dependency',
      tier: tier(score),
      score,
      label: item.overdue ? 'Aged dependency' : item.priority === 'high' ? 'High dependency' : 'Dependency',
      title: item.company,
      detail: `${item.title} · ${item.reason}`,
      owner: ownerForDependency(item),
      meta: item.overdue ? 'Over 48h' : item.ownerBucket === 'internal' ? 'Internal' : 'External',
      href: item.href,
      tone: item.priority === 'high' || item.overdue ? 'attention' : 'neutral',
      ageMinutes: item.waitingMinutes,
    });
  }

  return queue.sort((a, b) => b.score - a.score || b.ageMinutes - a.ageMinutes || a.title.localeCompare(b.title));
}

export function summariseMissionPriorityQueue(items: MissionPriorityItem[]) {
  return {
    total: items.length,
    p1: items.filter(item => item.tier === 'P1').length,
    p2: items.filter(item => item.tier === 'P2').length,
    decisions: items.filter(item => item.kind === 'approval').length,
    issues: items.filter(item => item.kind === 'issue').length,
    dependencies: items.filter(item => item.kind === 'dependency').length,
  };
}
