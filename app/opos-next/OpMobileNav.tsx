'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { nextNavigation, isNextActive } from './navigation';
import css from './opos.module.css';

export default function OpMobileNav({ statusLabel }: { statusLabel: string }) {
  const pathname=usePathname();
  const [expandedFor,setExpandedFor]=useState<string|null>(null);
  const open=expandedFor===pathname;

  return <div className={css.mobileShell}>
    <div className={css.mobileHeader}>
      <button type="button" className={css.mobileMenuTrigger}
        aria-label={open?'Close workspace navigation':'Open workspace navigation'}
        aria-controls="opos-next-mobile-menu" aria-expanded={open}
        onClick={()=>setExpandedFor(open?null:pathname)}>
        <span className={css.menuIcon} aria-hidden="true">{open?'×':'☰'}</span>
      </button>
      <Link href="/opos-next" className={css.mobileBrand} aria-label="OPOS Mission Control">OPOS</Link>
      <span className={css.mobileSpacer}/>
      <span className={css.mobilePreview}><span aria-hidden="true" className={css.mobileLiveDot}/>{statusLabel}</span>
      <span className={css.mobileAvatar} aria-label="Overflow Partner workspace">OP</span>
    </div>
    <nav id="opos-next-mobile-menu" className={css.mobileMenu} hidden={!open} aria-label="Mobile workspace navigation">
      {nextNavigation.map((destination,index)=>{
        const active=isNextActive(pathname,destination.href);
        const newGroup=index===0||destination.group!==nextNavigation[index-1].group;
        return <div key={destination.href}>
          {newGroup?<span className={css.navEyebrow}>{destination.group}</span>:null}
          <Link href={destination.href} aria-current={active?'page':undefined}
            onClick={()=>setExpandedFor(null)} className={active?css.mobileMenuActive:css.mobileMenuLink}>
            <span>{destination.label}</span>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>;
      })}
    </nav>
  </div>;
}
