'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import css from './opos.module.css';

const navigation = [
  { label: 'Mission Control', href: '/opos-next', description: 'Home' },
  { label: 'Opportunities', href: '/opos-next/opportunities', description: 'Work' },
] as const;

export default function OpNav() {
  const pathname = usePathname();
  return (
    <nav className={css.nav} aria-label="Primary workspace navigation">
      <span className={css.navEyebrow}>OPERATE</span>
      {navigation.map(item => {
        const active = item.href === '/opos-next'
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
            className={active ? css.navActive : css.navLink}>
            <span className={css.navDot} aria-hidden="true" />{item.label}
          </Link>
        );
      })}
      <p className={css.navNote}>Additional screens will enter this navigation after visual and workflow parity checks.</p>
    </nav>
  );
}
