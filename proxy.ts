import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isKnownIsolatedQaBackend, isKnownIsolatedQaFixtureBackend, isKnownIsolatedQaStep2Backend, isKnownIsolatedQaPresentationPreview } from "@/lib/qa/isolation";
import { canonicalQaWorkspace2Path } from "@/lib/qa/workspace2Routes";


/**
 * Navigation parity only: authenticated legacy bookmarks land in Workspace 2.0
 * on the exact isolated QA presentation preview. Preserve refreshed auth cookies
 * on the redirect and never reroute POST, APIs or token-bearing transaction routes.
 */
function redirectKnownQaNavigation(request: NextRequest, response: NextResponse): NextResponse {
  if ((request.method!=='GET' && request.method!=='HEAD') ||
      !isKnownIsolatedQaPresentationPreview()) return response;
  const destination = canonicalQaWorkspace2Path(request.nextUrl.pathname);
  if (!destination) return response;
  const url = request.nextUrl.clone();
  url.pathname = destination;
  const redirect = NextResponse.redirect(url, {
    status: 307,
    headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
  });
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  // Draft redesign preview may share production Supabase for read-only inspection.
  // Never let POST/PUT/PATCH/DELETE from either the new or legacy operating UI
  // mutate that database. Isolated QA is the only allowed preview write target.
  const qaFixturePost = isKnownIsolatedQaFixtureBackend() && (
    request.nextUrl.pathname === '/opos-next/opportunities/new' ||
    request.nextUrl.pathname === '/opos-next/outreach' ||
    /^\/opos-next\/outreach\/[0-9a-f-]{36}\/?$/i.test(request.nextUrl.pathname) ||
    /^\/opos-next\/accounts\/[0-9a-f-]{36}\/?$/i.test(request.nextUrl.pathname)
  );
  const qaStep2Post = isKnownIsolatedQaStep2Backend() && (
    /^\/opos-next\/opportunities\/[0-9a-f-]{36}\/?$/i.test(request.nextUrl.pathname) ||
    /^\/api\/intake\/[a-f0-9]{64}(?:\/files)?\/?$/i.test(request.nextUrl.pathname)
  );
  // Allow submission of a secured partner-review token only against the isolated QA backend.
  // The endpoint validates the bearer token and the QA database still enforces review state.
  const qaPartnerReviewPost = request.method === 'POST' &&
    /^\/api\/partner-review\/[a-f0-9]{64}\/?$/i.test(request.nextUrl.pathname) &&
    isKnownIsolatedQaStep2Backend() &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://ukcamenuxhdznxaxpyis.supabase.co';
  const qaPartnerSimulationPost = request.method === 'POST' &&
    request.nextUrl.pathname === '/opos-next/partners/4f6bdcc5-1ea0-4dce-aa39-2fbef0cd17fa' &&
    isKnownIsolatedQaStep2Backend();
  if (process.env.VERCEL_ENV === 'preview' &&
      !isKnownIsolatedQaBackend() && !qaFixturePost && !qaStep2Post && !qaPartnerSimulationPost && !qaPartnerReviewPost &&
      !['GET','HEAD','OPTIONS'].includes(request.method)) {
    return NextResponse.json({
      message: 'This OPOS redesign preview is read-only until an isolated QA database is configured.',
    }, { status: 423 });
  }
  let response = NextResponse.next({ request });
  if (request.nextUrl.pathname.startsWith('/api/') ||
      request.nextUrl.pathname.startsWith('/client-portal') ||
      request.nextUrl.pathname.startsWith('/partner-review') ||
      request.nextUrl.pathname.startsWith('/intake/')) return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return redirectKnownQaNavigation(request, response);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();
  return redirectKnownQaNavigation(request, response);
}

export const config = {
  matcher: ["/workspace/:path*", "/outreach/:path*", "/opos-next/:path*", "/api/:path*", "/client-portal/:path*", "/partner-review/:path*", "/intake/:path*"],
};
