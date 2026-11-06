import {notFound,redirect} from 'next/navigation';
import {portalContext} from '@/lib/portals/account';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';

export const dynamic='force-dynamic';

/**
 * Historical review invitations remain valid, but client review now takes
 * place in the one Client Portal project screen. Never redirect until both
 * project membership and current-cycle issued-review access are confirmed.
 */
export default async function ClientReviewDeepLink({params,searchParams}:{
 params:Promise<{projectId:string}>;
 searchParams?:Promise<{error?:string;updated?:string}>;
}){
 if(!isKnownIsolatedQaBackend())notFound();
 const {projectId}=await params;
 const {permitted,projects,supabase}=await portalContext('client');
 if(!permitted||!projects.some(p=>p.project_id===projectId))notFound();
 const {data,error}=await supabase.rpc('op_qa_client_review_position',{p_project_id:projectId});
 const current=data as {projectId?:string;issueId?:string}|null;
 if(error||current?.projectId!==projectId||!current.issueId)notFound();
 const feedback=searchParams?await searchParams:{};
 const query=new URLSearchParams();
 if(feedback.error)query.set('error',String(feedback.error).slice(0,260));
 if(feedback.updated)query.set('updated',String(feedback.updated).slice(0,260));
 redirect('/portal/client/projects/'+projectId+(query.size?'?'+query.toString():'')+'#drawing-review');
}
