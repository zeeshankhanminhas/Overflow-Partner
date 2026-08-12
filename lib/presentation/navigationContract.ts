export type PrimaryNavigationGroup = 'home' | 'work' | 'commercial' | 'operations' | 'intelligence' | 'admin';

export type PrimaryNavigationContract = {
  label: string;
  href: string;
  group: PrimaryNavigationGroup;
  operatorJob: string;
  authoritativeModel: string;
  interactionPattern: string;
};

export const primaryNavigation = {
  missionControl: {
    label: 'Mission Control', href: '/workspace', group: 'home',
    operatorJob: 'See the current operating position and choose the next intervention.',
    authoritativeModel: 'Canonical presentation queues: approvals, dependencies, exceptions and portfolio snapshot.',
    interactionPattern: 'Prioritised operating brief with links to authoritative records.',
  },
  approvals: {
    label: 'Approvals', href: '/workspace/approvals', group: 'home',
    operatorJob: 'Make authority decisions that are ready for review.',
    authoritativeModel: 'Aggregated authoritative approval records; no shadow approval state.',
    interactionPattern: 'Decision queue linked back to the owning record.',
  },
  enquiries: {
    label: 'Enquiries', href: '/workspace/acquisition/prospects', group: 'work',
    operatorJob: 'Qualify incoming opportunities before Case creation.',
    authoritativeModel: 'prospects + governed acquisition/intake state.',
    interactionPattern: 'Operating register into Enquiry detail.',
  },
  cases: {
    label: 'Cases', href: '/workspace/leads', group: 'work',
    operatorJob: 'Control pre-project technical and commercial basis after qualification.',
    authoritativeModel: 'leads/Case 360 plus inherited governed evidence.',
    interactionPattern: 'Case queue into Case 360.',
  },
  assessments: {
    label: 'Partner assessments', href: '/workspace/assessments', group: 'work',
    operatorJob: 'Work technical-definition and Acquisition-owned Execution Partner assessment queues.',
    authoritativeModel: 'Case technical queue + Acquisition partner_review_requests.',
    interactionPattern: 'Specialist work queue linking to the owning Enquiry or Case.',
  },
  projects: {
    label: 'Projects', href: '/workspace/projects', group: 'work',
    operatorJob: 'Operate accepted work through governed delivery and closeout.',
    authoritativeModel: 'projects + canonical project operating presentation.',
    interactionPattern: 'Portfolio register into Project 360.',
  },
  quotes: {
    label: 'Client quotes', href: '/workspace/quotes', group: 'commercial',
    operatorJob: 'Inspect controlled client quotation records and their current outcome.',
    authoritativeModel: 'quotes + quote issue/acceptance evidence.',
    interactionPattern: 'Controlled quote register linked to Case.',
  },
  payments: {
    label: 'Payments', href: '/workspace/payments', group: 'commercial',
    operatorJob: 'Track receivable and payable settlement activity.',
    authoritativeModel: 'invoices, partner_payables and payment evidence.',
    interactionPattern: 'Financial register with evidence-backed actions.',
  },
  commercialControl: {
    label: 'Commercial control', href: '/workspace/commercial-control', group: 'commercial',
    operatorJob: 'Control project financial authorisation, billing and Partner liabilities.',
    authoritativeModel: 'commercial_terms, financial gate, invoices and partner_payables.',
    interactionPattern: 'Project-scoped financial control workspace.',
  },
  partners: {
    label: 'Execution Partners', href: '/workspace/partners', group: 'commercial',
    operatorJob: 'Maintain the approved Execution Partner register and commercial capability context.',
    authoritativeModel: 'partners and controlled partner master data.',
    interactionPattern: 'Partner register into partner record.',
  },
  issues: {
    label: 'Issues', href: '/workspace/exceptions', group: 'operations',
    operatorJob: 'Resolve genuinely off-plan operational exceptions.',
    authoritativeModel: 'Canonical operational exception model.',
    interactionPattern: 'Intervention queue linked to the owning record.',
  },
  actions: {
    label: 'Actions', href: '/workspace/tasks', group: 'operations',
    operatorJob: 'Complete assigned internal work items.',
    authoritativeModel: 'tasks.',
    interactionPattern: 'Action register with owner/status completion controls.',
  },
  documents: {
    label: 'Documents', href: '/workspace/documents', group: 'operations',
    operatorJob: 'Find and control governed publications.',
    authoritativeModel: 'documents and document lifecycle evidence.',
    interactionPattern: 'Controlled document registry into document review.',
  },
  messages: {
    label: 'Messages', href: '/workspace/communications', group: 'operations',
    operatorJob: 'Review business correspondence sent or scheduled by governed workflows.',
    authoritativeModel: 'notification_outbox business-message categories only.',
    interactionPattern: 'Compact message register/timeline linked to the owning record.',
  },
  executive: {
    label: 'Executive view', href: '/workspace/intelligence', group: 'intelligence',
    operatorJob: 'Review business performance and management signals.',
    authoritativeModel: 'Executive snapshot/read models.',
    interactionPattern: 'Management summary with drill-through.',
  },
  risk: {
    label: 'Risk & compliance', href: '/workspace/risk', group: 'intelligence',
    operatorJob: 'Review risk and compliance posture.',
    authoritativeModel: 'Risk/compliance read models.',
    interactionPattern: 'Assurance register and management summary.',
  },
  knowledge: {
    label: 'Knowledge', href: '/workspace/knowledge', group: 'intelligence',
    operatorJob: 'Access governed operating knowledge and reference material.',
    authoritativeModel: 'Knowledge records.',
    interactionPattern: 'Searchable reference library.',
  },
  search: {
    label: 'Search', href: '/workspace/search', group: 'admin',
    operatorJob: 'Find a known workspace record quickly.',
    authoritativeModel: 'Workspace search index/query layer.',
    interactionPattern: 'Search query into direct record navigation.',
  },
  notifications: {
    label: 'Notifications', href: '/workspace/notifications', group: 'admin',
    operatorJob: 'Monitor automated message delivery health and failures.',
    authoritativeModel: 'notification_outbox delivery state only.',
    interactionPattern: 'Delivery-status monitor with filters and diagnostics.',
  },
  settings: {
    label: 'Settings', href: '/workspace/settings', group: 'admin',
    operatorJob: 'Configure workspace administration and controlled system settings.',
    authoritativeModel: 'Workspace configuration records.',
    interactionPattern: 'Administrative forms grouped by configuration domain.',
  },
} as const satisfies Record<string, PrimaryNavigationContract>;

export type PrimaryNavigationKey = keyof typeof primaryNavigation;
