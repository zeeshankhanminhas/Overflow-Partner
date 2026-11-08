import Link from 'next/link';
import { signIn } from './actions';
import LoginSubmit from '@/components/auth/LoginSubmit';
export const metadata = { title: 'Workspace Sign In | Overflow Partner', robots: { index: false, follow: false } };
const messages: Record<string,string> = {
  missing:'Enter your email address and password to continue.',
  invalid:'The sign-in details could not be verified. Check them and try again.',
  unavailable:'Workspace access is unavailable for this account. Please contact your administrator.'
};
export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error}=await searchParams;const message=error?messages[error]:undefined;
 return <main className="auth px-5"><section className="card stack rounded-lg shadow-sm" aria-labelledby="sign-in-heading">
   <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#a64210]">Protected workspace</p><h1 id="sign-in-heading" className="text-3xl font-semibold tracking-tight">Sign in</h1><p className="mt-3 text-sm leading-6 text-[#44514a]">Secure access for authorized Overflow Partner users.</p></div>
   {message?<p className="border-l-4 border-[#bd521b] bg-[#fff1e9] p-4 text-sm" role="alert">{message}</p>:null}
   <form action={signIn} className="stack">
    <label className="field text-sm font-semibold">Work email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
    <label className="field text-sm font-semibold">Password<input name="password" type="password" autoComplete="current-password" required/></label>
    <LoginSubmit/>
   </form>
   <p className="text-sm text-[#49564f]">Need access or a password reset? <Link className="underline underline-offset-4" href="/contact">Contact the workspace administrator</Link>.</p>
   <Link className="w-fit text-sm underline underline-offset-4" href="/">← Back to website</Link>
 </section></main>;
}