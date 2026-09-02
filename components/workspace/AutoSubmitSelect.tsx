'use client';

import type { ComponentProps } from 'react';
import { Select } from '@/components/ui/select';

export default function AutoSubmitSelect({ onChange, ...props }: ComponentProps<typeof Select>) {
  return <Select
    {...props}
    onChange={(event) => {
      onChange?.(event);
      event.currentTarget.form?.requestSubmit();
    }}
  />;
}
