import Footer from '@/components/Footer';
import Header from '@/components/Header';

export const metadata = {
  title: 'Cookie Policy | Overflow Partner',
  description: 'Overflow Partner cookie policy covering essential storage, optional analytics consent, and browser preferences.',
  alternates: { canonical: '/cookie-policy/' },
};

export default function CookiePolicyPage() {
  return (
    <>
      <Header />
      <main className="section_cookie_policy bg-[var(--paper)] py-32 text-[var(--ink)] md:py-44">
        <div className="container_large padding_global">
          <div className="cookie_policy_wrapper mx-auto max-w-3xl">
            <p className="text_eyebrow mb-8 text-sm font-semibold uppercase text-neutral-500">Cookie Policy</p>
            <h1 className="heading_section text-4xl font-semibold leading-tight md:text-5xl">How Overflow Partner uses cookies and browser storage.</h1>
            <p className="text_body mt-6 text-sm leading-6 text-[var(--muted)]">Last updated: 2 August 2026</p>
            <div className="cookie_policy_content mt-12 grid gap-10 border-y border-black/10 py-10">
              <section className="cookie_policy_block">
                <h2 className="heading_card text-xl font-semibold">Essential cookies and storage</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">Essential cookies or browser storage may be used where needed for the website to operate, submit forms, remember a requested setting, protect services, or provide a function you have asked to use.</p>
              </section>
              <section className="cookie_policy_block">
                <h2 className="heading_card text-xl font-semibold">Optional analytics cookies</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">Optional analytics cookies would help Overflow Partner understand website usage and improve the site. No optional analytics cookies are loaded unless consented.</p>
              </section>
              <section className="cookie_policy_block">
                <h2 className="heading_card text-xl font-semibold">Consent choice</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">The cookie banner stores your choice in localStorage using the key <code className="rounded bg-black/5 px-1 py-0.5">overflow_partner_cookie_consent</code>.</p>
              </section>
              <section className="cookie_policy_block">
                <h2 className="heading_card text-xl font-semibold">Changing your preference</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">You can change your preference by clearing this website&apos;s localStorage entry for <code className="rounded bg-black/5 px-1 py-0.5">overflow_partner_cookie_consent</code>. The banner will appear again on your next visit.</p>
              </section>
              <section className="cookie_policy_block">
                <h2 className="heading_card text-xl font-semibold">Browser controls</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">You can also block or delete cookies and browser storage through your browser settings. Some essential site functions may not work as expected if browser storage is disabled.</p>
              </section>
              <section className="cookie_policy_block">
                <h2 className="heading_card text-xl font-semibold">Contact</h2>
                <p className="text_body mt-4 text-base leading-7 text-[var(--muted)]">Use the enquiry form on this website to contact Overflow Partner about cookie preferences.</p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
