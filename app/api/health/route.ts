export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ status: 'ok', service: 'overflow-partner' }, { headers: { 'Cache-Control': 'no-store' } });
}
