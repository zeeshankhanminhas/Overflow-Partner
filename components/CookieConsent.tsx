'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const KEY = 'overflow_partner_cookie_consent';
const EVENT = 'overflow-partner:open-cookie-preferences';
type Choice = 'accepted' | 'rejected';
const marketingPages = new Set(['/', '/services', '/process', '/assurance', '/about', '/faq', '/contact', '/privacy', '/terms', '/cookie-policy']);

function isMarketingRoute(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  return marketingPages.has(path) || path.startsWith('/services/');
}

export function CookiePreferencesButton() {
  return <button type="button" className="text-left text-sm text-white/75 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => window.dispatchEvent(new Event(EVENT))}>Cookie preferences</button>;
}

export default function CookieConsent() {
  const pathname = usePathname();
  const isMarketing = isMarketingRoute(pathname || '');
  const [choice, setChoice] = useState<Choice | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      setChoice(stored === 'accepted' || stored === 'rejected' ? stored : null);
      setShowPanel(stored !== 'accepted' && stored !== 'rejected');
    } catch {
      setChoice(null);
      setShowPanel(true);
    }
    setReady(true);
    const open = () => setShowPanel(true);
    window.addEventListener(EVENT, open);
    return () => window.removeEventListener(EVENT, open);
  }, []);

  function select(choice: Choice) {
    try { window.localStorage.setItem(KEY, choice); } catch { /* Consent still applies for this page. */ }
    setChoice(choice);
    setShowPanel(false);
  }

  // Neither the marketing banner nor marketing analytics belong inside authenticated OPOS workspaces.
  if (!isMarketing || !ready) return null;

  return <>
    {choice === 'accepted' ? <><Analytics /><SpeedInsights /></> : null}
    {showPanel ? <section className="cookie_banner fixed inset-x-0 bottom-0 z-[100] max-h-[85vh] overflow-y-auto border-t border-black/20 bg-white px-5 py-5 text-[#101311] shadow-[0_-10px_36px_rgba(0,0,0,.2)] sm:px-6 md:px-10" aria-label="Privacy and analytics preferences" role="region">
      <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-[1fr_auto] md:items-center">
        <div className="grid gap-2">
          <p className="text-sm font-semibold">Privacy preferences</p>
          <p className="max-w-3xl text-sm leading-6">
            Essential browser storage supports requested features. We use Vercel's cookie-free, aggregated website analytics only if you choose Allow analytics. You can change your choice at any time in the footer. See the{' '}
            <Link className="underline underline-offset-4" href="/privacy">Privacy Policy</Link> and{' '}
            <Link className="underline underline-offset-4" href="/cookie-policy">Cookie Policy</Link>.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:min-w-[22rem]">
          <button type="button" onClick={() => select('accepted')} className="min-h-12 rounded-md bg-[#101311] px-5 py-3 text-sm font-semibold text-white hover:bg-[#26312b]">Allow analytics</button>
          <button type="button" onClick={() => select('rejected')} className="min-h-12 rounded-md border border-[#101311] px-5 py-3 text-sm font-semibold text-[#101311] hover:bg-[#f4f3ee]">Decline analytics</button>
        </div>
      </div>
    </section> : null}
  </>;
}
