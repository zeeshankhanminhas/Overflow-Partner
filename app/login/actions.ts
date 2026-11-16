"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Email%20and%20password%20are%20required.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Unable to sign in.")}`);
  }

  // External users are not Controller profiles. Route only provisioned
  // memberships with verified paid projects; otherwise secure links only.
  const { data: externalMemberships, error: externalError } = await supabase.rpc('portal_my_workspaces');
  if (!externalError && Array.isArray(externalMemberships) && externalMemberships.length) {
    for (const kind of ['client', 'partner'] as const) {
      if (!externalMemberships.some((row: {portal_kind: string}) => row.portal_kind === kind)) continue;
      const { data: eligibleProjects, error: projectError } = await supabase.rpc('portal_my_projects', {p_kind: kind});
      if (!projectError && Array.isArray(eligibleProjects) && eligibleProjects.length > 0) {
        redirect('/portal/' + kind);
      }
    }
    await supabase.auth.signOut();
    redirect('/login?error=' + encodeURIComponent('Project dashboard access starts after verified opening payment. Please use your secure invitation links until then.'));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organisation_id, is_active, role")
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

  if (profile.role === 'partner') {
    await supabase.auth.signOut();
    redirect('/login?error=' + encodeURIComponent('Use your assigned secure invitation link.'));
  }
  redirect("/workspace");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
