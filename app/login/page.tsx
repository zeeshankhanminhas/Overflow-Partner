import Link from "next/link";
import { signIn, emailQaClientLoginLink } from "./actions";
import {isKnownIsolatedQaBackend} from "@/lib/qa/isolation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string; next?: string }> }) {
  const { error, updated, next } = await searchParams;
  const showQaClientAccess=next==="/portal/client"&&isKnownIsolatedQaBackend();

  return (
    <main className="auth">
      <section className="card stack">
        <div>
          <p className="eyebrow">Overflow Partner · secure account access</p>
          <h2>{next?.startsWith('/portal/')?'Sign in to your account':'Sign in'}</h2>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        {updated ? <p role="status">{updated}</p> : null}
        <form action={signIn} className="stack">
          {['/opos-next','/portal/client','/portal/partner'].includes(next||'')?<input type="hidden" name="next" value={next}/>:null}
          <label className="field">Email<input name="email" type="email" required autoComplete="email" /></label>
          <label className="field">Password<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="button" type="submit">Sign in securely</button>
        </form>
        {showQaClientAccess?<section style={{display:'grid',gap:12,paddingTop:16,borderTop:'1px solid #494e53'}}>
          <strong>QA Client: sign in with an email link</strong>
          <p style={{fontSize:13,lineHeight:1.6}}>Use the separate Client QA email that your OP owner has invited. You do not need to share a password with OP.</p>
          <form action={emailQaClientLoginLink} className="stack">
            <label className="field">Invited QA client email
              <input type="email" name="email" required autoComplete="email" placeholder="your-qa-client@example.com"/>
            </label>
            <button type="submit" className="button">Email my secure client sign-in link</button>
          </form>
        </section>:null}
        <Link href="/">Back to website</Link>
      </section>
    </main>
  );
}
