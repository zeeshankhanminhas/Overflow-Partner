import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[96px] w-full rounded-md border border-[var(--op-line,#343a36)] bg-[var(--op-surface,#111513)] px-3 py-2 text-sm text-[var(--op-text,#f5f7f5)] shadow-sm outline-none placeholder:text-[var(--op-muted,#8f9892)] focus-visible:ring-2 focus-visible:ring-[var(--op-accent,#ef6c24)] disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
