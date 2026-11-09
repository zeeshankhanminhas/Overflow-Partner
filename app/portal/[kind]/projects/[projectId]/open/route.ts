import {NextRequest, NextResponse} from 'next/server';
import {isPortalKind} from '@/lib/portals/account';
export async function GET(request: NextRequest, {params}: {params: Promise<{kind: string; projectId: string}>}) {
  const {kind, projectId} = await params;
  if (!isPortalKind(kind) || !/^[0-9a-f-]{36}$/i.test(projectId)) return new Response(null,{status:404});
  const url = new URL('/portal/' + kind + '/projects/' + projectId, request.url);
  const task = request.nextUrl.searchParams.get('flow');
  if (kind === 'client' && (task === 'final-files' || task === 'final-settlement')) url.pathname += '/tasks/' + task;
  return NextResponse.redirect(url, {headers:{'Cache-Control':'private, no-store'}});
}
