'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { nextNavigation, isNextActive } from './navigation';
import css from './opos.module.css';

export default function OpNav() {
  const pathname = usePathname();
  return <nav className={css.nav} aria-label="Primary workspace navigation">
    {nextNavigation.map((item,index) => {
      const newGroup=index===0||item.group!==nextNavigation[index-1].group;
      const active=isNextActive(pathname,item.href);
      return <div key={item.href} className={css.navUnit}>
        {newGroup ? <span className={css.navEyebrow}>{item.group}</span> : null}
        <Link href={item.href} aria-current={active?'page':undefined}
          className={active?css.navActive:css.navLink}>
          <span className={css.navDot} aria-hidden="true"/>{item.label}
        </Link>
      </div>;
    })}
  </nav>;
}
