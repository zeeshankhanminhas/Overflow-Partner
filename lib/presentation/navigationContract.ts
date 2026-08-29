export type PrimaryNavigationGroup = 'home' | 'work' | 'commercial' | 'delivery' | 'management' | 'admin';
export type WorkspaceNavigationPlacement = 'primary' | 'contextual' | 'utility';

export type PrimaryNavigationContract = {
  label: string;
  href: string;
  group: PrimaryNavigationGroup;
  placement: WorkspaceNavigationPlacement;
  operatorJob: string;
  authoritativeModel: string;
  interactionPattern: string;
};

export const primaryNavigation = {
  missionControl: {
    label: 'Mission Control', href: '/workspace', group: 'home', placement: 'primary',
    operatorJob: 'See what needs attention and choose the next intervention.',
    authoritativeModel: 'Canonical operating-position presentation aggregate.',
    interactionPattern: 'Prioritised operating brief linked to authoritative work.',
  },
  approvals: {
    label: 'Approvals', href: '/workspace/approvals', group: 'home', placement: 'primary',
    operatorJob: 'Make decisions that are ready for approval.',
    authoritativeModel: 'Canonical approval queue over authoritative decision records.',
    interactionPattern: 'Decision queue linked back to the owning work.',
  },
  enquiries: {
    label: 'Opportunities', href: '/workspace/acquisition/prospects', group: 'work', placement: 'primary',
    operatorJob: 'Qualify and progress pre-project opportunities.',
    authoritativeModel: 'Acquisition and pre-project opportunity state.',
    interactionPattern: 'Opportunity queue into the current commercial record.',
  },
  cases: {
    label: 'Opportunities', href: '/workspace/leads', group: 'work', placement: 'contextual',
    operatorJob: 'Control requirements, delivery review, pricing and quote preparation.',
    authoritativeModel: 'Pre-project opportunity state and inherited evidence.',
    interactionPattern: 'Contextual opportunity workspace after qualification.',
  },
  assessments: {
    label: 'Delivery reviews', href: '/workspace/assessments', group: 'work', placement: 'contextual',
    operatorJob: 'Confirm delivery feasibility, capacity and partner response.',
    authoritativeModel: 'Acquisition-owned partner review request and response evidence.',
    interactionPattern: 'Contextual review linked to its opportunity.',
  },
  projects: {
    label: 'Projects', href: '/workspace/projects', group: 'work', placement: 'primary',
    operatorJob: 'Operate accepted work through delivery and closeout.',
    authoritativeModel: 'Canonical project operating state.',
    interactionPattern: 'Portfolio register into Project Overview.',
  },
  quotes: {
    label: 'Quotes', href: '/workspace/quotes', group: 'commercial', placement: 'primary',
    operatorJob: 'Inspect client quotations and their current outcome.',
    authoritativeModel: 'Quote state with issue and acceptance evidence.',
    interactionPattern: 'Quote register linked to Opportunity.',
  },
  payments: {
    label: 'Payments', href: '/workspace/payments', group: 'commercial', placement: 'primary',
    operatorJob: 'Track receivable and payable settlement activity.',
    authoritativeModel: 'Canonical financial settlement view.',
    interactionPattern: 'Financial register with evidence-backed actions.',
  },
  commercialControl: {
    label: 'Commercials', href: '/workspace/commercial-control', group: 'commercial', placement: 'contextual',
    operatorJob: 'Control project financial position and mobilisation authority.',
    authoritativeModel: 'Project commercial-control aggregate.',
    interactionPattern: 'Project-scoped commercial workspace.',
  },
  partners: {
    label: 'Delivery Partners', href: '/workspace/partners', group: 'delivery', placement: 'primary',
    operatorJob: 'Maintain delivery partner capability and availability context.',
    authoritativeModel: 'Delivery Partner master record.',
    interactionPattern: 'Partner register into partner record.',
  },
  issues: {
    label: 'Issues', href: '/workspace/exceptions', group: 'delivery', placement: 'primary',
    operatorJob: 'Resolve off-plan operational issues.',
    authoritativeModel: 'Canonical operational issue model.',
    interactionPattern: 'Intervention queue linked to the owning work.',
  },
  actions: {
    label: 'Actions', href: '/workspace/tasks', group: 'delivery', placement: 'contextual',
    operatorJob: 'Complete assigned internal work items.',
    authoritativeModel: 'Task work-item model.',
    interactionPattern: 'Contextual task list surfaced through Mission Control and records.',
  },
  documents: {
    label: 'Documents', href: '/workspace/documents', group: 'delivery', placement: 'primary',
    operatorJob: 'Find, review and control current documents.',
    authoritativeModel: 'Document registry and lifecycle state.',
    interactionPattern: 'Document registry into document review.',
  },
  messages: {
    label: 'Messages', href: '/workspace/communications', group: 'delivery', placement: 'contextual',
    operatorJob: 'Review business correspondence linked to work.',
    authoritativeModel: 'Business-message view.',
    interactionPattern: 'Contextual message timeline linked to owning work.',
  },
  executive: {
    label: 'Management', href: '/workspace/intelligence', group: 'management', placement: 'primary',
    operatorJob: 'Review business performance and management signals.',
    authoritativeModel: 'Management snapshot.',
    interactionPattern: 'Management summary with drill-through.',
  },
  risk: {
    label: 'Risk & Compliance', href: '/workspace/risk', group: 'management', placement: 'contextual',
    operatorJob: 'Review risk and compliance posture.',
    authoritativeModel: 'Risk and compliance assurance view.',
    interactionPattern: 'Management lens linked to operational issues.',
  },
  knowledge: {
    label: 'Knowledge', href: '/workspace/knowledge', group: 'management', placement: 'utility',
    operatorJob: 'Access operating knowledge and reference material.',
    authoritativeModel: 'Knowledge library.',
    interactionPattern: 'Searchable reference library.',
  },
  search: {
    label: 'Search', href: '/workspace/search', group: 'admin', placement: 'utility',
    operatorJob: 'Find a known workspace item quickly.',
    authoritativeModel: 'Workspace search layer.',
    interactionPattern: 'Search query into direct navigation.',
  },
  notifications: {
    label: 'Notifications', href: '/workspace/notifications', group: 'admin', placement: 'utility',
    operatorJob: 'Inspect message-delivery diagnostics when needed.',
    authoritativeModel: 'Notification delivery-state view.',
    interactionPattern: 'Administrative diagnostics rather than primary operational navigation.',
  },
  settings: {
    label: 'Settings', href: '/workspace/settings', group: 'admin', placement: 'utility',
    operatorJob: 'Configure workspace settings.',
    authoritativeModel: 'Workspace configuration model.',
    interactionPattern: 'Administrative forms grouped by configuration domain.',
  },
} as const satisfies Record<string, PrimaryNavigationContract>;

export type PrimaryNavigationKey = keyof typeof primaryNavigation;