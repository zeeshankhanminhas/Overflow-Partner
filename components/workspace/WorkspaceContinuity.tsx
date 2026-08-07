'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const feedbackKeys = ['success','error','updated','created','advanced','activity','qualified','technical_review','invitation','partnerReviewDecision','partnerReviewCreated'];

function visible(element: HTMLElement) {
  return element.offsetParent !== null && getComputedStyle(element).visibility !== 'hidden';
}

function reveal(element: HTMLElement) {
  element.setAttribute('tabindex', '-1');
  element.classList.add('continuity-highlight');
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  window.setTimeout(() => element.focus({ preventScroll: true }), 320);
  window.setTimeout(() => element.classList.remove('continuity-highlight'), 2600);
}

export default function WorkspaceContinuity() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const focusId = searchParams.get('focus');
    const hasFeedback = feedbackKeys.some((key) => searchParams.has(key));
    if (!focusId && !hasFeedback) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const target = focusId
        ? document.getElementById(focusId)
        : Array.from(document.querySelectorAll<HTMLElement>('[data-continuity-notice], .vp-callout, .project-os-notice')).find(visible);

      if (target && visible(target)) {
        window.clearInterval(timer);
        reveal(target);
      } else if (attempts >= 20) {
        window.clearInterval(timer);
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [pathname, searchParams]);

  return null;
}
