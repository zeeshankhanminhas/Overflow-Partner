import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import OpNav from './OpNav';
import OpMobileNav from './OpMobileNav';
import css from './opos.module.css';
import { isKnownIsolatedQaBackend, isKnownIsolatedQaFixtureBackend, isKnownIsolatedQaStep2Backend } from '@/lib/qa/isolation';

export const metadata: Metadata = {
  title: 'OPOS | Workspace',
  robots: { index: false, follow: false },
};

export const runtime = 'nodejs';

export default async function DecisionFirstLayout({ children }: { children: React.ReactNode }) {
  await requireUserContext('/opos-next'); // Keep the new design destination through sign-in.
  const qaRef = String(process.env.OP_QA_SUPABASE_PROJECT_REF || '').trim().toLowerCase();
  const qaConfigured = process.env.VERCEL_ENV === 'preview' &&
    /^[a-z0-9]{12,32}$/.test(qaRef) && qaRef !== 'klricctsxiifuduxpmzd' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === `https://${qaRef}.supabase.co`;
  const qaWritable = isKnownIsolatedQaBackend();
  const qaFixtureWritable = isKnownIsolatedQaFixtureBackend();
  const qaStep2Writable = isKnownIsolatedQaStep2Backend();
  const workspaceStatus = qaConfigured
    ? (qaWritable ? 'QA · Actions enabled' : qaStep2Writable ? 'QA · Client intake testing' : qaFixtureWritable ? 'QA · Test records only' : 'QA · Actions locked')
    : 'Redesign · Under review';
  return (
    <div className={css.shell}>
      <a href="#main-content" className={css.skipLink}>Skip to content</a>
      <OpMobileNav statusLabel={workspaceStatus} />
      <aside className={css.sidebar} aria-label="OPOS workspace sidebar">
        <Link className={css.brand} href="/opos-next" aria-label="Overflow Partner home">
          <span className={css.brandMark} aria-hidden="true">◈</span>
          <span>OVERFLOW<br />PARTNER</span>
        </Link>
        <OpNav />
        <div className={css.sidebarFooter}>
          <small>{qaConfigured ? 'ISOLATED QA WORKSPACE' : 'REDESIGN IN REVIEW'}</small>
          <span>{qaConfigured ? (qaWritable ? 'Test actions are enabled' : qaStep2Writable ? 'Fictional client intake is active · Other writes locked' : qaFixtureWritable ? 'Synthetic CRM record actions only' : 'Writes remain locked for safety') : 'Not yet released to production'}</span>
        </div>
      </aside>
      <div className={css.workArea}>
        <header className={css.topbar}>
          <span>OPOS <span aria-hidden="true">/</span> WORKSPACE</span>
          <span className={css.previewChip}>{workspaceStatus}</span>
        </header>
        <main className={css.main} id="main-content">{children}</main>
      </div>
    </div>
  );
}
