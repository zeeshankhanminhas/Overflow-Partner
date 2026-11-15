import Link from 'next/link';
import { signIn } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f3ee] px-5 py-14 text-[#111815]">
      <section className="w-full max-w-[460px] border border-[#d9d6ce] bg-white px-6 py-9 shadow-sm sm:px-10 sm:py-11" aria-labelledby="sign-in-heading">
        <Link href="/" className="text-xs font-bold uppercase tracking-[0.18em] hover:text-[#b74a0f]">Overflow Partner</Link>
        <p className="mt-9 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#66706a]">Secure Workspace</p>
        <h1 id="sign-in-heading" className="mt-2 text-3xl font-semibold tracking-tight">Sign In</h1>
        <p className="mt-3 text-sm leading-6 text-[#4b5651]">For authorised Overflow Partner clients, execution partners and team members.</p>
        {error ? <p role="alert" className="mt-6 border-l-4 border-[#b74a0f] bg-[#fff5ee] px-4 py-3 text-sm text-[#70310e]">{error}</p> : null}
        <form action={signIn} className="mt-8 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold" htmlFor="workspace-email">
            Email address
            <input id="workspace-email" name="email" type="email" required autoComplete="username"
              className="min-h-12 border border-[#c9cec8] bg-white px-4 text-base font-normal" />
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="workspace-password">
            Password
            <input id="workspace-password" name="password" type="password" required autoComplete="current-password"
              className="min-h-12 border border-[#c9cec8] bg-white px-4 text-base font-normal" />
          </label>
          <button className="op-cta mt-1 w-full" type="submit">Enter Secure Workspace →</button>
        </form>
        <div className="mt-7 border-t border-[#e5e4df] pt-5 text-sm leading-6 text-[#4b5651]">
          <p>New to Overflow Partner? You don’t need an account to discuss a project.</p>
          <Link href="/contact" className="mt-2 inline-block font-semibold text-[#993b09] underline underline-offset-4 hover:text-[#662500]">Discuss a Requirement</Link>
        </div>
        <Link href="/" className="mt-7 inline-flex text-sm text-[#4b5651] underline underline-offset-4 hover:text-[#b74a0f]">← Back to website</Link>
      </section>
    </main>
  );
}
