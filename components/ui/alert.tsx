import * as React from 'react';
import { cva,type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants=cva('op-ui-alert',{variants:{variant:{default:'op-ui-alert--default',success:'op-ui-alert--success',warning:'op-ui-alert--warning',destructive:'op-ui-alert--destructive'}},defaultVariants:{variant:'default'}});
function Alert({className,variant,...props}:React.HTMLAttributes<HTMLDivElement>&VariantProps<typeof alertVariants>){return <div role={variant==='destructive'?'alert':'status'} className={cn(alertVariants({variant}),className)} {...props}/>}
function AlertTitle({className,...props}:React.HTMLAttributes<HTMLHeadingElement>){return <h4 className={cn('op-ui-alert__title',className)} {...props}/>}
function AlertDescription({className,...props}:React.HTMLAttributes<HTMLParagraphElement>){return <p className={cn('op-ui-alert__description',className)} {...props}/>}
export {Alert,AlertTitle,AlertDescription};
