import Image from 'next/image';
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

export default function Footer() {
  return (
    <footer className="section_footer bg-black py-20 text-white">
      <div className="container_large padding_global">
        <div className="footer_wrapper grid gap-10 border-t border-white/40 pt-10 text-sm text-white lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
          <div className="footer_brand max-w-md">
            <Link className="inline-flex items-center" href="/" aria-label="Overflow Partner home">
              <Image src="/overflow-partner-logo-monochrome.svg" alt="Overflow Partner" width={320} height={64} className="h-10 w-auto brightness-0 invert" />
            </Link>
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
            <div className="mt-5 grid gap-3">
              <Link className="text_link w-fit text-white transition hover:text-white" href="/#contact">Submit an engineering requirement</Link>
              <Link className="text_link w-fit text-white transition hover:text-white" href="/login">Workspace access</Link>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-white/40 pt-6 text-xs font-medium uppercase text-white md:flex-row md:items-center md:justify-between">
          <p>© 2026 Overflow Partner. All rights reserved.</p>
          <p>Engineering overflow capacity, delivered with control.</p>
        </div>
      </div>
    </footer>
  );
}
