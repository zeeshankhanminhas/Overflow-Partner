import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--op-accent,#ef6c24)] text-black',
        secondary: 'border-[var(--op-line,#343a36)] bg-white/5 text-[var(--op-text,#f5f7f5)]',
        outline: 'border-[var(--op-line,#343a36)] text-[var(--op-muted,#8f9892)]',
        destructive: 'border-transparent bg-red-600 text-white',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
