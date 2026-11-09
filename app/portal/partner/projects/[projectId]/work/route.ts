import * as execution from '@/app/api/execution/[token]/route';
import {partnerTask} from '@/lib/portals/partnerTask';
export const GET = partnerTask(execution.GET);
export const POST = partnerTask(execution.POST);
