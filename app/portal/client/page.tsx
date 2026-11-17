import PaidProjectDashboard from '@/components/portal/PaidProjectDashboard';
import {paidPortalProjects} from '@/lib/portal/paidProjects';
export const dynamic='force-dynamic';
export const metadata={title:'Client Workspace | Overflow Partner',robots:{index:false,follow:false}};
export default async function ClientWorkspace(){const projects=await paidPortalProjects('client');return <PaidProjectDashboard kind="client" projects={projects}/>;}
