import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Alert,AlertDescription,AlertTitle } from './alert';
import { Button } from './button';
import { Card,CardContent } from './card';
import { Skeleton } from './skeleton';

export function EmptyState({title,description,action,icon,className}:{title:string;description:string;action?:ReactNode;icon?:ReactNode;className?:string}){return <Card className={cn('op-ui-state',className)} role="status"><CardContent>{icon?<div className="op-ui-state__icon">{icon}</div>:null}<strong>{title}</strong><p>{description}</p>{action}</CardContent></Card>}
export function LoadingState({label='Loading current work',className}:{label?:string;className?:string}){return <Card className={cn('op-ui-state',className)} role="status" aria-label={label}><CardContent><Skeleton className="op-ui-skeleton--title"/><Skeleton/><Skeleton className="op-ui-skeleton--short"/></CardContent></Card>}
export function ErrorState({title='Unable to load this work',description,onRetry,className}:{title?:string;description:string;onRetry?:()=>void;className?:string}){return <Alert variant="destructive" className={className}><AlertTitle>{title}</AlertTitle><AlertDescription>{description}</AlertDescription>{onRetry?<Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>:null}</Alert>}
