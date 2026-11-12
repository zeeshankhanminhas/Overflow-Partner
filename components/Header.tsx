'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import OverflowPartnerBrand from '@/components/brand/OverflowPartnerBrand';

const links = [
  { label: 'Services', href: '/services' },
  { label: 'How it works', href: '/process' },
  { label: 'About', href: '/about' },
  { label: 'FAQs', href: '/faq' },
];

export default function Header() {
  const [isOpen, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`section_header sticky top-0 z-50 border-b border-black/10 text-[#101311] backdrop-blur-md ${scrolled ? 'bg-[#f4f3ee]/95' : 'bg-[#f4f3ee]/90'}`}>
      <div className="container_large padding_global">
        <div className="flex min-h-[76px] items-center justify-between gap-4">
          <Link href="/" aria-label="Overflow Partner home" onClick={() => setOpen(false)}>
            <OverflowPartnerBrand />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-5 text-sm font-medium lg:flex">
            {links.map(link => <Link key={link.href} href={link.href} className="hover:text-[#b74a0f]">{link.label}</Link>)}
          </nav>
          <div className="hidden items-center gap-4 lg:flex">
            <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-medium text-[#34403b] hover:text-[#b74a0f]">
              Sign In
            </Link>
            <Link href="/contact" className="op-cta">Discuss a Requirement ↗</Link>
          </div>
          <button type="button" className="flex h-12 w-12 items-center justify-center border border-black/20 lg:hidden"
            aria-label={isOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={isOpen}
            aria-controls="mobile-nav" onClick={() => setOpen(open => !open)}>
            <span className="text-xl" aria-hidden="true">{isOpen ? '×' : '☰'}</span>
          </button>
        </div>
        {isOpen && (
          <nav id="mobile-nav" aria-label="Mobile navigation" className="grid border-t border-black/15 pb-5 pt-2 lg:hidden">
            {links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
              className="min-h-12 border-b border-black/10 py-3 text-sm font-semibold">{link.label}</Link>)}
            <Link href="/contact" className="op-cta mt-4 justify-center" onClick={() => setOpen(false)}>Discuss a Requirement ↗</Link>
            <Link href="/login" onClick={() => setOpen(false)}
              className="flex min-h-12 items-center py-3 text-sm font-medium text-[#34403b]">Sign In <span className="ml-2 text-xs text-black/50">— Secure Workspace</span></Link>
          </nav>
        )}
      </div>
    </header>
  );
}
