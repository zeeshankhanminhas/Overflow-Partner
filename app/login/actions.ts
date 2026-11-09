"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const destination = String(formData.get('next') || '/workspace');
  const external = destination === '/portal/client' || destination === '/portal/partner' || destination === '/portal';
  if (!email || !password) {
    redirect("/login?error=Email%20and%20password%20are%20required.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect('/login?' + new URLSearchParams({next:external ? destination : '/workspace',error:'Unable to sign in with those details.'}));
  }

  if (external) {
    const membership = await supabase.rpc('portal_my_workspaces');
    const authorised = membership.data?.some((record: {portal_kind: string}) =>
      destination === '/portal' || destination === '/portal/' + record.portal_kind);
    if (!membership.error && authorised) redirect(destination);
    await supabase.auth.signOut();
    redirect('/login?' + new URLSearchParams({next: destination, error: 'This account has no access to the selected workspace.'}));
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

  redirect("/workspace");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
