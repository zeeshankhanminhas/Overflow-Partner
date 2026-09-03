import * as React from 'react';
import { cn } from '@/lib/utils';

const Select=React.forwardRef<HTMLSelectElement,React.ComponentProps<'select'>>(({className,children,...props},ref)=><select ref={ref} className={cn('op-ui-select',className)} {...props}>{children}</select>);Select.displayName='Select';
export {Select};
