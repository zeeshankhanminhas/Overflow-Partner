import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isKnownIsolatedQaBackend, isKnownIsolatedQaFixtureBackend, isKnownIsolatedQaStep2Backend } from "@/lib/qa/isolation";

export async function proxy(request: NextRequest) {
  // Draft redesign preview may share production Supabase for read-only inspection.
  // Never let POST/PUT/PATCH/DELETE from either the new or legacy operating UI
  // mutate that database. Isolated QA is the only allowed preview write target.
  const qaFixturePost = request.nextUrl.pathname === '/opos-next/opportunities/new' &&
    isKnownIsolatedQaFixtureBackend();
  const qaStep2Post = isKnownIsolatedQaStep2Backend() && (
    /^\/opos-next\/opportunities\/[0-9a-f-]{36}\/?$/i.test(request.nextUrl.pathname) ||
    /^\/api\/intake\/[a-f0-9]{64}(?:\/files)?\/?$/i.test(request.nextUrl.pathname)
  );
  if (process.env.VERCEL_ENV === 'preview' &&
      !isKnownIsolatedQaBackend() && !qaFixturePost && !qaStep2Post &&
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

  if (!url || !key) return response;

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
  return response;
}

export const config = {
  matcher: ["/workspace/:path*", "/outreach/:path*", "/opos-next/:path*", "/api/:path*", "/client-portal/:path*", "/partner-review/:path*", "/intake/:path*"],
};
