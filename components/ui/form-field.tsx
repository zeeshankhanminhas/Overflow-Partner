'use client';
import { useId,type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

type ControlProps={id:string;'aria-describedby'?:string;'aria-invalid'?:true};
export function FormField({label,description,error,required,children,className}:{label:string;description?:string;error?:string;required?:boolean;children:(props:ControlProps)=>ReactNode;className?:string}){
 const generatedId=useId();const descriptionId=description?`${generatedId}-description`:undefined;const errorId=error?`${generatedId}-error`:undefined;
 return <div className={cn('op-ui-field',className)}><Label htmlFor={generatedId}>{label}{required?<span className="op-ui-field__required" aria-hidden="true"> *</span>:null}</Label>{description?<span id={descriptionId} className="op-ui-field__description">{description}</span>:null}{children({id:generatedId,'aria-describedby':errorId??descriptionId,'aria-invalid':error?true:undefined})}{error?<span id={errorId} className="op-ui-field__error" role="alert">{error}</span>:null}</div>;
}
