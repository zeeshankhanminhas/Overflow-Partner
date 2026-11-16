import PaidProjectDashboard from '@/components/portal/PaidProjectDashboard';
import {paidPortalProjects} from '@/lib/portal/paidProjects';
export const dynamic='force-dynamic';
export const metadata={title:'Execution Partner Workspace | Overflow Partner',robots:{index:false,follow:false}};
export default async function PartnerWorkspace(){const projects=await paidPortalProjects('partner');return <PaidProjectDashboard kind="partner" projects={projects}/>;}
