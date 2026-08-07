import * as React from 'react';
import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-sm font-medium leading-none text-[var(--op-text,#f5f7f5)] peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)} {...props} />;
}

export { Label };
