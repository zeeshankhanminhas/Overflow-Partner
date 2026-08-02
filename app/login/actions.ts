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
