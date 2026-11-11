import {isWorkspaceTwoPreview} from '@/lib/qa/isolation';
import Link from "next/link";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const operatorHome = isWorkspaceTwoPreview() ? '/opos-next' : '/workspace';
  const destinations: Record<string,string> = {'/portal/client':'Client Workspace','/portal/partner':'Execution Partner Workspace',[operatorHome]:'Operator Workspace'};
  const destination = next && Object.hasOwn(destinations, next) ? next : operatorHome;

  return (
    <main className="auth">
      <section className="card stack">
        <div>
          <p className="eyebrow">Protected workspace</p>
          <h2>{destinations[destination]}</h2>
          <nav aria-label="Choose workspace" style={{display:'flex',gap:16,flexWrap:'wrap'}}>
            {Object.entries(destinations).filter(([path]) => path !== destination).map(([path,label]) =>
              <Link key={path} href={'/login?next='+encodeURIComponent(path)}>{label}</Link>)}
          </nav>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <form action={signIn} className="stack">
          <input type="hidden" name="next" value={destination}/><label className="field">Email<input name="email" type="email" required autoComplete="email" /></label>
          <label className="field">Password<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="button" type="submit">Enter Workspace</button>
        </form>
        <Link href="/">Back to website</Link>
      </section>
    </main>
  );
}
