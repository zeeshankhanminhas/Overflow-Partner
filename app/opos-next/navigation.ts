/** The only primary navigation contract for the OPOS vNext visual system. */
export const nextNavigation = [
  {label:'Mission Control',href:'/opos-next',group:'HOME'},
  {label:'Outreach',href:'/opos-next/outreach',group:'GROWTH'},
  {label:'Opportunities',href:'/opos-next/opportunities',group:'WORK'},
  {label:'Cases',href:'/opos-next/cases',group:'WORK'},
  {label:'Projects',href:'/opos-next/projects',group:'WORK'},
  {label:'Tasks',href:'/opos-next/tasks',group:'WORK'},
  {label:'Accounts',href:'/opos-next/accounts',group:'RELATIONSHIPS'},
  {label:'Partners',href:'/opos-next/partners',group:'OPERATIONS'},
  {label:'Finance',href:'/opos-next/finance',group:'OPERATIONS'},
  {label:'Documents',href:'/opos-next/documents',group:'OPERATIONS'},
  {label:'Client Workspace',href:'/portal/client',group:'PORTAL PREVIEW'},
  {label:'Partner Workspace',href:'/portal/partner',group:'PORTAL PREVIEW'},
  {label:'E2E Walkthrough',href:'/opos-next/qa/walkthrough',group:'QA TRAINING'},
] as const;

export function isNextActive(pathname:string,href:string) {
  return href==='/opos-next' ? pathname===href : pathname===href||pathname.startsWith(href+'/');
}

// Single navigation grouping shared by desktop and mobile.
// Keep the complete route inventory above; QA/portal-preview routes are not daily navigation.
const primaryLabels = new Set(['Mission Control','Opportunities','Projects','Tasks','Finance','Documents']);
const moreLabels = new Set(['Outreach','Cases','Accounts','Partners']);
export const nextPrimaryNavigation = nextNavigation.filter(item => primaryLabels.has(item.label));
export const nextMoreNavigation = nextNavigation.filter(item => moreLabels.has(item.label));
