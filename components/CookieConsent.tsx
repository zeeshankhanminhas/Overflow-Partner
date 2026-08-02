'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const CONSENT_KEY = 'overflow_partner_cookie_consent';
type ConsentChoice = 'accepted' | 'rejected';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const storedChoice = window.localStorage.getItem(CONSENT_KEY);
      setIsVisible(storedChoice !== 'accepted' && storedChoice !== 'rejected');
    } catch {
      setIsVisible(true);
    }
  }, []);

  function saveChoice(choice: ConsentChoice) {
    try {
      window.localStorage.setItem(CONSENT_KEY, choice);
    } finally {
      setIsVisible(false);
    }
  }

  if (!isVisible) return null;

  return (
    <section className="cookie_banner border-t border-black bg-white px-5 py-5 text-black sm:px-6 md:px-10" aria-label="Cookie consent">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="grid gap-2">
          <p className="text-sm font-semibold uppercase text-black">Cookie preferences</p>
          <p className="max-w-3xl text-sm leading-6 text-black">
            Overflow Partner uses essential browser storage for the site to work. Optional analytics cookies are not loaded unless you consent. Read the{' '}
            <Link className="font-medium text-black underline underline-offset-4" href="/privacy/">Privacy Policy</Link>{' '}and{' '}
            <Link className="font-medium text-black underline underline-offset-4" href="/cookie-policy/">Cookie Policy</Link>.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:min-w-[22rem]">
          <button className="motion_button min-h-11 rounded-md bg-black px-5 py-3 text-sm font-medium uppercase text-white transition hover:bg-black" type="button" onClick={() => saveChoice('accepted')}>Accept Analytics</button>
          <button className="motion_button min-h-11 rounded-md border border-black px-5 py-3 text-sm font-medium uppercase text-black transition hover:border-black" type="button" onClick={() => saveChoice('rejected')}>Reject Non-Essential</button>
        </div>
      </div>
    </section>
  );
}
