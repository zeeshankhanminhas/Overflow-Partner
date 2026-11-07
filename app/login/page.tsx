import Link from "next/link";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import { signIn } from "./actions";
import QaClientEmailSignIn from "./QaClientEmailSignIn";
import { isKnownIsolatedQaPresentationPreview } from "@/lib/qa/isolation";
import styles from "./login.module.css";

const permittedDestinations = ["/opos-next", "/portal/client", "/portal/partner"];

function PasswordSignIn({ next }: { next?: string }) {
  return (
    <form action={signIn} className={styles.form}>
      {next && permittedDestinations.includes(next) ? (
        <input type="hidden" name="next" value={next} />
      ) : null}
      <label className={styles.field}>
        Email
        <input className={styles.input} name="email" type="email" required autoComplete="email" />
      </label>
      <label className={styles.field}>
        Password
        <input className={styles.input} name="password" type="password" required autoComplete="current-password" />
      </label>
      <button className={styles.button} type="submit">Sign in</button>
    </form>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string; next?: string }>;
}) {
  const { error, updated, next } = await searchParams;
  // Only invited client accounts in an isolated QA environment get email-link login.
  const qaClientEmailAccess = next === "/portal/client" &&
    process.env.VERCEL_GIT_COMMIT_REF === "qa/recovery-ui-client-gate-20261105" &&
    isKnownIsolatedQaPresentationPreview();
  // Magic-link PKCE cookies must be created on the SAME host as the callback.
  // Always enter through this branch's fixed alias, never a rotating deployment URL.
  if (qaClientEmailAccess) {
    const qaOrigin = "https://overflow-partner-git-qa-recov-21e6a9-zeeshankhanminhas-projects.vercel.app";
    const currentHost = (await headers()).get("host") || "";
    if (currentHost.toLowerCase() !== new URL(qaOrigin).host) {
      const canonical = new URL("/login", qaOrigin);
      canonical.searchParams.set("next", "/portal/client");
      if (error) canonical.searchParams.set("error", error);
      if (updated) canonical.searchParams.set("updated", updated);
      redirect(canonical.toString());
    }
  }
  const context = next === "/portal/client"
    ? "Client workspace"
    : next === "/portal/partner"
      ? "Execution Partner workspace"
      : "Operator workspace";

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-heading">
        <p className={styles.brand}>OVERFLOW PARTNER</p>
        <h1 id="login-heading" className={styles.heading}>Sign in</h1>
        <p className={styles.context}>
          {qaClientEmailAccess ? "Northfield QA Client — sign in with your test password." : context}
        </p>
        {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
        {updated ? <p role="status" className={styles.notice}>{updated}</p> : null}

        {qaClientEmailAccess ? (
          <>
            <PasswordSignIn next={next} />
            <details className={styles.alternate}>
              <summary>Use a one-time email link instead (subject to Supabase email limits)</summary>
              <QaClientEmailSignIn/>
            </details>
          </>
        ) : (
          <PasswordSignIn next={next} />
        )}
        <Link href="/" className={styles.back}>Back to website</Link>
      </section>
    </main>
  );
}
