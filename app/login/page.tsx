import Link from "next/link";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="auth">
      <section className="card stack">
        <div>
          <p className="eyebrow">Protected workspace</p>
          <h2>Sign in</h2>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <form action={signIn} className="stack">
          <label className="field">Email<input name="email" type="email" required autoComplete="email" /></label>
          <label className="field">Password<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="button" type="submit">Enter Workspace</button>
        </form>
        <Link href="/">Back to website</Link>
      </section>
    </main>
  );
}
