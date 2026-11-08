import type {Metadata} from 'next';
import Link from 'next/link';
import ConfirmEnquiryButton from '@/components/ConfirmEnquiryButton';
export const metadata:Metadata={title:'Confirm your enquiry | Overflow Partner',robots:{index:false,follow:false}};
export default async function ConfirmEnquiryPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 return <main id="main-content" className="flex min-h-[75vh] items-center justify-center bg-[#f4f3ee] px-5 py-20 text-[#101311]">
  <section className="w-full max-w-xl border border-black/15 bg-white p-8 md:p-12">
  <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b74a0f]">Overflow Partner</p>
  <h1 className="mt-5 text-4xl font-semibold tracking-tight">Confirm your work email.</h1>
  <p className="mt-5 text-base leading-7 text-black/65">Select confirm below to complete your engineering enquiry. We’ll then send you a secure link to provide further technical details.</p>
  <p className="mt-3 text-sm leading-6 text-black/65">If you did not submit an enquiry, you can safely close this page.</p>
  <ConfirmEnquiryButton token={token}/>
  <Link href="/" className="op-link mt-8">Back to Overflow Partner →</Link>
  </section>
 </main>;
}