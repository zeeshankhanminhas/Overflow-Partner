import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { signOut } from '@/app/login/actions';
import styles from './outreach.module.css';

export const metadata: Metadata = {
  title: 'Outreach | Overflow Partner',
  robots: { index: false, follow: false },
};

/**
 * Outreach is deliberately not nested under /workspace.
 * It retains the same authenticated Supabase user, organisation and commercial
 * records without loading the production OS sidebars, alerts or dashboards.
 */
export default async function OutreachLayout({children}:{children:React.ReactNode}) {
  const {profile} = await requireUserContext();
  return <div className={styles.surface}>
    <header className={styles.header}>
      <Link href="/outreach" className={styles.brand} aria-label="Overflow Partner outreach home">
        <span className={styles.mark}>OP<span aria-hidden="true">/</span></span>
        <span className={styles.brandName}>Outreach</span>
      </Link>
      <nav aria-label="Outreach navigation" className={styles.nav}>
        <Link href="/outreach">Conversations</Link>
        <Link href="/workspace">Full OPOS <span aria-hidden="true">↗</span></Link>
      </nav>
      <div className={styles.account}>
        <span className={styles.user}>{profile.full_name||'Operator'}</span>
        <form action={signOut}><button type="submit" className={styles.signout}>Sign out</button></form>
      </div>
    </header>
    <main id="main" className={styles.main}>{children}</main>
    <footer className={styles.footer}>
      <span>LinkedIn remains the messaging channel. OPOS records the conversation and next action.</span>
      <Link href="/workspace/acquisition/prospects">Formal enquiries ↗</Link>
    </footer>
  </div>;
}
