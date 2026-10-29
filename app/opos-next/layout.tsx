import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import OpNav from './OpNav';
import OpMobileNav from './OpMobileNav';
import css from './opos.module.css';

export const metadata: Metadata = {
  title: 'OPOS | Decision-first workspace preview',
  robots: { index: false, follow: false },
};

export const runtime = 'nodejs';

export default async function DecisionFirstLayout({ children }: { children: React.ReactNode }) {
  await requireUserContext(); // The preview must obey the existing workspace authentication.
  return (
    <div className={css.shell}>
      <a href="#main-content" className={css.skipLink}>Skip to content</a>
      <OpMobileNav />
      <aside className={css.sidebar} aria-label="OPOS workspace sidebar">
        <Link className={css.brand} href="/opos-next" aria-label="Overflow Partner home">
          <span className={css.brandMark} aria-hidden="true">◈</span>
          <span>OVERFLOW<br />PARTNER</span>
        </Link>
        <OpNav />
        <div className={css.sidebarFooter}>
          <small>DECISION-FIRST / V1</small>
          <span>Design branch preview</span>
        </div>
      </aside>
      <div className={css.workArea}>
        <header className={css.topbar}>
          <span>OPOS <span aria-hidden="true">/</span> WORKSPACE</span>
          <span className={css.previewChip}>Visual implementation preview</span>
        </header>
        <main className={css.main} id="main-content">{children}</main>
      </div>
    </div>
  );
}
