import * as execution from '@/app/api/execution/[token]/files/route';
import {partnerTask} from '@/lib/portals/partnerTask';
export const GET = partnerTask(execution.GET);
export const POST = partnerTask(execution.POST);
export const DELETE = partnerTask(execution.DELETE);
