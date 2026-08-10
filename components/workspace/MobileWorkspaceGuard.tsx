'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

type TouchStart = {
  href: string;
  x: number;
  y: number;
  anchor: HTMLAnchorElement;
};

const MOBILE_QUERY = '(max-width: 900px)';
const TAP_SLOP = 12;

function isMobileWorkspace() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}

function releasePageScroll() {
  if (!isMobileWorkspace()) return;

  const html = document.documentElement;
  const body = document.body;

  html.style.maxWidth = '100%';
  html.style.overflowX = 'hidden';
  html.style.overflowY = 'auto';
  html.style.height = 'auto';
  html.style.minHeight = '100%';

  body.style.maxWidth = '100%';
  body.style.overflowX = 'hidden';
  body.style.overflowY = 'auto';
  body.style.height = 'auto';
  body.style.maxHeight = 'none';
  body.style.minHeight = '100%';
  body.style.position = 'static';
  body.style.touchAction = 'pan-y';

  const shell = document.querySelector<HTMLElement>('.workspace.op-shell');
  const main = document.querySelector<HTMLElement>('.op-main');
  const content = document.querySelector<HTMLElement>('.op-content');

  for (const element of [shell, main, content]) {
    if (!element) continue;
    element.style.height = 'auto';
    element.style.maxHeight = 'none';
    element.style.overflowY = 'visible';
  }
}

export default function MobileWorkspaceGuard() {
  const pathname = usePathname();
  const touchStart = useRef<TouchStart | null>(null);

  useEffect(() => {
    releasePageScroll();

    const media = window.matchMedia(MOBILE_QUERY);
    const onViewportChange = () => releasePageScroll();
    media.addEventListener?.('change', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    window.visualViewport?.addEventListener('resize', onViewportChange);

    const onTouchStart = (event: TouchEvent) => {
      if (!isMobileWorkspace() || event.touches.length !== 1) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a.project-portfolio-row');
      if (!anchor) return;
      const touch = event.touches[0];
      touchStart.current = { href: anchor.href, x: touch.clientX, y: touch.clientY, anchor };
    };

    const onTouchEnd = (event: TouchEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start || !isMobileWorkspace() || event.changedTouches.length !== 1) return;

      const touch = event.changedTouches[0];
      const moved = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
      if (moved > TAP_SLOP) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a.project-portfolio-row');
      if (!anchor || anchor !== start.anchor || anchor.href !== start.href) return;

      event.preventDefault();
      window.location.assign(start.href);
    };

    const onTouchCancel = () => {
      touchStart.current = null;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true, capture: true });

    return () => {
      media.removeEventListener?.('change', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchend', onTouchEnd, true);
      document.removeEventListener('touchcancel', onTouchCancel, true);
    };
  }, [pathname]);

  return null;
}
