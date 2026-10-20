import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientResponseToken, type ClientQuoteResponse } from '@/lib/quotes/clientResponseToken';
import { recordClientQuoteResponse } from './actions';

const decisionCopy: Record<ClientQuoteResponse, { title: string; action: string; explanation: string }> = {
  accepted: { title: 'Accept this quotation?', action: 'Confirm acceptance', explanation: 'Your acceptance records the client decision. Project setup follows after Overflow Partner confirms the agreed opening payment or purchase order.' },
  declined: { title: 'Decline this quotation?', action: 'Confirm decline', explanation: 'This records your decision and lets Overflow Partner know the quotation will not proceed.' },
  more_time: { title: 'Request more time?', action: 'Request more time', explanation: 'The quotation remains open while Overflow Partner follows up with you.' },
};

export default async function QuoteResponsePage({ searchParams }: { searchParams: Promise<{ token?: string; result?: string }> }) {
  const { token = '', result } = await searchParams;
  const payload = token ? verifyClientResponseToken(token) : null;
  type QuoteInfo = { quote_number: string; revision: number; valid_until: string | null };
  let quote: QuoteInfo | null = null;
  let recipient: {name:string;email:string}|null=null;
  if (payload) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const admin = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: issue } = await admin.from('quote_issue_records').select('id,recipient_name,recipient_email').eq('quote_id', payload.quoteId).eq('quote_revision', payload.revision).maybeSingle();
      if (issue) {
        recipient={name:String(issue.recipient_name||''),email:String(issue.recipient_email||'')};
        const { data } = await admin.from('quotes').select('quote_number,revision,valid_until').eq('id', payload.quoteId).eq('revision', payload.revision).maybeSingle();
        quote = data as QuoteInfo | null;
      }
    }
  }
  const decision = payload ? decisionCopy[payload.response] : null;
  return <main style={{ minHeight: '100vh', background: '#f3f1ec', padding: '48px 18px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#171717' }}>
    <section style={{ maxWidth: 620, margin: '0 auto', padding: 32, background: '#fff', border: '1px solid #ded9d0', borderTop: '5px solid #e95d2a' }}>
      <p style={{ margin: 0, color: '#6f6a61', fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>OVERFLOW PARTNER · CLIENT QUOTE</p>
      {result === 'recorded' ? <><h1>Response recorded</h1><p>Thank you. Your response has been added to the quotation record. If you accepted, project setup remains subject to confirmation of the agreed opening payment or purchase order.</p></> : null}
      {result === 'invalid' ? <><h1>Response link expired</h1><p>This link is invalid or has expired. Please reply to the quotation email and the team will help.</p></> : null}
      {result === 'unavailable' ? <><h1>Response could not be recorded</h1><p>Please try again shortly or reply to the quotation email.</p></> : null}
      {result === 'recorded' || result === 'invalid' || result === 'unavailable' ? null : decision && quote ? <>
        <h1>{decision.title}</h1>
        <p>Quotation {quote.quote_number} · Revision {quote.revision}</p>
        <p>{decision.explanation}</p>
        <form action={recordClientQuoteResponse}>
          <input type="hidden" name="token" value={token} />
          {payload?.response==='accepted' ? <div style={{display:'grid',gap:12,margin:'18px 0'}}>
            <label>Full name of authorised signatory<input name="signatory_name" required defaultValue={recipient?.name||''} style={{display:'block',width:'100%',padding:10}}/></label>
            <label>Business email of authorised signatory<input name="signatory_email" type="email" required defaultValue={recipient?.email||''} style={{display:'block',width:'100%',padding:10}}/></label>
            <label style={{display:'flex',gap:10,alignItems:'start'}}><input type="checkbox" name="authority_attested" value="yes" required/>I confirm that I am authorised to accept this quotation, its specified scope, price and commercial release terms on behalf of the customer.</label>
          </div> : null}
          <button type="submit" style={{ border: 0, borderRadius: 8, padding: '14px 20px', background: '#df2925', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{decision.action}</button>
        </form>
        <p style={{ color: '#6f6a61', fontSize: 13 }}>No response means the quotation stays awaiting your decision until its validity date.</p>
      </> : <><h1>Quotation response unavailable</h1><p>This link is invalid, expired, or no longer refers to an active quotation. Please reply to the quotation email for help.</p></>}
    </section>
  </main>;
}
