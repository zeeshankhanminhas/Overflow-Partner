'use client';

import { useFormStatus } from 'react-dom';

export default function DocumentGenerateButton() {
  const { pending } = useFormStatus();
  return <button className="button" type="submit" disabled={pending} aria-disabled={pending}>
    {pending ? 'Generating…' : 'Create document'}
  </button>;
}
