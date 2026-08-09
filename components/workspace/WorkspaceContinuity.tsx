'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const feedbackKeys = ['success','error','updated','created','advanced','activity','qualified','technical_review','invitation','partnerReviewDecision','partnerReviewCreated'];
const disclosureSelector = '.vp-disclosure, .record-workspace__disclosure';

function visible(element: HTMLElement) {
  return element.offsetParent !== null && getComputedStyle(element).visibility !== 'hidden';
}

function openAncestors(element: HTMLElement) {
  let parent = element.parentElement;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
}

function reveal(element: HTMLElement, focus = true) {
  openAncestors(element);
  element.setAttribute('tabindex', '-1');
  element.classList.add('continuity-highlight');
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  if (focus) window.setTimeout(() => element.focus({ preventScroll: true }), 320);
  window.setTimeout(() => element.classList.remove('continuity-highlight'), 2600);
}

function focusDestination(searchParams: URLSearchParams) {
  const explicit = searchParams.get('focus');
  if (explicit) return explicit;
  if (typeof window !== 'undefined' && window.location.hash.length > 1) return decodeURIComponent(window.location.hash.slice(1));
  return null;
}

export default function WorkspaceContinuity() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const focusId = focusDestination(searchParams);
    const hasFeedback = feedbackKeys.some((key) => searchParams.has(key));
    if (!focusId && !hasFeedback) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const target = focusId
        ? document.getElementById(focusId)
        : Array.from(document.querySelectorAll<HTMLElement>('[data-continuity-notice], .vp-callout, .project-os-notice')).find(visible);

      if (target) {
        openAncestors(target);
        if (visible(target)) {
          window.clearInterval(timer);
          reveal(target);
        }
      }
      if (attempts >= 24) window.clearInterval(timer);
    }, 100);

    return () => window.clearInterval(timer);
  }, [pathname, searchParams]);

  useEffect(() => {
    const onInvalid = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      openAncestors(target);
      window.requestAnimationFrame(() => reveal(target));
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const summary = target.closest('summary');
      if (!(summary instanceof HTMLElement)) return;
      const details = summary.parentElement;
      if (!(details instanceof HTMLDetailsElement) || !details.matches(disclosureSelector)) return;

      window.setTimeout(() => {
        if (!details.open) return;
        const rect = details.getBoundingClientRect();
        const bottomSafeArea = window.innerWidth <= 767 ? 150 : 80;
        if (rect.bottom > window.innerHeight - bottomSafeArea || rect.top < 80) {
          details.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
        }
      }, 40);
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      form.classList.add('continuity-submitting');
      const button = event.submitter;
      if (button instanceof HTMLButtonElement) {
        button.dataset.continuityOriginalLabel = button.textContent || '';
        button.setAttribute('aria-busy', 'true');
        button.disabled = true;
      }
    };

    window.addEventListener('invalid', onInvalid, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      window.removeEventListener('invalid', onInvalid, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, []);

  return null;
}
