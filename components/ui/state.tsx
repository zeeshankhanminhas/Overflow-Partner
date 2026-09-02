import type { ReactNode } from 'react';
import { Alert,AlertDescription,AlertTitle } from './alert';
import { Button } from './button';
import { Card,CardContent } from './card';
import { Skeleton } from './skeleton';

export function EmptyState({title,description,action,icon}:{title:string;description:string;action?:ReactNode;icon?:ReactNode}){return <Card className="op-ui-state"><CardContent>{icon?<div className="op-ui-state__icon">{icon}</div>:null}<strong>{title}</strong><p>{description}</p>{action}</CardContent></Card>}
export function LoadingState({label='Loading current work'}:{label?:string}){return <Card className="op-ui-state" role="status" aria-label={label}><CardContent><Skeleton className="op-ui-skeleton--title"/><Skeleton/><Skeleton className="op-ui-skeleton--short"/></CardContent></Card>}
export function ErrorState({title='Unable to load this work',description,onRetry}:{title?:string;description:string;onRetry?:()=>void}){return <Alert variant="destructive"><AlertTitle>{title}</AlertTitle><AlertDescription>{description}</AlertDescription>{onRetry?<Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>:null}</Alert>}
