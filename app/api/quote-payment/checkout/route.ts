import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyClientPortalToken } from '@/lib/quotes/clientPortalToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noAdvancePattern = /no[\s-]+(?:(?:advance[\s-]+)?payments?\s+(?:is\s+)?(?:due|required|requested)|payment\s+is\s+(?:due|required|requested))/i;

function minorUnits(value: string | number) {
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error('Invalid quote amount.');
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}

export async function POST(request: Request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://overflow-partner.vercel.app';
    if (!secret || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Online payment is not configured yet.' }, { status: 503 });
    }
    if (!secret.startsWith('sk_test_') && process.env.STRIPE_LIVE_PAYMENTS_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Only Stripe test mode is enabled until payment testing is complete.' }, { status: 503 });
    }
    const { token } = await request.json() as { token?: string };
    const access = token ? verifyClientPortalToken(token) : null;
    if (!access) return NextResponse.json({ error: 'This secure quotation link is invalid or expired.' }, { status: 401 });

    const db = createAdminClient();
    const { data: quote, error: quoteError } = await db.from('quotes')
      .select('id,organisation_id,lead_id,commercial_review_id,quote_number,revision,status,total,currency,valid_until')
      .eq('id', access.quoteId).eq('revision', access.revision).maybeSingle();
    if (quoteError || !quote || quote.status !== 'issued') return NextResponse.json({ error: 'This quotation is no longer available for payment.' }, { status: 409 });
    if (quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: 'This quotation has expired.' }, { status: 409 });

    const { data: issue, error: issueError } = await db.from('quote_issue_records')
      .select('client_response,quote_revision,recipient_email').eq('organisation_id', quote.organisation_id)
      .eq('quote_id', quote.id).eq('quote_revision', quote.revision).maybeSingle();
    if (issueError || issue?.client_response !== 'accepted') return NextResponse.json({ error: 'Accept the quotation before starting payment.' }, { status: 409 });

    if (quote.commercial_review_id) {
      const { data: review } = await db.from('commercial_reviews').select('partner_quote_id').eq('organisation_id', quote.organisation_id).eq('id', quote.commercial_review_id).maybeSingle();
      if (review?.partner_quote_id) {
        const { data: partnerQuote } = await db.from('partner_quotes').select('payment_terms').eq('organisation_id', quote.organisation_id).eq('id', review.partner_quote_id).maybeSingle();
        if (noAdvancePattern.test(String(partnerQuote?.payment_terms || ''))) return NextResponse.json({ error: 'The issued quotation does not require an advance payment.' }, { status: 409 });
      }
    }
    const { data: existingPayment, error: paymentReadError } = await db.from('quote_payment_provider_confirmations')
      .select('payment_intent_id').eq('organisation_id', quote.organisation_id).eq('quote_id', quote.id).maybeSingle();
    if (paymentReadError) return NextResponse.json({ error: 'Payment status could not be verified.' }, { status: 503 });
    if (existingPayment) return NextResponse.json({ paid: true });

    const { data: project } = await db.from('projects').select('id').eq('organisation_id', quote.organisation_id).eq('quote_id', quote.id).maybeSingle();
    if (project) return NextResponse.json({ error: 'A project already exists for this quotation.' }, { status: 409 });

    const { data: paymentRequest, error: reserveError } = await db.rpc('op_reserve_quote_payment_request', {
      p_organisation_id: quote.organisation_id, p_quote_id: quote.id, p_quote_revision: quote.revision,
    });
    if (reserveError || !paymentRequest?.id) return NextResponse.json({ error: reserveError?.message || 'A payment request could not be created.' }, { status: 409 });
    if (paymentRequest.status === 'paid') return NextResponse.json({ paid: true });

    let session: any;
    if (paymentRequest.stripe_session_id) {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(paymentRequest.stripe_session_id)}`, { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' });
      if (response.ok) session = await response.json();
      if (session?.status === 'expired') {
        await db.from('quote_payment_requests').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', paymentRequest.id);
        return NextResponse.json({ error: 'This payment link expired. Please try again to create a fresh link.' }, { status: 409 });
      }
    }
    if (!session?.url) {
      const body = new URLSearchParams();
      body.set('mode', 'payment');
      body.set('success_url', `${appUrl}/client-portal?token=${encodeURIComponent(token!)}&payment=return`);
      body.set('cancel_url', `${appUrl}/client-portal?token=${encodeURIComponent(token!)}&payment=cancelled`);
      body.set('client_reference_id', quote.id);
      if (issue.recipient_email) body.set('customer_email', issue.recipient_email);
      body.set('line_items[0][quantity]', '1');
      body.set('line_items[0][price_data][currency]', String(quote.currency).toLowerCase());
      body.set('line_items[0][price_data][unit_amount]', String(minorUnits(quote.total)));
      body.set('line_items[0][price_data][product_data][name]', `Overflow Partner · ${quote.quote_number} R${quote.revision}`);
      body.set('line_items[0][price_data][product_data][description]', 'Payment against the accepted engineering quotation');
      body.set('metadata[op_quote_payment_request_id]', paymentRequest.id);
      body.set('metadata[op_quote_id]', quote.id);
      body.set('metadata[op_quote_revision]', String(quote.revision));
      body.set('payment_intent_data[metadata][op_quote_payment_request_id]', paymentRequest.id);
      body.set('payment_intent_data[metadata][op_quote_id]', quote.id);
      const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `op-quote-payment-${paymentRequest.id}` }, body, cache: 'no-store',
      });
      session = await stripeResponse.json();
      if (!stripeResponse.ok || !session.url) {
        await db.from('quote_payment_requests').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', paymentRequest.id);
        return NextResponse.json({ error: 'The payment provider could not create a checkout link.' }, { status: 502 });
      }
    }
    const { error: updateError } = await db.from('quote_payment_requests').update({
      status: session.payment_status === 'paid' ? 'paid' : 'open', stripe_session_id: session.id,
      stripe_livemode: Boolean(session.livemode), checkout_url: session.url,
      expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null, updated_at: new Date().toISOString(),
    }).eq('id', paymentRequest.id);
    if (updateError) return NextResponse.json({ error: 'The payment link was created but its record could not be saved. Retry safely.' }, { status: 503 });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: 'Payment could not be started. Please try again later.' }, { status: 500 });
  }
}
