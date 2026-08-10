'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function WorkspaceError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{console.error('Workspace route error',error);},[error]);
  return <section className="vp-page">
    <div className="product-page-header"><div className="product-page-header__copy"><p className="product-eyebrow">Workspace error</p><h1>This view could not be loaded.</h1><p className="product-description">Your record has not been changed by this screen error. Retry the current view or return to Mission Control.</p></div></div>
    <div className="product-notice product-notice--blocked"><strong>Unable to load the latest operating state</strong><div>{error.message||'An unexpected workspace error occurred.'}{error.digest?<><br/><small>Reference: {error.digest}</small></>:null}</div></div>
    <div className="product-toolbar"><div className="product-toolbar__group"><button className="button" onClick={()=>reset()}>Retry</button><Link className="button secondary" href="/workspace">Mission Control</Link><Link className="button secondary" href="/workspace/exceptions">Exceptions</Link></div></div>
  </section>;
}
