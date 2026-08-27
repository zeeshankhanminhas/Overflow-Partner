'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useWorkspaceInteractions } from './WorkspaceInteractionProvider';

const feedbackKeys = ['created','converted','updated','approved','issued','archived','saved','payment_confirmed','error'] as const;

type FeedbackKey = (typeof feedbackKeys)[number];

const messages: Record<Exclude<FeedbackKey,'error'>,{message:string;detail:string}> = {
  created: { message: 'Record created', detail: 'The workspace has been updated.' },
  converted: { message: 'Lifecycle advanced', detail: 'The record has moved into its next governed state.' },
  updated: { message: 'Changes saved', detail: 'The latest controlled values are now active.' },
  approved: { message: 'Approval recorded', detail: 'The authority decision has been captured.' },
  issued: { message: 'Document issued', detail: 'The controlled issue state has been updated.' },
  archived: { message: 'Record archived', detail: 'The item has been removed from active work.' },
  saved: { message: 'Saved', detail: 'Your changes are now reflected in the workspace.' },
  payment_confirmed: { message: 'Payment confirmed', detail: 'The commercial gate has been updated.' },
};

export default function WorkspaceFlashBridge() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { notify } = useWorkspaceInteractions();
  const lastSignature = useRef('');

  useEffect(() => {
    const hit = feedbackKeys.find((key) => params.has(key));
    if (!hit) return;

    const value = params.get(hit) || '';
    const signature = `${pathname}:${hit}:${value}`;
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;

    if (hit === 'error') {
      notify('Action could not be completed', { detail: value || 'Review the record and try again.', tone: 'error' });
    } else {
      const feedback = messages[hit];
      notify(feedback.message, { detail: feedback.detail, tone: 'success' });
    }

    const next = new URLSearchParams(params.toString());
    feedbackKeys.forEach((key) => next.delete(key));
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [notify, params, pathname, router]);

  return null;
}
