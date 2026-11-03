import Link from "next/link";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;

  return (
    <main className="auth">
      <section className="card stack">
        <div>
          <p className="eyebrow">Overflow Partner · secure account access</p>
          <h2>{next?.startsWith('/portal/')?'Sign in to your account':'Sign in'}</h2>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <form action={signIn} className="stack">
          {['/opos-next','/portal/client','/portal/partner'].includes(next||'')?<input type="hidden" name="next" value={next}/>:null}
          <label className="field">Email<input name="email" type="email" required autoComplete="email" /></label>
          <label className="field">Password<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="button" type="submit">Sign in securely</button>
        </form>
        <Link href="/">Back to website</Link>
      </section>
    </main>
  );
}
