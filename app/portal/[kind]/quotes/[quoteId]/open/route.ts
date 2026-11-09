import {redirect,notFound} from 'next/navigation';
export function GET(_: Request, {params}: {params:Promise<{kind:string;quoteId:string}>}) {
  return params.then(({kind,quoteId})=>{
    if (kind !== 'client' || !/^[0-9a-f-]{36}$/i.test(quoteId)) notFound();
    redirect('/portal/client/quotes/'+quoteId);
  });
}
