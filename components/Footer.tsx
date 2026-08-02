import Link from 'next/link';

const quickLinks = [
  { label: 'Services', href: '/#services' },
  { label: 'Process', href: '/#process' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Contact', href: '/#contact' },
];

const legalLinks = [
  { label: 'Privacy', href: '/privacy/' },
  { label: 'Terms', href: '/terms/' },
  { label: 'Cookie Policy', href: '/cookie-policy/' },
];

const contactDetails = [
  { label: 'Email', href: 'mailto:intake@midts.com', text: 'intake@midts.com' },
  { label: 'Phone', href: 'tel:+441223656090', text: '01223 656 090' },
  { label: 'Address', href: null, text: '1010 Cambourne Business Center, Cambridge CB23 6DP' },
];

export default function Footer() {
  return (
    <footer className="section_footer bg-black py-20 text-white">
      <div className="container_large padding_global">
        <div className="footer_wrapper grid gap-10 border-t border-white/40 pt-10 text-sm text-white lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
          <div className="footer_brand max-w-md">
            <Link className="inline-flex text-2xl font-semibold uppercase tracking-normal text-white" href="/" aria-label="MIDTS home">MIDTS</Link>
            <p className="mt-5 text-base leading-7 text-white">Engineering capacity when delivery requirements exceed internal resource.</p>
          </div>
          <div className="footer_links">
            <p className="text-xs font-semibold uppercase text-white">Site</p>
            <div className="mt-5 grid gap-3">{quickLinks.map((link) => (<Link key={link.href} className="text_link w-fit text-white transition hover:text-white" href={link.href}>{link.label}</Link>))}</div>
          </div>
          <div className="footer_legal">
            <p className="text-xs font-semibold uppercase text-white">Legal</p>
            <div className="mt-5 grid gap-3">{legalLinks.map((link) => (<Link key={link.href} className="text_link w-fit text-white transition hover:text-white" href={link.href}>{link.label}</Link>))}</div>
          </div>
          <div className="footer_contact">
            <p className="text-xs font-semibold uppercase text-white">Contact</p>
            <div className="mt-5 grid gap-3">{contactDetails.map((item) => item.href ? (<a key={item.label} className="text_link w-fit text-white transition hover:text-white" href={item.href}>{item.text}</a>) : (<p key={item.label} className="text_body max-w-sm text-white">{item.text}</p>))}</div>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-white/40 pt-6 text-xs font-medium uppercase text-white md:flex-row md:items-center md:justify-between">
          <p>© 2026 MIDTS. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a className="text-white transition hover:text-white" href="mailto:intake@midts.com">intake@midts.com</a>
            <a className="text-white transition hover:text-white" href="tel:+441223656090">01223 656 090</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
