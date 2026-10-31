/** The only primary navigation contract for the OPOS vNext visual system. */
export const nextNavigation = [
  {label:'Mission Control',href:'/opos-next',group:'HOME'},
  {label:'Outreach',href:'/opos-next/outreach',group:'GROWTH'},
  {label:'Opportunities',href:'/opos-next/opportunities',group:'WORK'},
  {label:'Cases',href:'/opos-next/cases',group:'WORK'},
  {label:'Projects',href:'/opos-next/projects',group:'WORK'},
  {label:'Partners',href:'/opos-next/partners',group:'OPERATIONS'},
  {label:'Finance',href:'/opos-next/finance',group:'OPERATIONS'},
  {label:'Documents',href:'/opos-next/documents',group:'OPERATIONS'},
] as const;

export function isNextActive(pathname:string,href:string) {
  return href==='/opos-next' ? pathname===href : pathname===href||pathname.startsWith(href+'/');
}
