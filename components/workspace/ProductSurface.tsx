import type { ReactNode } from 'react';

export type ProductSurfaceType='dashboard'|'record'|'register'|'decision';

export default function ProductSurface({type,children,className=''}:{type:ProductSurfaceType;children:ReactNode;className?:string}){
  return <section className={`op-surface op-surface--${type} ${className}`.trim()} data-surface={type}>{children}</section>;
}
