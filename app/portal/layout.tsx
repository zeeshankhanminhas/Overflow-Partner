import Link from 'next/link';
import type {Metadata} from 'next';
import {signOut} from '@/app/login/actions';
import css from './portal.module.css';
export const metadata:Metadata={
 title:'Account Workspaces | Overflow Partner',
 robots:{index:false,follow:false},
};
export const dynamic='force-dynamic';
export default function ExternalPortalLayout({children}:{children:React.ReactNode}){
 return <div className={css.canvas}>
  <header className={css.header}>
   <div className={css.headInner}>
    <Link href="/portal" className={css.brand} aria-label="Overflow Partner account workspaces">
     <span className={css.mark}>OP</span><span>OVERFLOW PARTNER</span>
    </Link>
    <nav className={css.navigation} aria-label="External portal navigation">
     <Link href="/portal/client">Client Workspace</Link>
     <Link href="/portal/partner">Partner Workspace</Link>
     <form action={signOut}><button type="submit">Sign out</button></form>
    </nav>
   </div>
  </header>
  <main className={css.body} id="main-content">{children}</main>
  <footer className={css.foot}>OVERFLOW PARTNER · SECURE ENGINEERING DELIVERY · ACCOUNT ACCESS</footer>
 </div>;
}
