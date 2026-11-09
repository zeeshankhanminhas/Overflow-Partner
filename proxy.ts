import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RELEASE_PREVIEW_BRANCH = "release/opos-production-hardening-2026-11-09";
const QA_PROJECT_REF = "ukcamenuxhdznxaxpyis";

/**
 * The in-flight release candidate may only run against its isolated QA database
 * in Vercel Preview. Fail closed for *all* routes (including server actions and
 * checkout/webhook endpoints) if Vercel inherits production Supabase settings.
 * Production is intentionally untouched: this applies only to the named branch
 * while VERCEL_ENV is preview.
 */
function releasePreviewBackendIsolated() {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== RELEASE_PREVIEW_BRANCH) return true;
  const expectedUrl = `https://${QA_PROJECT_REF}.supabase.co`;
  const declaredRef = String(process.env.OP_QA_SUPABASE_PROJECT_REF || "").trim().toLowerCase();
  const publishedUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serverUrl = String(process.env.SUPABASE_URL || publishedUrl).trim();
  return declaredRef === QA_PROJECT_REF &&
    publishedUrl === expectedUrl && serverUrl === expectedUrl;
}

export async function proxy(request: NextRequest) {
  if (!releasePreviewBackendIsolated()) {
    return new NextResponse("Release preview unavailable: isolated QA backend not verified.", {
      status: 503,
      headers: { "Cache-Control": "no-store" }
    });
  }

  let response = NextResponse.next({ request });
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

// Keep the release-preview isolation check in front of *every* application
// entrypoint, not merely the workspace. Exclude only framework static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
