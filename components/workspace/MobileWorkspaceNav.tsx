'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type IconName = 'home' | 'opportunities' | 'projects' | 'approvals' | 'documents';

function NavIcon({ name }: { name: IconName }) {
  const common = { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'home') return <svg {...common}><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.7V21h13V9.7"/><path d="M9.5 21v-6h5v6"/></svg>;
  if (name === 'opportunities') return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>;
  if (name === 'projects') return <svg {...common}><path d="M4 6.5h6l1.5 2H20v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 9h16"/></svg>;
  if (name === 'approvals') return <svg {...common}><path d="M7 3.5h10v17H7z"/><path d="m9.5 12 1.8 1.8 3.5-4"/></svg>;
  return <svg {...common}><path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4"/><path d="M9 12h6"/><path d="M9 15.5h6"/></svg>;
}

function isActive(pathname: string, href: string) {
  if (href === '/workspace') return pathname === '/workspace';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileWorkspaceNav({
  home,
  opportunities,
  projects,
  approvals,
  documents,
}: {
  home: string;
  opportunities: string;
  projects: string;
  approvals: string;
  documents: string;
}) {
  const pathname = usePathname();
  const items = [
    { label: 'Home', href: home, icon: 'home' as const },
    { label: 'Opportunities', href: opportunities, icon: 'opportunities' as const },
    { label: 'Projects', href: projects, icon: 'projects' as const },
    { label: 'Approvals', href: approvals, icon: 'approvals' as const },
    { label: 'Documents', href: documents, icon: 'documents' as const },
  ];

  return <nav className="midts-mobile-nav op-mobile-nav" aria-label="Mobile workspace navigation">
    {items.map((item) => <Link key={item.label} href={item.href} className={isActive(pathname, item.href) ? 'is-active' : undefined} aria-current={isActive(pathname, item.href) ? 'page' : undefined}>
      <NavIcon name={item.icon}/>
      <span>{item.label}</span>
    </Link>)}
  </nav>;
}
