export const opds = {
  colour: {
    ink: '#111815',
    black: '#050705',
    paper: '#F7F7F5',
    panel: '#FFFFFF',
    technical: '#ECEFEB',
    line: '#D9D6CE',
    muted: '#4B5651',
    subtle: '#737A76',
    extension: '#E64A35',
    success: '#18794E',
    warning: '#9A6700',
    danger: '#B42318',
    information: '#175CD3',
  },
  spacing: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '24px', 6: '32px', 7: '48px', 8: '64px' },
  radius: { none: '0', control: '6px', panel: '8px' },
  motion: { fast: '120ms', standard: '200ms', slow: '320ms', easing: 'cubic-bezier(.2,.8,.2,1)' },
  type: {
    family: 'Aspekta, Arial, Helvetica, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
} as const;

export type OpdsStatus = 'neutral' | 'information' | 'success' | 'warning' | 'danger';

export const statusTone: Record<string, OpdsStatus> = {
  new: 'information', qualified: 'information', draft: 'neutral', submitted: 'information', under_review: 'warning',
  clarification_required: 'warning', pending_approval: 'warning', requested: 'information', received: 'information', selected: 'success',
  approved: 'success', issued: 'success', accepted: 'success', won: 'success', active: 'success', completed: 'success',
  rejected: 'danger', declined: 'danger', lost: 'danger', expired: 'danger', cancelled: 'danger', blocked: 'danger',
};
