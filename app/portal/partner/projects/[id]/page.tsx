import {notFound} from 'next/navigation';
import PaidProjectDashboard from '@/components/portal/PaidProjectDashboard';
import {paidPortalProjects} from '@/lib/portal/paidProjects';
export const dynamic='force-dynamic';
export default async function PartnerProject({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const projects=await paidPortalProjects('partner');
 if(!projects.some(p=>p.project_id===id))notFound();
 return <PaidProjectDashboard kind="partner" projects={projects} selected={id}/>;
}
