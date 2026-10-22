import { redirect } from 'next/navigation';

/** Keep old bookmarks functional without showing a second, cluttered LinkedIn page. */
export default async function FormerLinkedInFunnel({
  searchParams,
}:{ searchParams?:Promise<{error?:string,add?:string}> }) {
  const query=searchParams?await searchParams:{};
  const p=new URLSearchParams();
  if(query.add==='1')p.set('add','1');
  if(query.error)p.set('error',query.error);
  redirect('/outreach'+(p.size?'?'+p.toString():''));
}
