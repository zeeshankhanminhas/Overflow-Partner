import {notFound} from 'next/navigation';
import {isKnownIsolatedQaPresentationPreview} from '@/lib/qa/isolation';
import QaClientAuthCallback from './QaClientAuthCallback';

export const dynamic='force-dynamic';
export const metadata={title:'Secure QA Client sign-in | Overflow Partner',robots:{index:false,follow:false}};

export default function QAAuthorisedClientCallback(){
 if(process.env.VERCEL_GIT_COMMIT_REF!=='qa/recovery-ui-client-gate-20261105' ||
    !isKnownIsolatedQaPresentationPreview())notFound();
 return <QaClientAuthCallback/>;
}
