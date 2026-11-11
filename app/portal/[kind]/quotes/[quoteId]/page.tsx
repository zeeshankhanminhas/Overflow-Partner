import LifecycleProgress from '@/components/workspace/LifecycleProgress';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {portalContext} from '@/lib/portals/account';
import {createClientPortalToken} from '@/lib/quotes/clientPortalToken';
import ClientQuote from '@/app/client-portal/page';
export default async function Quotation({params}: {params:Promise<{kind:string;quoteId:string}>}) {
  const {kind,quoteId} = await params;
  if (kind !== 'client') notFound();
  const {permitted,quotes} = await portalContext('client');
  const quote = quotes.find(item => item.quote_id === quoteId);
  if (!permitted || !quote) notFound();
  return <><Link href="/portal/client">← Client Workspace</Link>
    <LifecycleProgress phase={quote.client_response==='accepted'?'contractual_commitment':'commercial_offer'}/>
    <ClientQuote searchParams={Promise.resolve({token:createClientPortalToken(quote.quote_id,quote.quote_revision)})}/></>;
}
