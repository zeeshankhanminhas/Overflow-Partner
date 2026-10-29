'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import css from './opos.module.css';

const destinations = [
  { label: 'Mission Control', href: '/opos-next', group: 'Home' },
  { label: 'Opportunities', href: '/opos-next/opportunities', group: 'Work' },
] as const;

export default function OpMobileNav() {
  const pathname = usePathname();
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const open = expandedFor === pathname;

  return <div className={css.mobileShell}>
    <div className={css.mobileHeader}>
      <Link href="/opos-next" className={css.mobileBrand} aria-label="Overflow Partner, Mission Control">
        <span className={css.brandMark} aria-hidden="true">◈</span>
        <span>OVERFLOW<br />PARTNER</span>
      </Link>
      <button type="button" className={css.mobileMenuTrigger}
        aria-label={open ? 'Close workspace navigation' : 'Open workspace navigation'}
        aria-controls="opos-next-mobile-menu" aria-expanded={open}
        onClick={() => setExpandedFor(open ? null : pathname)}>
        <span className={css.menuIcon} aria-hidden="true">{open ? '×' : '☰'}</span>
        {open ? 'Close' : 'Menu'}
      </button>
    </div>
    <nav id="opos-next-mobile-menu" className={css.mobileMenu} hidden={!open} aria-label="Mobile workspace navigation">
      <span className={css.navEyebrow}>WORKSPACE</span>
      {destinations.map(destination => {
        const active = destination.href === '/opos-next'
          ? pathname === destination.href
          : pathname === destination.href || pathname.startsWith(destination.href + '/');
        return <Link key={destination.href} href={destination.href}
          aria-current={active ? 'page' : undefined}
          onClick={() => setExpandedFor(null)} className={active ? css.mobileMenuActive : css.mobileMenuLink}>
          <span><small>{destination.group}</small>{destination.label}</span>
          <span aria-hidden="true">↗</span>
        </Link>;
      })}
      <p className={css.mobileMenuNote}>Additional workflows will appear here after their new interfaces are verified.</p>
    </nav>
  </div>;
}
