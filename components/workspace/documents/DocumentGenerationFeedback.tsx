'use client';

import { useSearchParams } from 'next/navigation';

export default function DocumentGenerationFeedback({ fallback }: { fallback?: string | null }) {
  const searchParams = useSearchParams();
  const scoped = searchParams.get('error_scope') === 'document';
  const message = scoped ? searchParams.get('error') : fallback;
  if (!message) return null;

  return <div data-continuity-notice className="vp-callout" style={{marginBottom:14}} role="alert">
    <strong>Document could not be generated</strong>
    <p>{message}</p>
  </div>;
}
