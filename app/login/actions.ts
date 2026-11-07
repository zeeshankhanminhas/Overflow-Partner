"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {isKnownIsolatedQaPresentationPreview} from "@/lib/qa/isolation";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  const redesignPreview = process.env.VERCEL_ENV === "preview" &&
    ["design/opos-decision-first-ia", "qa/recovery-ui-client-gate-20261105"]
      .includes(process.env.VERCEL_GIT_COMMIT_REF || "");
  // Only pre-approved internal destinations are accepted. Never redirect to
  // arbitrary paths from a login form or cross-organisation portal URLs.
  const externalKind=next==='/portal/client'?'client':next==='/portal/partner'?'partner':null;
  const safeNext = externalKind?next:next === "/opos-next" ? next : (redesignPreview ? "/opos-next" : "/workspace");

  if (!email || !password) {
    redirect("/login?error=Email%20and%20password%20are%20required.");
  }

  // QA preview safety: a new Git branch does not inherit another branch's
  // Vercel-scoped environment variables. Never send operator QA credentials
  // to the production Supabase Auth instance from either QA review branch.
  const qaPreviewBranch = process.env.VERCEL_ENV === "preview" &&
    ["design/opos-decision-first-ia", "qa/recovery-ui-client-gate-20261105"]
      .includes(process.env.VERCEL_GIT_COMMIT_REF || "");
  if (qaPreviewBranch) {
    const qaRef = String(process.env.OP_QA_SUPABASE_PROJECT_REF || "").trim().toLowerCase();
    const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!/^[a-z0-9]{12,32}$/.test(qaRef) ||
        qaRef === "klricctsxiifuduxpmzd" ||
        authUrl !== `https://${qaRef}.supabase.co`) {
      redirect("/login?next=%2Fopos-next&error=" +
        encodeURIComponent("This preview is not connected to isolated QA. Sign-in is disabled until its environment is corrected."));
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect('/login?next='+encodeURIComponent(safeNext)+'&error='+
      encodeURIComponent(error?.message ?? "Unable to sign in."));
  }

  if(externalKind){
    // External users are not required to have an employee profile, and a
    // Supabase Auth session alone does not grant any project access.
    const {data:accounts,error:membershipError}=await supabase.rpc('portal_my_workspaces');
    if(membershipError||!(accounts||[]).some((account:{portal_kind:string})=>account.portal_kind===externalKind)){
      await supabase.auth.signOut();
      redirect('/login?next='+encodeURIComponent(safeNext)+'&error='+
        encodeURIComponent('This sign-in is not authorised for the selected client or partner account.'));
    }
    redirect(safeNext);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organisation_id, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    redirect(
      "/login?error=" +
        encodeURIComponent(
          "Your Supabase user exists, but no Overflow Partner workspace profile has been created for it.",
        ),
    );
  }

  if (!profile.is_active || !profile.organisation_id) {
    await supabase.auth.signOut();
    redirect(
      "/login?error=" +
        encodeURIComponent(
          "Your workspace profile is inactive or is not assigned to an organisation.",
        ),
    );
  }

  redirect(safeNext);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

