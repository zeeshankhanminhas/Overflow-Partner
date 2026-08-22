'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const links = [
  { label: 'Services', href: '/#services' },
  { label: 'Process', href: '/#process' },
  { label: 'Why Overflow Partner', href: '/#why-overflow-partner' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Contact', href: '/#contact' },
];

const logoSrc = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/overflow-partner-logo-monochrome.svg`;

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function updateScrollState() {
      setIsScrolled(window.scrollY > 8);
    }

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <header className={`section_header sticky top-0 z-50 border-b text-[var(--ink)] backdrop-blur-md transition-colors duration-300 ${isScrolled ? 'border-black/15 bg-[rgba(244,243,238,.94)]' : 'border-black/10 bg-[rgba(244,243,238,.88)]'}`}>
      <div className="container_large padding_global">
        <div className="flex min-h-[72px] items-center justify-between gap-6">
          <Link className="flex items-center" href="/" aria-label="Overflow Partner home" onClick={closeMenu}>
            <Image src={logoSrc} alt="Overflow Partner" width={320} height={64} priority className="h-8 w-auto object-contain md:h-9" />
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] font-medium md:flex" aria-label="Primary navigation">
            {links.map((link) => (
              <Link key={link.href} className="transition-opacity hover:opacity-55" href={link.href}>{link.label}</Link>
            ))}
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <Link className="text-[11px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-55" href="/workspace">
              Workspace
            </Link>
            <Link className="inline-flex min-h-11 items-center justify-center bg-[var(--ink)] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-85" href="/#contact">
              Submit requirement
            </Link>
          </div>

          <button className="inline-flex h-11 w-11 items-center justify-center border border-black/20 md:hidden" type="button" aria-label="Toggle navigation" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
            <span className="grid gap-1.5" aria-hidden="true">
              <span className="block h-px w-5 bg-current" />
              <span className="block h-px w-5 bg-current" />
              <span className="block h-px w-5 bg-current" />
            </span>
          </button>
        </div>

        {isOpen ? (
          <nav className="grid border-t border-black/15 pb-5 pt-3 text-sm md:hidden" aria-label="Mobile navigation">
            {links.map((link) => (
              <Link key={link.href} className="border-b border-black/10 py-3" href={link.href} onClick={closeMenu}>{link.label}</Link>
            ))}
            <Link className="border-b border-black/10 py-3 font-semibold uppercase" href="/workspace" onClick={closeMenu}>Workspace</Link>
            <Link className="py-3 font-semibold uppercase" href="/#contact" onClick={closeMenu}>Submit requirement</Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
