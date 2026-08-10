import { redirect } from 'next/navigation';

export default function PartnerQuotesCompatibilityPage(){
  redirect('/workspace/leads?view=partner-pricing');
}
