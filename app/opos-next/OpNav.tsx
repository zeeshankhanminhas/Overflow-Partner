'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { nextNavigation, isNextActive } from './navigation';
import css from './opos.module.css';

// Retain every route, but give only everyday work primary navigation space.
const primaryLabels = new Set(['Mission Control','Outreach','Opportunities','Cases','Projects']);
const secondaryLabels = new Set(['Tasks','Accounts','Partners','Finance','Documents']);

export default function OpNav() {
  const pathname = usePathname();
  const primary=nextNavigation.filter(item=>primaryLabels.has(item.label));
  const secondary=nextNavigation.filter(item=>secondaryLabels.has(item.label));
  return <nav className={css.nav} aria-label="Primary workspace navigation">
    {primary.map(item=>{
      const active=isNextActive(pathname,item.href);
      return <div key={item.href} className={css.navUnit}>
        <Link href={item.href} aria-current={active?'page':undefined} className={active?css.navActive:css.navLink}>
          <span className={css.navDot} aria-hidden="true"/>{item.label}
        </Link>
      </div>;
    })}
    <details className={css.navMore} open={secondary.some(item=>isNextActive(pathname,item.href))}>
      <summary>More</summary>
      {secondary.map(item=>{
        const active=isNextActive(pathname,item.href);
        return <Link key={item.href} href={item.href} aria-current={active?'page':undefined}
          className={active?css.navActive:css.navLink}>
          <span className={css.navDot} aria-hidden="true"/>{item.label}
        </Link>;
      })}
    </details>
  </nav>;
}
