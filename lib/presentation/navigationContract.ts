export type PrimaryNavigationGroup = 'home' | 'work' | 'commercial' | 'operations' | 'intelligence' | 'admin';
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
    operatorJob: 'See the current operating position and choose the next intervention.',
    authoritativeModel: 'Canonical operating-position presentation aggregate.',
    interactionPattern: 'Prioritised operating brief with links to authoritative records.',
  },
  approvals: {
    label: 'Approvals', href: '/workspace/approvals', group: 'home', placement: 'primary',
    operatorJob: 'Make authority decisions that are ready for review.',
    authoritativeModel: 'Canonical approval queue over authoritative decision records; no shadow approval state.',
    interactionPattern: 'Decision queue linked back to the owning record.',
  },
  enquiries: {
    label: 'Enquiries', href: '/workspace/acquisition/prospects', group: 'work', placement: 'primary',
    operatorJob: 'Qualify incoming opportunities before Case creation.',
    authoritativeModel: 'Governed Acquisition state for prospects and intake.',
    interactionPattern: 'Operating register into Enquiry detail.',
  },
  cases: {
    label: 'Cases', href: '/workspace/leads', group: 'work', placement: 'primary',
    operatorJob: 'Control pre-project technical and commercial basis after qualification.',
    authoritativeModel: 'Case 360 governed state and inherited evidence.',
    interactionPattern: 'Case queue into Case 360.',
  },
  assessments: {
    label: 'Partner assessments', href: '/workspace/assessments', group: 'work', placement: 'contextual',
    operatorJob: 'Assess Execution Partner feasibility, capacity and price before Case creation.',
    authoritativeModel: 'Acquisition-owned partner_review_requests and governed response/decision evidence.',
    interactionPattern: 'Partner assessment queue linked to the owning Enquiry.',
  },
  projects: {
    label: 'Projects', href: '/workspace/projects', group: 'work', placement: 'primary',
    operatorJob: 'Operate accepted work through governed delivery and closeout.',
    authoritativeModel: 'Canonical Project 360 operating state.',
    interactionPattern: 'Portfolio register into Project 360.',
  },
  quotes: {
    label: 'Client quotes', href: '/workspace/quotes', group: 'commercial', placement: 'primary',
    operatorJob: 'Inspect controlled client quotation records and their current outcome.',
    authoritativeModel: 'Controlled quote state with issue and acceptance evidence.',
    interactionPattern: 'Controlled quote register linked to Case.',
  },
  payments: {
    label: 'Payments', href: '/workspace/payments', group: 'commercial', placement: 'primary',
    operatorJob: 'Track receivable and payable settlement activity.',
    authoritativeModel: 'Canonical financial settlement view over invoices, payables and payment evidence.',
    interactionPattern: 'Financial register with evidence-backed actions.',
  },
  commercialControl: {
    label: 'Commercial control', href: '/workspace/commercial-control', group: 'commercial', placement: 'primary',
    operatorJob: 'Control the project financial position and mobilisation authority.',
    authoritativeModel: 'Project commercial-control aggregate.',
    interactionPattern: 'Project-scoped financial control workspace.',
  },
  partners: {
    label: 'Execution Partners', href: '/workspace/partners', group: 'commercial', placement: 'primary',
    operatorJob: 'Maintain the approved Execution Partner register and capability context.',
    authoritativeModel: 'Controlled Execution Partner master record.',
    interactionPattern: 'Partner register into partner record.',
  },
  issues: {
    label: 'Issues', href: '/workspace/exceptions', group: 'operations', placement: 'primary',
    operatorJob: 'Resolve genuinely off-plan operational exceptions.',
    authoritativeModel: 'Canonical operational exception model.',
    interactionPattern: 'Intervention queue linked to the owning record.',
  },
  actions: {
    label: 'Actions', href: '/workspace/tasks', group: 'operations', placement: 'primary',
    operatorJob: 'Complete assigned internal work items.',
    authoritativeModel: 'Task work-item model.',
    interactionPattern: 'Action register with owner/status completion controls.',
  },
  documents: {
    label: 'Documents', href: '/workspace/documents', group: 'operations', placement: 'primary',
    operatorJob: 'Find and control governed publications.',
    authoritativeModel: 'Controlled document registry and lifecycle state.',
    interactionPattern: 'Document registry into document review.',
  },
  messages: {
    label: 'Messages', href: '/workspace/communications', group: 'operations', placement: 'contextual',
    operatorJob: 'Review business correspondence sent or scheduled by governed workflows.',
    authoritativeModel: 'notification_outbox business-message view only.',
    interactionPattern: 'Compact message register/timeline linked to the owning record.',
  },
  executive: {
    label: 'Executive view', href: '/workspace/intelligence', group: 'intelligence', placement: 'primary',
    operatorJob: 'Review business performance and management signals.',
    authoritativeModel: 'Executive management snapshot.',
    interactionPattern: 'Management summary with drill-through.',
  },
  risk: {
    label: 'Risk & compliance', href: '/workspace/risk', group: 'intelligence', placement: 'primary',
    operatorJob: 'Review risk and compliance posture.',
    authoritativeModel: 'Risk and compliance assurance view.',
    interactionPattern: 'Assurance register and management summary.',
  },
  knowledge: {
    label: 'Knowledge', href: '/workspace/knowledge', group: 'intelligence', placement: 'primary',
    operatorJob: 'Access governed operating knowledge and reference material.',
    authoritativeModel: 'Knowledge library.',
    interactionPattern: 'Searchable reference library.',
  },
  search: {
    label: 'Search', href: '/workspace/search', group: 'admin', placement: 'utility',
    operatorJob: 'Find a known workspace record quickly.',
    authoritativeModel: 'Workspace search index/query layer.',
    interactionPattern: 'Search query into direct record navigation.',
  },
  notifications: {
    label: 'Notifications', href: '/workspace/notifications', group: 'admin', placement: 'utility',
    operatorJob: 'Monitor automated message delivery health and failures.',
    authoritativeModel: 'notification_outbox delivery-state view only.',
    interactionPattern: 'Delivery-status monitor with filters and diagnostics.',
  },
  settings: {
    label: 'Settings', href: '/workspace/settings', group: 'admin', placement: 'utility',
    operatorJob: 'Configure workspace administration and controlled system settings.',
    authoritativeModel: 'Workspace configuration model.',
    interactionPattern: 'Administrative forms grouped by configuration domain.',
  },
} as const satisfies Record<string, PrimaryNavigationContract>;

export type PrimaryNavigationKey = keyof typeof primaryNavigation;