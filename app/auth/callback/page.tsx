import {notFound} from 'next/navigation';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import QaClientAuthCallback from './QaClientAuthCallback';

export const dynamic='force-dynamic';
export const metadata={title:'Secure QA Client sign-in | Overflow Partner',robots:{index:false,follow:false}};

export default function QAAuthorisedClientCallback(){
 if(!isKnownIsolatedQaBackend())notFound();
 return <QaClientAuthCallback/>;
}
