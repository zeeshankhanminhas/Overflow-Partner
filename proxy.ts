import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';
import {isKnownIsolatedQaPresentationPreview} from '@/lib/qa/isolation';
import {canonicalQaWorkspace2Path} from '@/lib/qa/workspace2Routes';

/** Only isolated QA preview GET/HEAD navigation; never POST, API or secure tokens. */
export function proxy(request:NextRequest){
 if((request.method!=='GET'&&request.method!=='HEAD')||!isKnownIsolatedQaPresentationPreview())return NextResponse.next();
 const destination=canonicalQaWorkspace2Path(request.nextUrl.pathname);
 if(!destination)return NextResponse.next();
 const url=request.nextUrl.clone();url.pathname=destination;
 return NextResponse.redirect(url,{status:307,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
}
export const config={matcher:['/workspace/:path*']};
