'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const links = [
  { label: 'Services', href: '/#services' },
  { label: 'Process', href: '/#process' },
  { label: 'Why MIDTS', href: '/#why-midts' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Contact', href: '/#contact' },
];

const logoSrc = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/midts-logo.svg`;

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

  const headerStateClass = isScrolled
    ? 'border-white/15 bg-[#050705]/95 shadow-[0_10px_30px_rgba(0,0,0,0.18)]'
    : 'border-white/10 bg-[#050705]/90 shadow-none';

  return (
    <header
      className={`section_header sticky top-0 z-50 border-b py-3 text-white backdrop-blur transition-[border-color,box-shadow,background-color] duration-300 md:py-4 ${headerStateClass}`}
    >
      <div className="container_large padding_global">
        <div className="header_wrapper flex items-center justify-between gap-6">
          <Link className="brand_link flex items-center" href="/" aria-label="MIDTS home" onClick={closeMenu}>
            <img
              src={logoSrc}
              alt="MIDTS Engineering Overflow Capacity Partner"
              className="h-8 w-auto object-contain md:h-10"
            />
          </Link>
          <nav className="nav_primary hidden items-center gap-5 text-sm text-white md:flex md:gap-7" aria-label="Primary navigation">
            {links.map((link) => (
              <Link key={link.href} className="text_link transition hover:text-white" href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            className="button_primary motion_button hidden min-h-10 items-center justify-center rounded-md bg-white px-5 py-2 text-xs font-medium uppercase text-black transition hover:bg-white md:inline-flex"
            href="/#contact"
          >
            Submit Requirement
          </Link>
          <button
            className="button_menu motion_button inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/40 text-white md:hidden"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((current) => !current)}
          >
            <span className="grid gap-1.5" aria-hidden="true">
              <span className="block h-px w-5 bg-current" />
              <span className="block h-px w-5 bg-current" />
              <span className="block h-px w-5 bg-current" />
            </span>
          </button>
        </div>
        {isOpen ? (
          <nav className="nav_mobile mt-3 grid border-t border-white/40 pt-3 text-sm text-white md:hidden" aria-label="Mobile navigation">
            {links.map((link) => (
              <Link key={link.href} className="text_link border-b border-white/30 py-2.5 transition last:border-b-0 hover:text-white" href={link.href} onClick={closeMenu}>
                {link.label}
              </Link>
            ))}
            <Link className="text_link py-2.5 font-semibold uppercase" href="/#contact" onClick={closeMenu}>
              Submit Requirement
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
