"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect("/login?error=invalid");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organisation_id, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    redirect("/login?error=unavailable");
  }

  if (!profile.is_active || !profile.organisation_id) {
    await supabase.auth.signOut();
    redirect("/login?error=unavailable");
  }

  redirect("/workspace");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
