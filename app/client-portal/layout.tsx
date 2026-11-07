import {isKnownIsolatedQaPresentationPreview} from '@/lib/qa/isolation';
/** Presentation only: token authentication and financial gates remain in pages. */
export default function QaClientTransactionLayout({children}:{children:React.ReactNode}){
 return <div className={isKnownIsolatedQaPresentationPreview()?'qa-v2-token':undefined}>{children}</div>;
}
