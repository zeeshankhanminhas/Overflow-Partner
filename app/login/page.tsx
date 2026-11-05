import Link from "next/link";
import { signIn, emailQaClientLoginLink } from "./actions";
import { isKnownIsolatedQaBackend } from "@/lib/qa/isolation";
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
  const qaClientEmailAccess = next === "/portal/client" && isKnownIsolatedQaBackend();
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
          {qaClientEmailAccess ? "Enter your invited email to receive a secure sign-in link." : context}
        </p>
        {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
        {updated ? <p role="status" className={styles.notice}>{updated}</p> : null}

        {qaClientEmailAccess ? (
          <>
            <form action={emailQaClientLoginLink} className={styles.form}>
              <label className={styles.field}>
                Email
                <input className={styles.input} type="email" name="email" required autoComplete="email" />
              </label>
              <button className={styles.button} type="submit">Email sign-in link</button>
            </form>
            <details className={styles.alternate}>
              <summary>Use a password instead</summary>
              <PasswordSignIn next={next} />
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
