'use client';

import type { SelectHTMLAttributes } from 'react';

export default function AutoSubmitSelect({ onChange, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select
    {...props}
    onChange={(event) => {
      onChange?.(event);
      event.currentTarget.form?.requestSubmit();
    }}
  />;
}
