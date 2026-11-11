import Link from 'next/link';
import {notFound} from 'next/navigation';
import {portalContext} from '@/lib/portals/account';
import {createClientPortalToken} from '@/lib/quotes/clientPortalToken';
import FinalFiles from '@/app/client-final-files/page';
import FinalPayment from '@/app/project-final-payment/page';
export const dynamic = 'force-dynamic';
export default async function ProjectTask({params,searchParams}: {
  params: Promise<{kind:string;projectId:string;task:string}>;
  searchParams?: Promise<{stripe_return?:string}>;
}) {
  const {kind,projectId,task} = await params;
  const query=searchParams?await searchParams:{};
  const returnStatus=['success','cancelled'].includes(String(query.stripe_return||''))?query.stripe_return:'';
  if (kind !== 'client' || !['final-files','final-settlement'].includes(task)) notFound();
  const {projects,quotes,permitted} = await portalContext('client');
  const project = projects.find(item => item.project_id === projectId);
  const quotation = quotes.find(item => item.project_id === projectId && item.account_id === project?.account_id && item.organisation_id === project?.organisation_id);
  if (!permitted || !project || !quotation) notFound();
  const scopedTaskParams = Promise.resolve({
    token:createClientPortalToken(quotation.quote_id,quotation.quote_revision),
    stripe_return:returnStatus
  });
  return <><Link href={'/portal/client/projects/'+projectId}>← {project.project_number}</Link>
    {task === 'final-files' ? <FinalFiles searchParams={scopedTaskParams}/> : <FinalPayment searchParams={scopedTaskParams}/>}</>;
}
