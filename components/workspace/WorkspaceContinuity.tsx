'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const feedbackKeys = ['success','error','updated','created','advanced','activity','qualified','technical_review','invitation','partnerReviewDecision','partnerReviewCreated','payment','saved','issued','approved','signed','completed','closed','archived','deleted'];
const mutationFeedbackKeys = feedbackKeys.filter((key) => key !== 'error');
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

function pendingLabel(button: HTMLButtonElement) {
  const explicit = button.dataset.pendingLabel;
  if (explicit) return explicit;
  const label = (button.textContent || '').trim().toLowerCase();
  if (label.includes('save')) return 'Saving…';
  if (label.includes('create') || label.includes('add')) return 'Creating…';
  if (label.includes('record')) return 'Recording…';
  if (label.includes('approve') || label.includes('authorise') || label.includes('authorize')) return 'Approving…';
  if (label.includes('issue') || label.includes('send')) return 'Issuing…';
  if (label.includes('generate')) return 'Generating…';
  if (label.includes('complete') || label.includes('close')) return 'Completing…';
  if (label.includes('update') || label.includes('change')) return 'Updating…';
  if (label.includes('sign')) return 'Signing…';
  return 'Working…';
}

export default function WorkspaceContinuity() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mutationSubmitted = useRef(false);
  const refreshInFlight = useRef(false);

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
    const mutationConfirmed = mutationFeedbackKeys.some((key) => searchParams.has(key));
    if (!mutationConfirmed || refreshInFlight.current) return;

    refreshInFlight.current = true;
    mutationSubmitted.current = false;
    const timer = window.setTimeout(() => {
      router.refresh();
      window.setTimeout(() => { refreshInFlight.current = false; }, 250);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [pathname, router, searchParams]);

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
      mutationSubmitted.current = true;
      form.classList.add('continuity-submitting');
      form.setAttribute('aria-busy', 'true');
      const button = event.submitter;
      if (button instanceof HTMLButtonElement) {
        button.dataset.continuityOriginalLabel = button.textContent || '';
        button.setAttribute('aria-busy', 'true');
        button.textContent = pendingLabel(button);
        button.disabled = true;
      }
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || refreshInFlight.current) return;
      refreshInFlight.current = true;
      router.refresh();
      window.setTimeout(() => { refreshInFlight.current = false; }, 250);
    };

    window.addEventListener('invalid', onInvalid, true);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      window.removeEventListener('invalid', onInvalid, true);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, [router]);

  return null;
}
