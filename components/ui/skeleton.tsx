import { cn } from '@/lib/utils';
export function Skeleton({className,...props}:React.HTMLAttributes<HTMLDivElement>){return <div aria-hidden="true" className={cn('op-ui-skeleton',className)} {...props}/>}
