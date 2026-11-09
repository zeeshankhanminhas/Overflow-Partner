import Link from 'next/link';
import {notFound} from 'next/navigation';
import {portalContext} from '@/lib/portals/account';
import {createClientPortalToken} from '@/lib/quotes/clientPortalToken';
import FinalFiles from '@/app/client-final-files/page';
import FinalPayment from '@/app/project-final-payment/page';
export const dynamic = 'force-dynamic';
export default async function ProjectTask({params}: {params: Promise<{kind:string;projectId:string;task:string}>}) {
  const {kind,projectId,task} = await params;
  if (kind !== 'client' || !['final-files','final-settlement'].includes(task)) notFound();
  const {projects,quotes,permitted} = await portalContext('client');
  const project = projects.find(item => item.project_id === projectId);
  const quotation = quotes.find(item => item.project_id === projectId && item.account_id === project?.account_id && item.organisation_id === project?.organisation_id);
  if (!permitted || !project || !quotation) notFound();
  const searchParams = Promise.resolve({token:createClientPortalToken(quotation.quote_id,quotation.quote_revision)});
  return <><Link href={'/portal/client/projects/'+projectId}>← {project.project_number}</Link>
    {task === 'final-files' ? <FinalFiles searchParams={searchParams}/> : <FinalPayment searchParams={searchParams}/>}</>;
}
