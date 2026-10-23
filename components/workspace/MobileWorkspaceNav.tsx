'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type IconName='outreach'|'home'|'opportunities'|'projects'|'more';
function Icon({name}:{name:IconName}){
  const props={width:21,height:21,viewBox:'0 0 24 24',fill:'none',
    stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,
    strokeLinejoin:'round' as const,'aria-hidden':true as const};
  if(name==='outreach')return <svg {...props}><path d="M4 5.5h16v11H9l-5 3v-14Z"/><path d="M8 10h8M8 13h5"/></svg>;
  if(name==='home')return <svg {...props}><path d="M3 10.8 12 3l9 7.8M5.5 9.7V21h13V9.7M9.5 21v-6h5v6"/></svg>;
  if(name==='opportunities')return <svg {...props}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 5V3h8v2M8 11h8M8 15h5"/></svg>;
  if(name==='projects')return <svg {...props}><path d="M4 6.5h6l1.5 2H20v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 9h16"/></svg>;
  return <svg {...props}><circle cx="5" cy="6" r="1"/><circle cx="12" cy="6" r="1"/><circle cx="19" cy="6" r="1"/><circle cx="5" cy="14" r="1"/><circle cx="12" cy="14" r="1"/><circle cx="19" cy="14" r="1"/></svg>;
}
const options=[
  {label:'Outreach',href:'/outreach',icon:'outreach' as const},
  {label:'Home',href:'/workspace',icon:'home' as const},
  {label:'Opportunities',href:'/workspace/opportunities',icon:'opportunities' as const},
  {label:'Projects',href:'/workspace/projects',icon:'projects' as const},
  {label:'More',href:'/workspace/more',icon:'more' as const},
];
export default function MobileWorkspaceNav(){
  const pathname=usePathname();
  const active=(href:string)=>href==='/workspace'?pathname===href
    :href==='/workspace/opportunities'
      ? pathname===href||pathname.startsWith('/workspace/acquisition')||pathname.startsWith('/workspace/leads')
      :pathname===href||pathname.startsWith(href+'/');
  return <nav className="midts-mobile-nav op-mobile-nav op-mobile-nav--clear" aria-label="Mobile workspace navigation">
    {options.map(item=><Link key={item.href} href={item.href}
      className={active(item.href)?'is-active':undefined}
      aria-current={active(item.href)?'page':undefined}>
      <Icon name={item.icon}/><span>{item.label}</span>
    </Link>)}
  </nav>;
}
